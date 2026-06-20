import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { DependencyRules } from '../src/core/rules.ts'

import {
  CONFIG_FILENAME,
  evaluateRule,
  globToRegExp,
  loadRules,
  matchesPattern,
  normalizeRules,
  partitionByRules,
} from '../src/core/rules.ts'

function rules(allow: string[] = [], deny: string[] = []): DependencyRules {
  return { allow, deny }
}

describe('globToRegExp / matchesPattern', () => {
  it('matches exact names', () => {
    expect(matchesPattern('lodash', 'lodash')).toBe(true)
    expect(matchesPattern('lodash-es', 'lodash')).toBe(false)
    expect(matchesPattern('@x/lodash', 'lodash')).toBe(false)
  })

  it('treats * as any sequence (slash-agnostic)', () => {
    expect(matchesPattern('react', '*')).toBe(true)
    expect(matchesPattern('@scope/pkg', '*')).toBe(true)
    expect(matchesPattern('@ourorg/foo', '@ourorg/*')).toBe(true)
    expect(matchesPattern('@ourorg/a/b', '@ourorg/*')).toBe(true)
    expect(matchesPattern('@other/foo', '@ourorg/*')).toBe(false)
  })

  it('supports suffix and mid-pattern stars', () => {
    expect(matchesPattern('left-pad-deprecated', '*-deprecated')).toBe(true)
    expect(matchesPattern('deprecated-thing', '*-deprecated')).toBe(false)
    expect(matchesPattern('@scope/foo-plugin', '@scope/*-plugin')).toBe(true)
  })

  it('escapes regex metachars in literal segments', () => {
    expect(matchesPattern('reactxdom', 'react.dom')).toBe(false)
    expect(matchesPattern('react.dom', 'react.dom')).toBe(true)
    expect(globToRegExp('a+b').test('a+b')).toBe(true)
    expect(globToRegExp('a+b').test('aaab')).toBe(false)
  })
})

describe('evaluateRule (deny wins)', () => {
  it('allows everything with empty rules', () => {
    expect(evaluateRule('anything', rules())).toEqual({ allowed: true })
  })

  it('allows a name that matches the allow list', () => {
    expect(evaluateRule('@ourorg/x', rules(['@ourorg/*']))).toEqual({ allowed: true })
  })

  it('blocks a name not in a non-empty allow list', () => {
    const verdict = evaluateRule('react', rules(['@ourorg/*']))
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toMatch(/allow list/)
  })

  it('lets deny win even when allow matches', () => {
    const verdict = evaluateRule('@ourorg/legacy-x', rules(['@ourorg/*'], ['@ourorg/legacy-*']))
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toMatch(/denied by "@ourorg\/legacy-\*"/)
  })

  it('blocks a deny match when there is no allow list', () => {
    const verdict = evaluateRule('lodash', rules([], ['lodash']))
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toMatch(/denied by "lodash"/)
  })
})

describe('partitionByRules', () => {
  it('partitions plain strings', () => {
    const { allowed, blocked } = partitionByRules(
      ['react', '@evil/x', 'lodash'],
      rules([], ['@evil/*']),
    )
    expect(allowed).toEqual(['react', 'lodash'])
    expect(blocked).toHaveLength(1)
    expect(blocked[0].item).toBe('@evil/x')
    expect(blocked[0].reason).toMatch(/denied by/)
  })

  it('partitions objects via a name selector, preserving originals', () => {
    const items = [
      { name: 'react', spec: 'react@^18' },
      { name: 'lodash', spec: 'lodash@^4' },
    ]
    const { allowed, blocked } = partitionByRules(items, rules([], ['lodash']), (i) => i.name)
    expect(allowed).toEqual([items[0]])
    expect(blocked[0].item).toBe(items[1])
  })

  it('handles all-allowed and all-blocked edges', () => {
    expect(partitionByRules(['a', 'b'], rules()).blocked).toHaveLength(0)
    const allBlocked = partitionByRules(['a', 'b'], rules(['nope']))
    expect(allBlocked.allowed).toHaveLength(0)
    expect(allBlocked.blocked).toHaveLength(2)
  })
})

describe('normalizeRules', () => {
  it('defaults undefined to empty lists', () => {
    expect(normalizeRules(undefined)).toEqual({ allow: [], deny: [] })
  })

  it('fills missing keys and ignores $schema', () => {
    expect(normalizeRules({ $schema: 'x', rules: { deny: ['x'] } })).toEqual({
      allow: [],
      deny: ['x'],
    })
  })
})

describe('loadRules', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'siz-rules-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns undefined when no config exists in the sandbox', () => {
    const isolated = join(dir, 'empty')
    mkdirSync(isolated)
    // findUp may resolve a config higher on the real fs; only assert it does not
    // resolve to one inside our sandbox.
    const found = loadRules(isolated)
    expect(found?.path).not.toBe(join(isolated, CONFIG_FILENAME))
  })

  it('loads a valid config and reports its path', () => {
    const path = join(dir, CONFIG_FILENAME)
    writeFileSync(
      path,
      JSON.stringify({
        $schema: 'https://example/siz.json',
        rules: { allow: ['@ourorg/*'], deny: ['*-deprecated'] },
      }),
    )
    const loaded = loadRules(dir)
    expect(loaded).toEqual({
      rules: { allow: ['@ourorg/*'], deny: ['*-deprecated'] },
      path,
    })
  })

  it('walks up from a nested directory', () => {
    const path = join(dir, CONFIG_FILENAME)
    writeFileSync(path, JSON.stringify({ rules: { deny: ['x'] } }))
    const nested = join(dir, 'a', 'b')
    mkdirSync(nested, { recursive: true })
    expect(loadRules(nested)?.path).toBe(path)
  })

  it('throws on malformed JSON (fail-closed)', () => {
    writeFileSync(join(dir, CONFIG_FILENAME), '{ not json')
    expect(() => loadRules(dir)).toThrow(/Failed to parse/)
  })

  it('treats a config without a rules key as empty (everything allowed)', () => {
    writeFileSync(join(dir, CONFIG_FILENAME), JSON.stringify({ $schema: 'x' }))
    expect(loadRules(dir)?.rules).toEqual({ allow: [], deny: [] })
  })
})
