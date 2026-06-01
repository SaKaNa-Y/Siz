import ansis from 'ansis'
import { exec } from 'node:child_process'
import process from 'node:process'

import type { SearchResult, TrackedPackage } from '../core/types.ts'

import { normalizeCategory, suggestCategory } from '../core/categories.ts'
import { buildInstallCommands, detectPM, formatCommand, runInstall } from '../core/pm.ts'
import { parseQuery } from '../core/query.ts'
import { type SearchMode, searchPackages } from '../core/registry.ts'
import {
  addTags,
  listPackages,
  setFavorite,
  sortByFavoriteThenName,
  trackPackage,
} from '../core/store.ts'
import { highlightKeywords } from '../ui/highlight.ts'
import { clack, ensure, pickPackageManager, pickSetAction } from '../ui/prompts.ts'
import { categoryLabel } from '../ui/render.ts'
import { searchPrompt, type SearchOption } from '../ui/search-prompt.ts'

/** Versions seen during search, so track/favorite can store them. */
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
  tracked?: TrackedPackage,
): SearchOption {
  // Category/tag prefix: stored category + #tags for tracked packages,
  // otherwise the heuristic category guess.
  const prefix = tracked
    ? [
        tracked.category ? ansis.magenta(`[${tracked.category}]`) : '',
        ...tracked.tags.map((t) => ansis.yellow(`#${t}`)),
      ]
        .filter(Boolean)
        .join(' ')
    : categoryLabel(pkg)

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
      : 'search by name · try keyword:cli · Enter (empty) to browse tracked'

  // The tracked list does not change while the box is open (tracking happens
  // later in runSetAction), so read it once instead of on every keystroke.
  const trackedByName = new Map(listPackages().map((p) => [p.name, p]))

  // Per-package dependency type, populated by Ctrl+T inside the prompt.
  const depTypes = new Map<string, boolean>()

  const selected = await searchPrompt({
    message: mode === 'description' ? 'Search npm (descriptions)' : 'Search npm packages',
    placeholder,
    initialInput: seedQuery,
    badge: (name) => (depTypes.get(name) ? ` ${ansis.cyan('[dev]')}` : ` ${ansis.dim('[dep]')}`),
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
              .map((pkg) => toSearchOption(pkg, input, mode, trackedByName.get(pkg.name)))

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

/** Track a searched package, carrying over its cached version and a category guess. */
function trackFromSearch(name: string): void {
  trackPackage({ name, version: versionCache.get(name), category: suggestCategory({ name }) })
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
      const agent = await pickPackageManager(await detectPM())
      const cmds = buildInstallCommands(agent, selections)
      const styled = cmds.map((c) => ansis.cyan(formatCommand(c)))
      const ok = ensure(
        await clack.confirm({
          message: `Run ${styled.join(' && ')}?`,
          initialValue: true,
        }),
      )
      if (!ok) {
        clack.outro('Aborted.')
        return
      }
      clack.log.step(`Installing with ${ansis.bold(agent)}`)
      for (const cmd of cmds) {
        const code = await runInstall(cmd)
        if (code !== 0) {
          clack.log.error(`Install exited with code ${code}`)
          return
        }
      }
      // Offer to track what we just installed.
      const track = ensure(
        await clack.confirm({ message: 'Track these in Siz too?', initialValue: true }),
      )
      if (track) {
        for (const name of names) trackFromSearch(name)
      }
      clack.outro('Done.')
      return
    }

    case 'favorite': {
      for (const name of names) {
        trackFromSearch(name)
        setFavorite(name, true)
      }
      clack.log.success(`Favorited ${names.join(', ')} ❤`)
      clack.outro('Done.')
      return
    }

    case 'track': {
      for (const name of names) trackFromSearch(name)
      clack.log.success(`Tracking ${names.join(', ')}`)
      clack.outro('Done.')
      return
    }

    case 'tag': {
      const input = ensure(
        await clack.text({
          message: 'Tags (space or comma separated)',
          placeholder: 'lightweight production',
        }),
      )
      const tags = input.split(/[\s,]+/).filter(Boolean)
      for (const name of names) {
        trackFromSearch(name)
        if (tags.length) addTags(name, tags)
      }
      clack.log.success(`Tagged ${names.join(', ')}: ${tags.map((t) => `#${t}`).join(' ')}`)
      clack.outro('Done.')
      return
    }

    case 'copy': {
      const agent = await pickPackageManager(await detectPM())
      const cmds = buildInstallCommands(agent, selections)
      console.log(`\n${cmds.map((c) => ansis.cyan(formatCommand(c))).join('\n')}\n`)
      clack.outro('Done.')
      return
    }
  }
}

/** Empty-input path: pick from the user's tracked/favorited packages. */
async function runBrowseTracked(filters: { tag?: string; category?: string } = {}): Promise<void> {
  const tracked = sortByFavoriteThenName(listPackages(filters))

  if (tracked.length === 0) {
    const filtered = filters.tag || filters.category
    clack.log.info(
      filtered
        ? 'No tracked packages match that filter.'
        : 'No tracked packages yet. Search and Track or Favorite some first.',
    )
    clack.outro('Done.')
    return
  }

  const selected = ensure(
    await clack.multiselect<string>({
      message: 'Your tracked packages',
      required: false,
      options: tracked.map((pkg) => ({
        value: pkg.name,
        label: `${pkg.favorite ? '❤ ' : ''}${pkg.name}`,
        hint:
          [pkg.category, ...pkg.tags.map((t) => `#${t}`)].filter(Boolean).join(' ') || undefined,
      })),
    }),
  )

  if (selected.length === 0) {
    clack.outro('Nothing selected.')
    return
  }
  // The tracked-list view has no Ctrl+T marking, so default everything to dependency.
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
      // Carry tag/category qualifiers from the seed into the tracked-list view,
      // which filters against the user's own tags/categories.
      const { qualifiers } = parseQuery(seedQuery ?? '')
      await runBrowseTracked({
        tag: qualifiers.tag?.[0],
        category: qualifiers.category ? normalizeCategory(qualifiers.category) : undefined,
      })
      return
    }
    case 'selected':
      await runSetAction(result.selections)
      return
  }
}
