import ansis from 'ansis'
import { exec } from 'node:child_process'
import process from 'node:process'

import type {
  BundleDepType,
  BundlePackage,
  FavoritePackage,
  SearchResult,
  TrustSignals,
} from '../core/types.ts'

import { normalizeCategory, suggestCategory } from '../core/categories.ts'
import { buildInstallCommands, detectPM, formatCommand, runInstall } from '../core/pm.ts'
import { discoverManifests, relativeScope } from '../core/project.ts'
import { parseQuery } from '../core/query.ts'
import { type SearchMode, searchPackages } from '../core/registry.ts'
import { addFavorite, addToBundle, listFavorites } from '../core/store.ts'
import { fetchTrustSignals } from '../core/trust.ts'
import { highlightKeywords } from '../ui/highlight.ts'
import {
  clack,
  ensure,
  pickInstallTarget,
  pickOrCreateBundle,
  pickPackageManager,
  pickSetAction,
} from '../ui/prompts.ts'
import { categoryLabel, trustDetail, trustGlyphs, trustLegend } from '../ui/render.ts'
import { searchPrompt, type SearchOption } from '../ui/search-prompt.ts'

/** Versions seen during search, so favoriting can store them. */
const versionCache = new Map<string, string>()

function openInBrowser(url: string): void {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`
  exec(cmd)
}

/** A selected package plus its chosen dependency type (`dev` = devDependency). */
type Selection = { name: string; dev: boolean }

type BoxResult =
  | { kind: 'cancel' }
  | { kind: 'empty' }
  | { kind: 'selected'; selections: Selection[] }

/** Build the per-result option label/hint, depending on the search mode. */
function toSearchOption(
  pkg: SearchResult,
  input: string,
  mode: SearchMode,
  favorite?: FavoritePackage,
): SearchOption {
  // Category prefix: stored category for favorited packages, otherwise the
  // heuristic category guess.
  let prefix: string
  if (!favorite) prefix = categoryLabel(pkg)
  else prefix = favorite.category ? ansis.magenta(`[${favorite.category}]`) : ''

  const name = `${highlightKeywords(pkg.name, input)} ${ansis.blue(`v${pkg.version}`)}`
  const label = prefix ? `${prefix} ${name}` : name

  // Descriptions are shown (and matched) only in description mode.
  let hint: string | undefined
  if (mode === 'description' && pkg.description) {
    const desc =
      pkg.description.length > 60 ? `${pkg.description.slice(0, 57)}...` : pkg.description
    hint = highlightKeywords(desc, input)
  }

  return { value: pkg.name, label, hint }
}

/** Open the live, type-as-you-search multiselect box. */
async function openSearchBox(seedQuery: string | undefined, mode: SearchMode): Promise<BoxResult> {
  let searchResults: SearchOption[] = []
  let lastSearchTerm = ''
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const searchLoading = { value: false }

  const placeholder =
    mode === 'description'
      ? 'full-text search · try keyword:cli or author:name'
      : 'search by name · try keyword:cli · Enter (empty) to browse favorites'

  // The favorites list does not change while the box is open (favoriting happens
  // later in runSetAction), so read it once instead of on every keystroke.
  const favoritesByName = new Map(listFavorites().map((p) => [p.name, p]))

  // Per-package dependency type, populated by Ctrl+T inside the prompt.
  const depTypes = new Map<string, boolean>()

  // Trust signals arrive progressively (a second fetch after each result set),
  // read live at render time so rows fill in once they resolve.
  const signalsByName = new Map<string, TrustSignals>()
  // Fixed for the session — publish-age strings don't drift over a few minutes,
  // and this avoids a Date.now() per row on every keystroke re-render.
  const now = Date.now()

  const selected = await searchPrompt({
    message: mode === 'description' ? 'Search npm (descriptions)' : 'Search npm packages',
    placeholder,
    initialInput: seedQuery,
    footer: trustLegend(),
    badge: (name) => (depTypes.get(name) ? ` ${ansis.cyan('[dev]')}` : ` ${ansis.dim('[dep]')}`),
    signals: (name) => {
      const s = signalsByName.get(name)
      if (!s) return undefined
      return { glyphs: trustGlyphs(s, now), detail: trustDetail(s, now) }
    },
    onToggle: (name) => depTypes.set(name, !depTypes.get(name)),
    onOpen(name) {
      openInBrowser(`https://www.npmjs.com/package/${encodeURIComponent(name)}`)
    },
    options() {
      const input = (this.userInput ?? '').trim()

      if (!input) {
        lastSearchTerm = ''
        searchResults = []
        searchLoading.value = false
        if (debounceTimer) clearTimeout(debounceTimer)
        return []
      }

      // A bare token (no spaces, no `key:value` qualifier) can be added directly.
      const isPackageName = !input.includes(' ') && !input.includes(':')
      const opts: SearchOption[] = []
      if (isPackageName) {
        opts.push({ value: input, label: ansis.cyan(input), hint: 'add directly' })
      }

      if (input !== lastSearchTerm) {
        lastSearchTerm = input
        searchResults = []
        if (debounceTimer) clearTimeout(debounceTimer)

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this
        debounceTimer = setTimeout(async () => {
          searchLoading.value = true
          process.stdin.emit('keypress', '', { name: '' })
          try {
            const results = await searchPackages(input, { mode })
            if (lastSearchTerm !== input) return

            for (const pkg of results) versionCache.set(pkg.name, pkg.version)
            const exactMatch = results.find((pkg) => pkg.name === input)
            searchResults = results
              .filter((pkg) => pkg.name !== input)
              .map((pkg) => toSearchOption(pkg, input, mode, favoritesByName.get(pkg.name)))

            const updatedOpts: SearchOption[] = []
            if (isPackageName) {
              updatedOpts.push({
                value: input,
                label: exactMatch
                  ? `${ansis.cyan(input)} ${ansis.blue(`v${exactMatch.version}`)}`
                  : ansis.cyan(input),
                hint: 'add directly',
              })
            }
            updatedOpts.push(...searchResults)
            self.filteredOptions = updatedOpts
            self.focusedValue = updatedOpts[0]?.value
            process.stdin.emit('keypress', '', { name: '' })

            // Progressive enhancement: fetch trust signals for this result set
            // in the background and re-render when they arrive. Never blocks the
            // list; failures degrade silently inside fetchTrustSignals.
            const names = results.map((pkg) => pkg.name)
            void fetchTrustSignals(names).then((signals) => {
              if (lastSearchTerm !== input) return
              for (const [name, s] of signals) signalsByName.set(name, s)
              process.stdin.emit('keypress', '', { name: '' })
            })
          } catch {
            // Search failed silently — direct option still works.
          } finally {
            searchLoading.value = false
          }
        }, 300)
      }

      opts.push(...searchResults)
      return opts
    },
    filter: () => true,
    loading: searchLoading,
  })

  if (debounceTimer) clearTimeout(debounceTimer)
  if (typeof selected === 'symbol') return { kind: 'cancel' }
  const names = selected as string[]
  if (names.length === 0) return { kind: 'empty' }
  const selections = names.map((name) => ({ name, dev: depTypes.get(name) ?? false }))
  return { kind: 'selected', selections }
}

/** Favorite a searched package, carrying over its cached version and a category guess. */
function favoriteFromSearch(name: string): void {
  addFavorite({ name, version: versionCache.get(name), category: suggestCategory({ name }) })
}

/** Run the chosen action against a set of selected packages. */
async function runSetAction(selections: Selection[]): Promise<void> {
  const names = selections.map((s) => s.name)
  const action = await pickSetAction(names)
  switch (action) {
    case 'cancel':
      clack.outro('Done.')
      return

    case 'install': {
      // In a monorepo, let the user pick which package to install into; otherwise
      // (single package.json) keep installing in the current directory as before.
      const cwd = process.cwd()
      const manifests = await discoverManifests(cwd, { recursive: true })
      const targetDir = manifests.length > 1 ? await pickInstallTarget(manifests, cwd) : cwd

      const agent = await pickPackageManager(await detectPM(targetDir))
      const cmds = buildInstallCommands(agent, selections)
      const styled = cmds.map((c) => ansis.cyan(formatCommand(c)))
      const scope = relativeScope(cwd, targetDir)
      const where = scope ? ` in ${ansis.bold(scope)}` : ''
      const ok = ensure(
        await clack.confirm({
          message: `Run ${styled.join(' && ')}${where}?`,
          initialValue: true,
        }),
      )
      if (!ok) {
        clack.outro('Aborted.')
        return
      }
      clack.log.step(`Installing with ${ansis.bold(agent)}`)
      for (const cmd of cmds) {
        // Run installs sequentially and bail on the first failure (no parallelism).
        // eslint-disable-next-line no-await-in-loop
        const code = await runInstall(cmd, targetDir)
        if (code !== 0) {
          clack.log.error(`Install exited with code ${code}`)
          return
        }
      }
      clack.outro('Done.')
      return
    }

    case 'favorite': {
      for (const name of names) favoriteFromSearch(name)
      clack.log.success(`Favorited ${names.join(', ')}`)
      clack.outro('Done.')
      return
    }

    case 'bundle': {
      const target = await pickOrCreateBundle()
      if (!target) {
        clack.outro('Done.')
        return
      }
      // One version policy for the whole selection: pin the exact version seen
      // during search, or track the latest with a caret range.
      const lock = ensure(
        await clack.select<'exact' | 'caret'>({
          message: 'Version policy',
          options: [
            { value: 'caret', label: 'Track latest (caret ^)', hint: 'resolve fresh on install' },
            { value: 'exact', label: 'Lock exact version', hint: 'pin the version you saw' },
          ],
        }),
      )
      const entries: BundlePackage[] = selections.map((s) => {
        const depType: BundleDepType = s.dev ? 'devDependencies' : 'dependencies'
        if (lock === 'exact') {
          return { name: s.name, strategy: 'exact', depType, version: versionCache.get(s.name) }
        }
        return { name: s.name, strategy: 'caret', depType }
      })
      addToBundle(target, entries)
      clack.log.success(`Added ${names.join(', ')} to bundle ${ansis.bold(target)}`)
      clack.outro('Done.')
      return
    }
  }
}

/** Empty-input path: pick from the user's favorited packages. */
async function runBrowseFavorites(filters: { category?: string } = {}): Promise<void> {
  const favorites = listFavorites(filters)

  if (favorites.length === 0) {
    const filtered = filters.category
    clack.log.info(
      filtered
        ? 'No favorites match that filter.'
        : 'No favorites yet. Search and Favorite some first.',
    )
    clack.outro('Done.')
    return
  }

  const selected = ensure(
    await clack.multiselect<string>({
      message: 'Your favorite packages',
      required: false,
      options: favorites.map((pkg) => ({
        value: pkg.name,
        label: pkg.name,
        hint: pkg.category || undefined,
      })),
    }),
  )

  if (selected.length === 0) {
    clack.outro('Nothing selected.')
    return
  }
  // The favorites view has no Ctrl+T marking, so default everything to dependency.
  await runSetAction(selected.map((name) => ({ name, dev: false })))
}

/** Entry point for bare `siz` (and `siz <query>` which seeds the box). */
export async function runInteractive(seedQuery?: string, mode: SearchMode = 'name'): Promise<void> {
  clack.intro(ansis.bold.cyan('siz'))
  const result = await openSearchBox(seedQuery, mode)
  switch (result.kind) {
    case 'cancel':
      clack.cancel('Cancelled.')
      return
    case 'empty': {
      // Carry the category qualifier from the seed into the favorites view,
      // which filters against the user's own categories.
      const { qualifiers } = parseQuery(seedQuery ?? '')
      await runBrowseFavorites({
        category: qualifiers.category ? normalizeCategory(qualifiers.category) : undefined,
      })
      return
    }
    case 'selected':
      await runSetAction(result.selections)
      return
  }
}
