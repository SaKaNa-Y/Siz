import ansis from 'ansis'

import type { SearchResult } from '../core/types.ts'

import { type SearchMode, searchPackages } from '../core/registry.ts'
import { listPackages } from '../core/store.ts'
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

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  if (results.length === 0) {
    console.log(ansis.yellow(`No packages found for "${query}".`))
    return
  }

  // Name mode hides descriptions/keywords to match the interactive behavior.
  const showDescription = mode === 'description'
  const trackedNames = new Set(listPackages().map((p) => p.name))
  for (const r of results as SearchResult[]) {
    console.log(renderSearchResult(r, { tracked: trackedNames.has(r.name), showDescription }))
    console.log('')
  }
}
