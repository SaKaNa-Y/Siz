import { describe, expect, it } from 'vitest'
import { buildSearchUrl, parseSearchObject, parseSearchResponse } from '../src/core/registry.ts'

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
        links: { npm: 'https://npm/zod', homepage: 'https://zod.dev', repository: 'https://gh/zod' },
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
