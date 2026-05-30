import type { SearchResult } from './types.ts'

const SEARCH_ENDPOINT = 'https://registry.npmjs.org/-/v1/search'

/** Build the npm registry search URL for a query. */
export function buildSearchUrl(query: string, size = 20): string {
  const params = new URLSearchParams({
    text: query,
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
 * Search the npm registry. Natural-language queries work because the endpoint
 * already ranks across name/description/keywords.
 */
export async function searchPackages(query: string, size = 20): Promise<SearchResult[]> {
  const res = await fetch(buildSearchUrl(query, size), {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`npm registry search failed: ${res.status} ${res.statusText}`)
  }
  return parseSearchResponse(await res.json())
}
