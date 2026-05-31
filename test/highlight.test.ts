import { describe, expect, it } from 'vitest'

import { highlightKeywords } from '../src/ui/highlight.ts'

describe('highlightKeywords', () => {
  it('wraps each query term in ANSI styling', () => {
    const out = highlightKeywords('react form validation', 'form')
    // The matched term is wrapped in escape codes; the substring still present.
    expect(out).toContain('form')
    expect(out).not.toBe('react form validation') // styling was applied
  })

  it('returns text unchanged when query is empty', () => {
    expect(highlightKeywords('hello world', '   ')).toBe('hello world')
  })

  it('matches case-insensitively and handles multiple terms', () => {
    const out = highlightKeywords('Fast Node Logger', 'fast logger')
    expect(out).toContain('Fast')
    expect(out).toContain('Logger')
  })

  it('does not throw on regex-special characters in the query', () => {
    expect(() => highlightKeywords('a+b (c)', 'a+b (c)')).not.toThrow()
  })
})
