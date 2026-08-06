import ansis from 'ansis'
import { exec } from 'node:child_process'
import process from 'node:process'

import type {
  BundleDepType,
  BundlePackage,
  LicenseSignals,
  SearchResult,
  SizeSignals,
  TrustSignals,
  VersionStrategy,
} from '../core/types.ts'

import { fetchLicenses } from '../core/license.ts'
import { searchPackages } from '../core/registry.ts'
import { fetchBundleSize, fetchInstallSizes } from '../core/size.ts'
import { addToBundle, listSavedEntries } from '../core/store.ts'
import { fetchDownloadSignals, fetchTrustSignals } from '../core/trust.ts'
import { SIGNAL_VIEWPORT_ROWS, windowNames } from '../core/window.ts'
import { highlightKeywords } from '../ui/highlight.ts'
import { clack, ensure, pickOrCreateBundle, pickSetAction } from '../ui/prompts.ts'
import {
  downloadsInline,
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

/** Versions seen during search, so an exact bundle entry can pin them. */
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

/** Nudge the prompt into a repaint, so async signal data shows up as it lands. */
function rerender(): void {
  process.stdin.emit('keypress', '', { name: '' })
}

/**
 * Lines the box spends on itself — header, input, hints, legend, selection line,
 * closing bar — i.e. what @clack's `limitOptions` subtracts as `rowPadding`
 * before it decides how many result rows fit.
 */
const PROMPT_CHROME_ROWS = 8

/**
 * How many result rows are actually on screen, so the signal window tracks the
 * terminal the user has rather than an assumed one. Falls back to the core
 * default when the height is unknown (piped or non-TTY output).
 */
function visibleRows(): number {
  const rows = process.stdout.rows
  return rows ? Math.max(1, rows - PROMPT_CHROME_ROWS) : SIGNAL_VIEWPORT_ROWS
}

/** A selected package plus its chosen dependency type (`dev` = devDependency). */
type Selection = { name: string; dev: boolean }

type BoxResult =
  | { kind: 'cancel' }
  | { kind: 'empty' }
  | { kind: 'selected'; selections: Selection[] }

/** Build the per-result option label/hint. */
function toSearchOption(pkg: SearchResult, input: string): SearchOption {
  const label = `${highlightKeywords(pkg.name, input)} ${ansis.blue(`v${pkg.version}`)}`

  let hint: string | undefined
  if (pkg.description) {
    const desc =
      pkg.description.length > 60 ? `${pkg.description.slice(0, 57)}...` : pkg.description
    hint = highlightKeywords(desc, input)
  }

  return { value: pkg.name, label, hint }
}

/** Open the live, type-as-you-search multiselect box. */
async function openSearchBox(seedQuery: string | undefined): Promise<BoxResult> {
  let searchResults: SearchOption[] = []
  let lastSearchTerm = ''
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const searchLoading = { value: false }

  const placeholder =
    'search npm · try keyword:cli or author:name · Enter (empty) to browse saved packages'

  // Per-package dependency type, populated by Ctrl+T inside the prompt.
  const depTypes = new Map<string, boolean>()

  // Trust signals arrive progressively (a second fetch after each result set),
  // read live at render time so rows fill in once they resolve.
  const signalsByName = new Map<string, TrustSignals>()
  // Size signals: install size arrives eagerly (background, windowed rows);
  // bundle size arrives lazily per focused row (see onFocus). Both read live at
  // render.
  const sizeByName = new Map<string, SizeSignals>()
  // License signals ride the same packument fetch as install size. A name is
  // present only once its manifest resolved — absence means "unknown", which must
  // render nothing rather than an unclear-license flag.
  const licenseByName = new Map<string, LicenseSignals>()
  // Names we've already kicked a (focus-only) bundle-size fetch for — guards the
  // per-render onFocus from re-requesting or looping.
  const bundleRequested = new Set<string>()
  // Names whose eager signals have been requested. Signals are fetched for the
  // visible window only (see core/window.ts), so this grows as the user scrolls;
  // it spans searches, since the signal maps do too and the data is name-keyed.
  // Marked before the fetches settle, so a failure is not retried — the same
  // rule the packument memo already applies to a request that came back empty.
  const signalRequested = new Set<string>()
  // The current result set, in display order — the list the window indexes into.
  let resultNames: string[] = []
  // Fixed for the session — publish-age strings don't drift over a few minutes,
  // and this avoids a Date.now() per row on every keystroke re-render.
  const now = Date.now()

  /**
   * Kick the eager signal fetches for the rows around `focusName` (the first row
   * when nothing is focused yet). Only names not already requested are fetched,
   * so scrolling back over seen rows costs nothing. Results merge into the
   * name-keyed maps unconditionally — they stay correct whatever the user has
   * typed since — and each family re-renders as it lands. Never blocks the list;
   * every source degrades silently.
   */
  const fetchWindowSignals = (focusName?: string) => {
    const focusIndex = focusName ? resultNames.indexOf(focusName) : 0
    const pending = windowNames(resultNames, focusIndex < 0 ? 0 : focusIndex, {
      viewport: visibleRows(),
      exclude: signalRequested,
    })
    if (pending.length === 0) return
    for (const name of pending) signalRequested.add(name)

    // Two independent fetches (different APIs) merged additively onto the same
    // entry, so neither clobbers the other regardless of order.
    const mergeSignals = (signals: Map<string, TrustSignals>) => {
      for (const [name, s] of signals) signalsByName.set(name, { ...signalsByName.get(name), ...s })
      rerender()
    }
    void fetchTrustSignals(pending).then(mergeSignals)
    void fetchDownloadSignals(pending).then(mergeSignals)

    // Install size + license both derive from the same memoized packument, so
    // together they cost one request per package rather than two.
    void fetchInstallSizes(pending).then((sizes) => {
      for (const [name, installSize] of sizes)
        sizeByName.set(name, { ...sizeByName.get(name), installSize })
      rerender()
    })
    void fetchLicenses(pending).then((licenses) => {
      for (const [name, license] of licenses) licenseByName.set(name, license)
      rerender()
    })
  }

  const selected = await searchPrompt({
    message: 'Search npm packages',
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
        // The weekly count leads: it is the one number on the row npm's retired
        // quality/popularity bars used to occupy, and the easiest to scan down.
        trust ? downloadsInline(trust) : '',
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
      // Scrolling drags the eager-signal window along with the focus; already
      // requested rows are skipped, so this stays cheap on every render.
      fetchWindowSignals(name)

      if (bundleRequested.has(name)) return
      bundleRequested.add(name)
      void fetchBundleSize(name).then((bundle) => {
        if (!bundle) return
        sizeByName.set(name, { ...sizeByName.get(name), bundle })
        rerender()
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
        resultNames = []
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
        resultNames = []
        if (debounceTimer) clearTimeout(debounceTimer)

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this
        debounceTimer = setTimeout(async () => {
          searchLoading.value = true
          rerender()
          try {
            const results = await searchPackages(input)
            if (lastSearchTerm !== input) return

            for (const pkg of results) versionCache.set(pkg.name, pkg.version)
            const exactMatch = results.find((pkg) => pkg.name === input)
            searchResults = results
              .filter((pkg) => pkg.name !== input)
              .map((pkg) => toSearchOption(pkg, input))

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
            rerender()

            // Progressive enhancement: fetch the eager signals for the rows the
            // box actually shows (plus a prefetch margin) in the background, and
            // re-render as they arrive. Rows further down fill in on scroll.
            resultNames = updatedOpts.map((opt) => opt.value)
            fetchWindowSignals()
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

    case 'bundle': {
      const target = await pickOrCreateBundle()
      if (!target) {
        clack.outro('Done.')
        return
      }
      // One version policy for the whole selection — the same four strategies
      // `siz add --strategy` accepts, so neither path is the capable one.
      const policy = ensure(
        await clack.select<VersionStrategy>({
          message: 'Version policy',
          options: [
            { value: 'caret', label: 'Track minor (caret ^)', hint: 'resolve fresh on install' },
            { value: 'tilde', label: 'Track patch (tilde ~)', hint: 'resolve fresh on install' },
            { value: 'latest', label: 'Always latest', hint: 'no range recorded' },
            { value: 'exact', label: 'Lock exact version', hint: 'pin the version you saw' },
          ],
        }),
      )
      const entries: BundlePackage[] = selections.map((s) => {
        const depType: BundleDepType = s.dev ? 'devDependencies' : 'dependencies'
        if (policy === 'exact') {
          return { name: s.name, strategy: 'exact', depType, version: versionCache.get(s.name) }
        }
        return { name: s.name, strategy: policy, depType }
      })
      addToBundle(target, entries)
      clack.log.success(`Added ${names.join(', ')} to bundle ${ansis.bold(target)}`)
      clack.outro('Done.')
      return
    }
  }
}

/**
 * Empty-input path: pick from every package saved across all bundles, each row
 * tagged with the bundle it came from. Selections flow into the same action set
 * search selections use.
 */
async function runBrowseSaved(opts: { noRules?: boolean } = {}): Promise<void> {
  const entries = listSavedEntries()

  if (entries.length === 0) {
    clack.log.info('Nothing saved yet. Search, then use "Add to bundle".')
    clack.outro('Done.')
    return
  }

  // Rows are keyed by list position: the same package can be saved in more than
  // one bundle, and bundle names are free-form, so no composed string key is
  // guaranteed unique.
  const selected = ensure(
    await clack.multiselect<number>({
      message: 'Your saved packages',
      required: false,
      options: entries.map((entry, index) => ({
        value: index,
        label: `${entry.name} ${ansis.dim(entry.bundle)}`,
        hint: entry.depType === 'devDependencies' ? 'dev' : undefined,
      })),
    }),
  )

  if (selected.length === 0) {
    clack.outro('Nothing selected.')
    return
  }

  // One install per package name: the same package saved in two bundles collapses
  // to its first entry in the store's order (bundle name, then package name), so
  // which dep type wins is deterministic rather than whichever row came last.
  const selections = new Map<string, Selection>()
  for (const index of selected) {
    const entry = entries[index]
    // The saved view has no Ctrl+T marking, so the stored dep type decides.
    if (!selections.has(entry.name)) {
      selections.set(entry.name, { name: entry.name, dev: entry.depType === 'devDependencies' })
    }
  }
  await runSetAction([...selections.values()], opts)
}

/** Entry point for bare `siz` (and `siz <query>` which seeds the box). */
export async function runInteractive(
  seedQuery?: string,
  opts: { noRules?: boolean } = {},
): Promise<void> {
  clack.intro(ansis.bold.cyan('siz'))
  const result = await openSearchBox(seedQuery)
  switch (result.kind) {
    case 'cancel':
      clack.cancel('Cancelled.')
      return
    case 'empty':
      await runBrowseSaved(opts)
      return
    case 'selected':
      await runSetAction(result.selections, opts)
      return
  }
}
