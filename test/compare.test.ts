import { describe, expect, it } from 'vitest'

import type { VersionInfo } from '../src/core/compare.ts'
import type { DepType, ProjectDep } from '../src/core/project.ts'

import { compareDep } from '../src/core/compare.ts'

function info(
  name: string,
  versions: string[],
  latest = versions[versions.length - 1],
): VersionInfo {
  return { name, versions, latest, exists: true }
}

function dep(name: string, range: string, depType: DepType = 'dependencies'): ProjectDep {
  return { name, range, depType }
}

describe('compareDep', () => {
  it('skips non-registry protocols', () => {
    const r = compareDep(dep('ui', 'workspace:*'), info('ui', ['1.0.0']))
    expect(r).toEqual({ kind: 'skipped', reason: 'protocol' })
  })

  it('skips packages missing from the registry', () => {
    expect(compareDep(dep('ghost', '^1.0.0'), undefined)).toEqual({
      kind: 'skipped',
      reason: 'not-found',
    })
    expect(
      compareDep(dep('ghost', '^1.0.0'), {
        name: 'ghost',
        versions: [],
        latest: null,
        exists: false,
      }),
    ).toEqual({ kind: 'skipped', reason: 'not-found' })
  })

  it('skips ranges whose floor cannot be parsed', () => {
    const r = compareDep(dep('weird', 'garbage'), info('weird', ['1.0.0']))
    expect(r).toEqual({ kind: 'skipped', reason: 'unparseable' })
  })

  it('returns neutral facts for a simple caret range', () => {
    const r = compareDep(dep('react', '^17.0.0'), info('react', ['17.0.0', '17.0.2', '18.0.0']))
    expect(r.kind).toBe('comparison')
    if (r.kind !== 'comparison') return
    expect(r.facts.current).toBe('17.0.0')
    expect(r.facts.latest).toBe('18.0.0')
    expect(r.facts.latestDiff).toBe('major')
    expect(r.facts.prefix).toBe('^')
    expect(r.facts.currentIsPre).toBe(false)
    expect(r.facts.candidates).toEqual(['17.0.0', '17.0.2', '18.0.0'])
  })

  it('reports a complex range as a FACT, not a skip', () => {
    const r = compareDep(dep('foo', '>=1.0.0 <2.0.0'), info('foo', ['1.0.0', '1.5.0']))
    expect(r.kind).toBe('comparison')
    if (r.kind !== 'comparison') return
    expect(r.facts.prefix).toBe('complex')
    expect(r.facts.current).toBe('1.0.0')
  })

  it('latestDiff is null when there is no valid latest', () => {
    const r = compareDep(dep('foo', '^1.0.0'), {
      name: 'foo',
      versions: ['1.0.0'],
      latest: null,
      exists: true,
    })
    expect(r.kind).toBe('comparison')
    if (r.kind !== 'comparison') return
    expect(r.facts.latestDiff).toBeNull()
  })

  it('excludes prereleases from candidates when current is stable', () => {
    const r = compareDep(dep('foo', '^1.0.0'), info('foo', ['1.0.0', '1.1.0-beta.1', '1.2.0']))
    expect(r.kind).toBe('comparison')
    if (r.kind !== 'comparison') return
    expect(r.facts.candidates).toEqual(['1.0.0', '1.2.0'])
  })

  it('keeps prereleases in candidates when current is itself a prerelease', () => {
    const r = compareDep(
      dep('foo', '1.0.0-rc.1'),
      info('foo', ['1.0.0-rc.1', '1.0.0-rc.2', '1.0.0']),
    )
    expect(r.kind).toBe('comparison')
    if (r.kind !== 'comparison') return
    expect(r.facts.currentIsPre).toBe(true)
    expect(r.facts.candidates).toContain('1.0.0-rc.2')
  })
})
