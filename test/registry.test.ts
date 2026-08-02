import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SearchResult } from '../src/core/types.ts'

import {
  buildSearchUrl,
  filterByName,
  parseSearchObject,
  parseSearchResponse,
  searchPackages,
} from '../src/core/registry.ts'

/** Minimal SearchResult factory for filter/search tests. */
function mkResult(partial: Partial<SearchResult> & { name: string }): SearchResult {
  return {
    version: '1.0.0',
    description: '',
    keywords: [],
    score: { final: 0, quality: 0, popularity: 0, maintenance: 0 },
    searchScore: 0,
    ...partial,
  }
}

describe('buildSearchUrl', () => {
  it('encodes the query into the text param', () => {
    const url = buildSearchUrl('react form validation', 10)
    expect(url).toContain('text=react+form+validation')
    expect(url).toContain('size=10')
    expect(url.startsWith('https://registry.npmjs.org/-/v1/search?')).toBe(true)
  })

  it('clamps size to the registry limits', () => {
    expect(buildSearchUrl('x', 0)).toContain('size=1')
    expect(buildSearchUrl('x', 9999)).toContain('size=250')
  })
})

describe('parseSearchObject', () => {
  it('normalizes a raw registry object and prefers homepage link', () => {
    const result = parseSearchObject({
      package: {
        name: 'zod',
        version: '3.0.0',
        description: 'schema validation',
        keywords: ['validation', 'schema'],
        links: {
          npm: 'https://npm/zod',
          homepage: 'https://zod.dev',
          repository: 'https://gh/zod',
        },
        publisher: { username: 'colinhacks' },
      },
      score: { final: 0.9, detail: { quality: 0.95, popularity: 0.8, maintenance: 0.7 } },
      searchScore: 1234,
    })

    expect(result.name).toBe('zod')
    expect(result.link).toBe('https://zod.dev')
    expect(result.keywords).toEqual(['validation', 'schema'])
    expect(result.score.quality).toBe(0.95)
    expect(result.publisher).toBe('colinhacks')
  })

  it('fills safe defaults for sparse objects', () => {
    const result = parseSearchObject({ package: { name: 'x', version: '1.0.0' } })
    expect(result.description).toBe('')
    expect(result.keywords).toEqual([])
    expect(result.score.final).toBe(0)
    expect(result.link).toBeUndefined()
  })
})

describe('parseSearchResponse', () => {
  it('maps the objects array', () => {
    const results = parseSearchResponse({
      objects: [
        { package: { name: 'a', version: '1.0.0' } },
        { package: { name: 'b', version: '2.0.0' } },
      ],
    })
    expect(results.map((r) => r.name)).toEqual(['a', 'b'])
  })

  it('returns [] for malformed bodies', () => {
    expect(parseSearchResponse(null)).toEqual([])
    expect(parseSearchResponse({})).toEqual([])
    expect(parseSearchResponse({ objects: 'nope' })).toEqual([])
  })
})

describe('filterByName', () => {
  const results = [
    mkResult({ name: 'react', score: { final: 0.9, quality: 0, popularity: 0, maintenance: 0 } }),
    mkResult({ name: 'preact', score: { final: 0.5, quality: 0, popularity: 0, maintenance: 0 } }),
    // Matches only via description — must be excluded by name filtering.
    mkResult({ name: 'zustand', description: 'a small react state library' }),
  ]

  it('keeps only name matches and ignores description-only matches', () => {
    const names = filterByName(results, ['react']).map((r) => r.name)
    expect(names).toContain('react')
    expect(names).not.toContain('zustand')
  })

  it('passes through (optionally limited) when there are no terms', () => {
    expect(filterByName(results, [])).toHaveLength(3)
    expect(filterByName(results, [], 2)).toHaveLength(2)
  })

  it('respects the limit', () => {
    expect(filterByName(results, ['react'], 1)).toHaveLength(1)
  })
})

/** Stub global fetch with a registry response containing the given package names. */
function mockFetch(names: string[]) {
  const body = {
    objects: names.map((name) => ({
      package: { name, version: '1.0.0', description: `${name} desc` },
    })),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => body }) as unknown as Response),
  )
}

describe('searchPackages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('name mode restricts results to name matches', async () => {
    mockFetch(['react', 'preact', 'vue'])
    const results = await searchPackages('react', { mode: 'name' })
    expect(results.map((r) => r.name)).not.toContain('vue')
    expect(results.map((r) => r.name)).toContain('react')
  })

  it('description mode keeps the registry ordering', async () => {
    mockFetch(['react', 'preact', 'vue'])
    const results = await searchPackages('react', { mode: 'description' })
    expect(results.map((r) => r.name)).toEqual(['react', 'preact', 'vue'])
  })

  it('no longer filters results client-side for a category: token', async () => {
    mockFetch(['react', 'lodash'])
    const results = await searchPackages('category:frontend', { mode: 'description' })
    expect(results.map((r) => r.name)).toEqual(['react', 'lodash'])
  })

  it('sends qualifier-only queries to the registry and passes results through', async () => {
    let calledUrl = ''
    const fetchMock = vi.fn(async (url: string) => {
      calledUrl = String(url)
      return {
        ok: true,
        json: async () => ({ objects: [{ package: { name: 'cmd', version: '1.0.0' } }] }),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    const results = await searchPackages('keyword:cli', { mode: 'name' })
    expect(calledUrl).toContain('keywords%3Acli')
    expect(results.map((r) => r.name)).toEqual(['cmd'])
  })
})
