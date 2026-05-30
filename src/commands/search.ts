import ansis from 'ansis'
import { searchPackages } from '../core/registry.ts'
import { listPackages } from '../core/store.ts'
import type { SearchResult } from '../core/types.ts'
import { renderSearchResult } from '../ui/render.ts'

export interface SearchPrintOptions {
  size?: number
  json?: boolean
}

/** Non-interactive search output for `siz <query> --list` / `--json`. */
export async function runSearchPrint(query: string, opts: SearchPrintOptions = {}): Promise<void> {
  const results = await searchPackages(query, opts.size)

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  if (results.length === 0) {
    console.log(ansis.yellow(`No packages found for "${query}".`))
    return
  }

  const trackedNames = new Set(listPackages().map((p) => p.name))
  for (const r of results as SearchResult[]) {
    console.log(renderSearchResult(r, { tracked: trackedNames.has(r.name) }))
    console.log('')
  }
}
