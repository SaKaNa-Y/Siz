import ansis from 'ansis'

import type { TrustSignals } from '../core/types.ts'

import { fetchLicenses } from '../core/license.ts'
import { searchPackages } from '../core/registry.ts'
import { fetchInstallSizes } from '../core/size.ts'
import { fetchDownloadSignals, fetchTrustSignals } from '../core/trust.ts'
import { renderSearchResult } from '../ui/render.ts'

export interface SearchPrintOptions {
  size?: number
  json?: boolean
}

/** Non-interactive search output for `siz <query> --list` / `--json`. */
export async function runSearchPrint(query: string, opts: SearchPrintOptions = {}): Promise<void> {
  const results = await searchPackages(query, { size: opts.size })
  const names = results.map((r) => r.name)
  // Independent sources (metadata + download API + packument), fetched in
  // parallel. Install size and license both derive from the packument, so they
  // share one memoized request per package. Bundle size is interactive-focus-only
  // — never fetched here, so --list/--json stay fast and off Bundlephobia's
  // rate limit.
  const [trust, trend, installSizes, licenses] = await Promise.all([
    fetchTrustSignals(names),
    fetchDownloadSignals(names),
    fetchInstallSizes(names),
    fetchLicenses(names),
  ])
  const signals = new Map<string, TrustSignals>()
  for (const name of names) {
    const merged = { ...trust.get(name), ...trend.get(name) }
    if (Object.keys(merged).length > 0) signals.set(name, merged)
  }

  if (opts.json) {
    // Merge trust signals + install size + license additively onto each result for
    // scripting. The license key is deliberately three-valued: a string when
    // declared, an explicit `null` when the manifest declared none, and absent
    // entirely when the packument never resolved — so a consumer can tell "no
    // license" from "siz could not check". `downloads` follows the same rule:
    // present when known, absent rather than zero when not.
    //
    // `searchScore` is dropped: it is the registry's internal relevance number,
    // kept only as the ranking tiebreaker, and never part of the public shape.
    const enriched = results.map(({ searchScore: _searchScore, ...r }) => ({
      ...r,
      ...signals.get(r.name),
      ...(installSizes.has(r.name) ? { installSize: installSizes.get(r.name) } : {}),
      ...licenses.get(r.name),
    }))
    console.log(JSON.stringify(enriched, null, 2))
    return
  }

  if (results.length === 0) {
    console.log(ansis.yellow(`No packages found for "${query}".`))
    return
  }

  for (const r of results) {
    console.log(
      renderSearchResult(r, {
        signals: signals.get(r.name),
        size: installSizes.has(r.name) ? { installSize: installSizes.get(r.name) } : undefined,
        license: licenses.get(r.name),
      }),
    )
    console.log('')
  }
}
