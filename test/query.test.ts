import { describe, expect, it } from 'vitest'
import { buildRegistryText, parseQuery } from '../src/core/query.ts'

describe('parseQuery', () => {
  it('treats bare tokens as terms', () => {
    const q = parseQuery('react form validation')
    expect(q.terms).toEqual(['react', 'form', 'validation'])
    expect(q.qualifiers).toEqual({})
  })

  it('parses keyword qualifiers and aliases (keyword/keywords/kw)', () => {
    expect(parseQuery('keyword:cli').qualifiers.keyword).toEqual(['cli'])
    expect(parseQuery('keywords:cli').qualifiers.keyword).toEqual(['cli'])
    expect(parseQuery('kw:cli').qualifiers.keyword).toEqual(['cli'])
  })

  it('accumulates comma-separated and repeated keyword values', () => {
    expect(parseQuery('keyword:a,b').qualifiers.keyword).toEqual(['a', 'b'])
    expect(parseQuery('kw:a keyword:b').qualifiers.keyword).toEqual(['a', 'b'])
  })

  it('parses category (and cat alias), author, and scope', () => {
    expect(parseQuery('category:frontend').qualifiers.category).toBe('frontend')
    expect(parseQuery('cat:frontend').qualifiers.category).toBe('frontend')
    expect(parseQuery('author:sindresorhus').qualifiers.author).toBe('sindresorhus')
    expect(parseQuery('scope:@vue').qualifiers.scope).toBe('vue')
  })

  it('separates plain terms from qualifiers in a mixed query', () => {
    const q = parseQuery('zod category:frontend keyword:schema')
    expect(q.terms).toEqual(['zod'])
    expect(q.qualifiers.category).toBe('frontend')
    expect(q.qualifiers.keyword).toEqual(['schema'])
  })

  it('keeps tokens with empty values or unknown keys as plain terms', () => {
    expect(parseQuery('keyword:').terms).toEqual(['keyword:'])
    expect(parseQuery('unknown:value').terms).toEqual(['unknown:value'])
    // Scoped package names (no colon) stay terms.
    expect(parseQuery('@vue/reactivity').terms).toEqual(['@vue/reactivity'])
  })
})

describe('buildRegistryText', () => {
  it('round-trips bare terms unchanged', () => {
    expect(buildRegistryText(parseQuery('react form'))).toBe('react form')
  })

  it('emits native npm qualifiers and joins keywords with commas', () => {
    const text = buildRegistryText(parseQuery('cli keyword:a,b author:foo scope:@vue'))
    expect(text).toContain('cli')
    expect(text).toContain('keywords:a,b')
    expect(text).toContain('author:foo')
    expect(text).toContain('scope:vue')
  })

  it('omits category (filtered client-side, not sent to the registry)', () => {
    expect(buildRegistryText(parseQuery('category:frontend'))).toBe('')
  })

  it('folds tag values into the keywords qualifier', () => {
    expect(buildRegistryText(parseQuery('tag:cli'))).toBe('keywords:cli')
  })
})
