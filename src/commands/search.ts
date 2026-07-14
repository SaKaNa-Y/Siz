import ansis from 'ansis'

import type { TrustSignals } from '../core/types.ts'

import { type SearchMode, searchPackages } from '../core/registry.ts'
import { fetchInstallSizes } from '../core/size.ts'
import { listFavorites } from '../core/store.ts'
import { fetchDownloadTrend, fetchTrustSignals } from '../core/trust.ts'
import { renderSearchResult } from '../ui/render.ts'

export interface SearchPrintOptions {
  size?: number
  json?: boolean
  mode?: SearchMode
}

/** Non-interactive search output for `siz <query> --list` / `--json`. */
export async function runSearchPrint(query: string, opts: SearchPrintOptions = {}): Promise<void> {
  const mode = opts.mode ?? 'name'
  const results = await searchPackages(query, { size: opts.size, mode })
  const names = results.map((r) => r.name)
  // Independent sources (metadata + download API + packument install size),
  // fetched in parallel. Bundle size is interactive-focus-only — never fetched
  // here, so --list/--json stay fast and off Bundlephobia's rate limit.
  const [trust, trend, installSizes] = await Promise.all([
    fetchTrustSignals(names),
    fetchDownloadTrend(names),
    fetchInstallSizes(names),
  ])
  const signals = new Map<string, TrustSignals>()
  for (const name of names) {
    const merged = { ...trust.get(name), ...trend.get(name) }
    if (Object.keys(merged).length > 0) signals.set(name, merged)
  }

  if (opts.json) {
    // Merge trust signals + install size additively onto each result for scripting.
    const enriched = results.map((r) => ({
      ...r,
      ...signals.get(r.name),
      ...(installSizes.has(r.name) ? { installSize: installSizes.get(r.name) } : {}),
    }))
    console.log(JSON.stringify(enriched, null, 2))
    return
  }

  if (results.length === 0) {
    console.log(ansis.yellow(`No packages found for "${query}".`))
    return
  }

  // Name mode hides descriptions/keywords to match the interactive behavior.
  const showDescription = mode === 'description'
  const favoriteNames = new Set(listFavorites().map((p) => p.name))
  for (const r of results) {
    console.log(
      renderSearchResult(r, {
        favorite: favoriteNames.has(r.name),
        showDescription,
        signals: signals.get(r.name),
        size: installSizes.has(r.name) ? { installSize: installSizes.get(r.name) } : undefined,
      }),
    )
    console.log('')
  }
}
