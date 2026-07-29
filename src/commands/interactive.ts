import ansis from 'ansis'
import { exec } from 'node:child_process'
import process from 'node:process'

import type {
  BundleDepType,
  BundlePackage,
  FavoritePackage,
  LicenseSignals,
  SearchResult,
  SizeSignals,
  TrustSignals,
} from '../core/types.ts'

import { normalizeCategory, suggestCategory } from '../core/categories.ts'
import { fetchLicenses } from '../core/license.ts'
import { parseQuery } from '../core/query.ts'
import { type SearchMode, searchPackages } from '../core/registry.ts'
import { fetchBundleSize, fetchInstallSizes } from '../core/size.ts'
import { addFavorite, addToBundle, listFavorites } from '../core/store.ts'
import { fetchDownloadTrend, fetchTrustSignals } from '../core/trust.ts'
import { highlightKeywords } from '../ui/highlight.ts'
import { clack, ensure, pickOrCreateBundle, pickSetAction } from '../ui/prompts.ts'
import {
  categoryLabel,
  licenseDetail,
  licenseInline,
  signalLegend,
  sizeDetail,
  sizeInline,
  trustDetail,
  trustGlyphs,
} from '../ui/render.ts'
import { searchPrompt, type SearchOption } from '../ui/search-prompt.ts'
import { runInstallSelections } from './install-runner.ts'

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
  // Size signals: install size arrives eagerly (background, all rows); bundle
  // size arrives lazily per focused row (see onFocus). Both read live at render.
  const sizeByName = new Map<string, SizeSignals>()
  // License signals ride the same packument fetch as install size. A name is
  // present only once its manifest resolved — absence means "unknown", which must
  // render nothing rather than an unclear-license flag.
  const licenseByName = new Map<string, LicenseSignals>()
  // Names we've already kicked a (focus-only) bundle-size fetch for — guards the
  // per-render onFocus from re-requesting or looping.
  const bundleRequested = new Set<string>()
  // Fixed for the session — publish-age strings don't drift over a few minutes,
  // and this avoids a Date.now() per row on every keystroke re-render.
  const now = Date.now()

  const selected = await searchPrompt({
    message: mode === 'description' ? 'Search npm (descriptions)' : 'Search npm packages',
    placeholder,
    initialInput: seedQuery,
    footer: signalLegend(),
    badge: (name) => (depTypes.get(name) ? ` ${ansis.cyan('[dev]')}` : ` ${ansis.dim('[dep]')}`),
    signals: (name) => {
      const trust = signalsByName.get(name)
      const size = sizeByName.get(name)
      const license = licenseByName.get(name)
      if (!trust && !size && !license) return undefined
      const glyphs = [
        trust ? trustGlyphs(trust, now) : '',
        size ? sizeInline(size) : '',
        license ? licenseInline(license) : '',
      ]
        .filter(Boolean)
        .join(' ')
      const detail = [
        trust ? trustDetail(trust, now) : '',
        size ? sizeDetail(size) : '',
        license ? licenseDetail(license) : '',
      ]
        .filter(Boolean)
        .join(ansis.dim(' · '))
      return { glyphs, detail }
    },
    // Lazily fetch bundle size for the focused row only (Bundlephobia is slow /
    // rate-limited). Guarded so it fires at most once per package; the result
    // merges in and triggers a re-render, filling the focused-row detail.
    onFocus: (name) => {
      if (bundleRequested.has(name)) return
      bundleRequested.add(name)
      void fetchBundleSize(name).then((bundle) => {
        if (!bundle) return
        sizeByName.set(name, { ...sizeByName.get(name), bundle })
        process.stdin.emit('keypress', '', { name: '' })
      })
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

            // Progressive enhancement: fetch trust signals + download trend for
            // this result set in the background and re-render when they arrive.
            // Two independent fetches (different APIs) merged additively onto the
            // same entry, so neither clobbers the other regardless of order.
            // Never blocks the list; both degrade silently on failure.
            const names = results.map((pkg) => pkg.name)
            const mergeSignals = (signals: Map<string, TrustSignals>) => {
              if (lastSearchTerm !== input) return
              for (const [name, s] of signals)
                signalsByName.set(name, { ...signalsByName.get(name), ...s })
              process.stdin.emit('keypress', '', { name: '' })
            }
            void fetchTrustSignals(names).then(mergeSignals)
            void fetchDownloadTrend(names).then(mergeSignals)

            // Install size + license: eager for every row, and both derived from
            // the same memoized packument, so together they cost one request per
            // package rather than two. Same stale guard and degrade rules.
            void fetchInstallSizes(names).then((sizes) => {
              if (lastSearchTerm !== input) return
              for (const [name, installSize] of sizes)
                sizeByName.set(name, { ...sizeByName.get(name), installSize })
              process.stdin.emit('keypress', '', { name: '' })
            })
            void fetchLicenses(names).then((licenses) => {
              if (lastSearchTerm !== input) return
              for (const [name, license] of licenses) licenseByName.set(name, license)
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
async function runSetAction(
  selections: Selection[],
  opts: { noRules?: boolean } = {},
): Promise<void> {
  const names = selections.map((s) => s.name)
  const action = await pickSetAction(names)
  switch (action) {
    case 'cancel':
      clack.outro('Done.')
      return

    case 'install': {
      // The interactive path keeps its PM picker and confirm; the shared runner
      // handles monorepo target selection, the rules guardrail, and execution.
      await runInstallSelections(selections, { noRules: opts.noRules, pickPM: true, confirm: true })
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
async function runBrowseFavorites(
  filters: { category?: string } = {},
  opts: { noRules?: boolean } = {},
): Promise<void> {
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
  await runSetAction(
    selected.map((name) => ({ name, dev: false })),
    opts,
  )
}

/** Entry point for bare `siz` (and `siz <query>` which seeds the box). */
export async function runInteractive(
  seedQuery?: string,
  mode: SearchMode = 'name',
  opts: { noRules?: boolean } = {},
): Promise<void> {
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
      await runBrowseFavorites(
        {
          category: qualifiers.category ? normalizeCategory(qualifiers.category) : undefined,
        },
        opts,
      )
      return
    }
    case 'selected':
      await runSetAction(result.selections, opts)
      return
  }
}
