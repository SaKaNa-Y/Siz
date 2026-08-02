import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SearchResult } from '../src/core/types.ts'

import {
  buildSearchUrl,
  parseSearchObject,
  parseSearchResponse,
  rankByName,
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

describe('rankByName', () => {
  const results = [
    mkResult({ name: 'zustand', description: 'a small react state library' }),
    mkResult({ name: 'preact', score: { final: 0.5, quality: 0, popularity: 0, maintenance: 0 } }),
    mkResult({ name: 'react', score: { final: 0.9, quality: 0, popularity: 0, maintenance: 0 } }),
  ]

  it('sorts the exact name match first', () => {
    expect(rankByName(results, ['react'])[0].name).toBe('react')
  })

  it('keeps every result, including name non-matches', () => {
    const ranked = rankByName(results, ['react'])
    expect(ranked).toHaveLength(3)
    expect(ranked.map((r) => r.name).toSorted()).toEqual(['preact', 'react', 'zustand'])
  })

  it('ranks a name-prefix match above a mere substring match', () => {
    const ranked = rankByName(results, ['reac']).map((r) => r.name)
    expect(ranked.indexOf('react')).toBeLessThan(ranked.indexOf('preact'))
  })

  it('ranks broader query coverage above a single better-tier match', () => {
    const multi = [
      mkResult({ name: 'form' }), // exact — but matches one term of three
      mkResult({ name: 'react-hook-form' }), // prefix + substring — two terms
    ]
    expect(rankByName(multi, ['react', 'form', 'validation'])[0].name).toBe('react-hook-form')
  })

  it('breaks ties on the registry score', () => {
    const tied = [
      mkResult({ name: 'b-cli', score: { final: 0.1, quality: 0, popularity: 0, maintenance: 0 } }),
      mkResult({ name: 'a-cli', score: { final: 0.8, quality: 0, popularity: 0, maintenance: 0 } }),
    ]
    expect(rankByName(tied, ['cli']).map((r) => r.name)).toEqual(['a-cli', 'b-cli'])
  })

  it('passes results through untouched when there are no terms', () => {
    expect(rankByName(results, []).map((r) => r.name)).toEqual(['zustand', 'preact', 'react'])
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

  it('ranks the closest name match first without dropping the rest', async () => {
    mockFetch(['vue', 'preact', 'react'])
    const results = await searchPackages('react')
    expect(results[0].name).toBe('react')
    expect(results).toHaveLength(3)
  })

  it('returns results for a multi-word query (no name-only filtering)', async () => {
    mockFetch(['react-hook-form', 'formik', 'zod'])
    const results = await searchPackages('react form validation')
    expect(results).toHaveLength(3)
    expect(results[0].name).toBe('react-hook-form')
  })

  it('returns results for a descriptive phrase query', async () => {
    mockFetch(['zustand', 'jotai', 'redux'])
    const results = await searchPackages('state management')
    expect(results.map((r) => r.name)).toEqual(['zustand', 'jotai', 'redux'])
  })

  it('preserves the number of results the registry returned', async () => {
    mockFetch(['a', 'b', 'c', 'd'])
    expect(await searchPackages('react')).toHaveLength(4)
  })

  it('bounds the fetch by the requested size', async () => {
    let calledUrl = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calledUrl = String(url)
        return { ok: true, json: async () => ({ objects: [] }) } as unknown as Response
      }),
    )
    await searchPackages('react', { size: 5 })
    expect(calledUrl).toContain('size=5')
  })

  it('no longer filters results client-side for a category: token', async () => {
    mockFetch(['react', 'lodash'])
    const results = await searchPackages('category:frontend')
    expect(results.map((r) => r.name).toSorted()).toEqual(['lodash', 'react'])
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
    const results = await searchPackages('keyword:cli')
    expect(calledUrl).toContain('keywords%3Acli')
    expect(results.map((r) => r.name)).toEqual(['cmd'])
  })
})
