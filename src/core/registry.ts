import { Fzf } from 'fzf'

import type { SearchResult } from './types.ts'

import { buildRegistryText, parseQuery } from './query.ts'

const SEARCH_ENDPOINT = 'https://registry.npmjs.org/-/v1/search'

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

/** Affinity tiers, highest first: exact name, name prefix, substring. */
const AFFINITY_EXACT = 100
const AFFINITY_PREFIX = 50
const AFFINITY_SUBSTRING = 25
/** Per matched term, so covering more of the query outranks matching one term better. */
const AFFINITY_COVERAGE = 200

/**
 * How strongly one package name matches the query terms. Higher sorts first.
 *
 * Coverage dominates: a name hit by two of three terms outranks one hit by a
 * single term however well, so `react-hook-form` beats a package merely named
 * `form` for `react form validation`. Within equal coverage, each term scores at
 * its best tier — exact, then prefix, then substring — and those tiers sum.
 */
function nameAffinity(name: string, terms: string[]): number {
  const lower = name.toLowerCase()
  // Scoped packages match on their bare name too: `@vue/reactivity` vs `vue`.
  const bare = lower.replace(/^@[^/]+\//, '')
  let score = 0
  for (const raw of terms) {
    const term = raw.toLowerCase()
    if (!term) continue
    let tier = 0
    if (lower === term || bare === term) tier = AFFINITY_EXACT
    else if (lower.startsWith(term) || bare.startsWith(term)) tier = AFFINITY_PREFIX
    else if (lower.includes(term)) tier = AFFINITY_SUBSTRING
    if (tier > 0) score += AFFINITY_COVERAGE + tier
  }
  return score
}

/**
 * Re-order results so the closest package-name matches come first, **without
 * removing any**: the registry already decided what is relevant, so name
 * affinity only ranks. Ordering is affinity, then fuzzy (subsequence) name
 * relevance, then the registry's own score, then the order it returned.
 * Empty terms (a qualifier-only query) pass through untouched.
 */
export function rankByName(results: SearchResult[], terms: string[]): SearchResult[] {
  const query = terms.join(' ').trim()
  if (!query) return results

  // A subsequence tier under the literal tiers, so a single-token query like
  // `rhf` still surfaces `react-hook-form`. It contributes nothing for a
  // multi-word query (package names have no spaces) — affinity carries those.
  // Non-matches simply score 0; nothing is ever dropped.
  const fzf = new Fzf(results, { selector: (r) => r.name })
  const fuzzy = new Map(fzf.find(query).map((entry) => [entry.item.name, entry.score]))

  return results
    .map((item, index) => ({ item, index, affinity: nameAffinity(item.name, terms) }))
    .toSorted((a, b) => {
      if (a.affinity !== b.affinity) return b.affinity - a.affinity
      const fuzzyDelta = (fuzzy.get(b.item.name) ?? 0) - (fuzzy.get(a.item.name) ?? 0)
      if (fuzzyDelta !== 0) return fuzzyDelta
      const scoreDelta = b.item.score.final - a.item.score.final
      if (scoreDelta !== 0) return scoreDelta
      return a.index - b.index
    })
    .map((entry) => entry.item)
}

export interface SearchOptions {
  size?: number
}

/**
 * Search the npm registry with Siz's query grammar.
 *
 * Qualifiers (`keyword:`, `author:`, `scope:`) are sent to the registry, which
 * supports them natively; the free terms drive its full-text search across name
 * *and* description. There is one search: name affinity only re-ranks the
 * results, so every query returns what the registry found.
 */
export async function searchPackages(
  rawQuery: string,
  opts: SearchOptions = {},
): Promise<SearchResult[]> {
  const { size = 20 } = opts
  const parsed = parseQuery(rawQuery)
  const text = buildRegistryText(parsed)

  const res = await fetch(buildSearchUrl(text, size), {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`npm registry search failed: ${res.status} ${res.statusText}`)
  }
  // `size` bounds the fetch; ranking never changes how many results come back.
  return rankByName(parseSearchResponse(await res.json()), parsed.terms)
}
