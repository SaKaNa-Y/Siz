import ansis from 'ansis'

import { type SearchMode, searchPackages } from '../core/registry.ts'
import { listFavorites } from '../core/store.ts'
import { fetchTrustSignals } from '../core/trust.ts'
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
  const signals = await fetchTrustSignals(results.map((r) => r.name))

  if (opts.json) {
    // Merge trust signals additively onto each result for scripting.
    const enriched = results.map((r) => ({
      ...r,
      ...signals.get(r.name),
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
      }),
    )
    console.log('')
  }
}
