import { describe, expect, it } from 'vitest'

import { normalizeCategory, suggestCategory } from '../src/core/categories.ts'

describe('suggestCategory', () => {
  it('detects testing tools', () => {
    expect(suggestCategory({ name: 'vitest', description: 'a test framework' })).toBe('Testing')
  })

  it('detects state management', () => {
    expect(suggestCategory({ name: 'pinia', keywords: ['store', 'vue'] })).toBe('State Management')
  })

  it('detects frontend frameworks', () => {
    expect(
      suggestCategory({
        name: 'react',
        description: 'A JavaScript library for building user interfaces',
      }),
    ).toBe('Frontend')
  })

  it('detects CLI tools', () => {
    expect(suggestCategory({ name: 'cac', description: 'command line argument parser' })).toBe(
      'CLI Tools',
    )
  })

  it('returns undefined when nothing matches', () => {
    expect(suggestCategory({ name: 'zzz', description: 'nothing relevant here' })).toBeUndefined()
  })
})

describe('normalizeCategory', () => {
  it('resolves case-insensitively to a canonical category', () => {
    expect(normalizeCategory('frontend')).toBe('Frontend')
    expect(normalizeCategory('  BUILD TOOLS ')).toBe('Build Tools')
  })

  it('returns undefined for unknown categories', () => {
    expect(normalizeCategory('quantum')).toBeUndefined()
  })
})
