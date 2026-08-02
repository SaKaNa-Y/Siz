import { Fzf } from 'fzf'

import type { SearchResult } from './types.ts'

import { buildRegistryText, parseQuery } from './query.ts'

const SEARCH_ENDPOINT = 'https://registry.npmjs.org/-/v1/search'

/** How matching is applied to a search. */
export type SearchMode = 'name' | 'description'

/** Build the npm registry search URL for an already-assembled text query. */
export function buildSearchUrl(text: string, size = 20): string {
  const params = new URLSearchParams({
    text,
    size: String(Math.min(Math.max(size, 1), 250)),
  })
  return `${SEARCH_ENDPOINT}?${params.toString()}`
}

/** Shape of a single object in the registry search response. */
interface RawSearchObject {
  package: {
    name: string
    version: string
    description?: string
    keywords?: string[]
    links?: { npm?: string; homepage?: string; repository?: string }
    publisher?: { username?: string }
  }
  score?: {
    final?: number
    detail?: { quality?: number; popularity?: number; maintenance?: number }
  }
  searchScore?: number
}

/** Normalize a raw registry object into our SearchResult shape. */
export function parseSearchObject(obj: RawSearchObject): SearchResult {
  const pkg = obj.package
  const links = pkg.links ?? {}
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description ?? '',
    keywords: pkg.keywords ?? [],
    link: links.homepage || links.repository || links.npm,
    npmLink: links.npm,
    publisher: pkg.publisher?.username,
    score: {
      final: obj.score?.final ?? 0,
      quality: obj.score?.detail?.quality ?? 0,
      popularity: obj.score?.detail?.popularity ?? 0,
      maintenance: obj.score?.detail?.maintenance ?? 0,
    },
    searchScore: obj.searchScore ?? 0,
  }
}

/** Parse a full registry search response body into results. */
export function parseSearchResponse(body: unknown): SearchResult[] {
  const objects = (body as { objects?: RawSearchObject[] })?.objects
  if (!Array.isArray(objects)) return []
  return objects.map(parseSearchObject)
}

/**
 * Keep only results whose package *name* matches the given terms, ranked by
 * fuzzy relevance (fzf) with the registry's final score as a tiebreaker.
 * Descriptions are deliberately ignored here. Empty terms pass through.
 */
export function filterByName(
  results: SearchResult[],
  terms: string[],
  limit?: number,
): SearchResult[] {
  const query = terms.join(' ').trim()
  if (!query) return limit ? results.slice(0, limit) : results

  const fzf = new Fzf(results, {
    selector: (r) => r.name,
    tiebreakers: [(a, b) => b.item.score.final - a.item.score.final],
  })
  const ranked = fzf.find(query).map((entry) => entry.item)
  return limit ? ranked.slice(0, limit) : ranked
}

export interface SearchOptions {
  size?: number
  mode?: SearchMode
}

/**
 * Search the npm registry with Siz's query grammar.
 *
 * - Qualifiers (`keyword:`, `author:`, `scope:`) are sent to the registry,
 *   which supports them natively.
 * - In `name` mode, results are restricted/ranked to package-name matches and
 *   descriptions are not used for matching. `description` mode keeps the
 *   registry's full-text ranking.
 */
export async function searchPackages(
  rawQuery: string,
  opts: SearchOptions = {},
): Promise<SearchResult[]> {
  const { size = 20, mode = 'name' } = opts
  const parsed = parseQuery(rawQuery)
  const text = buildRegistryText(parsed)

  const res = await fetch(buildSearchUrl(text, size), {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`npm registry search failed: ${res.status} ${res.statusText}`)
  }
  let results = parseSearchResponse(await res.json())

  // Name mode narrows to name matches; an empty term list (qualifier-only
  // query) passes through so e.g. `keyword:cli` still returns its results.
  if (mode === 'name') {
    results = filterByName(results, parsed.terms, size)
  }

  return results
}
