import { describe, expect, it } from 'vitest'

import type { VersionInfo } from '../src/core/compare.ts'
import type { ProjectDep, ProjectManifest } from '../src/core/project.ts'

import { applyPrefix, currentVersionFromRange, detectRangePrefix } from '../src/core/compare.ts'
import { collectQueryNames } from '../src/core/resolve.ts'
import { analyzeDep, buildUpgradePlan, planManifests, resolveTarget } from '../src/core/upgrade.ts'

function info(
  name: string,
  versions: string[],
  latest = versions[versions.length - 1],
): VersionInfo {
  return { name, versions, latest, exists: true }
}

function dep(name: string, range: string, devDep = false): ProjectDep {
  return { name, range, depType: devDep ? 'devDependencies' : 'dependencies' }
}

function manifest(path: string, deps: ProjectDep[]): ProjectManifest {
  return { path, raw: '', data: {}, deps }
}

describe('currentVersionFromRange', () => {
  it('reads the floor of common ranges', () => {
    expect(currentVersionFromRange('^1.2.3')).toBe('1.2.3')
    expect(currentVersionFromRange('~2.0.0')).toBe('2.0.0')
    expect(currentVersionFromRange('3.1.4')).toBe('3.1.4')
    expect(currentVersionFromRange('>=2.0.0 <3.0.0')).toBe('2.0.0')
  })

  it('returns null for unparseable specifiers', () => {
    expect(currentVersionFromRange('workspace:*')).toBeNull()
    expect(currentVersionFromRange('not-a-version')).toBeNull()
  })
})

describe('detectRangePrefix / applyPrefix', () => {
  it('classifies and round-trips prefixes', () => {
    expect(detectRangePrefix('^1.2.3')).toBe('^')
    expect(detectRangePrefix('~1.2.3')).toBe('~')
    expect(detectRangePrefix('1.2.3')).toBe('')
    expect(detectRangePrefix('>=1 <2')).toBe('complex')
    expect(detectRangePrefix('1.x')).toBe('complex')

    expect(applyPrefix('^', '1.5.0')).toBe('^1.5.0')
    expect(applyPrefix('~', '1.5.0')).toBe('~1.5.0')
    expect(applyPrefix('', '1.5.0')).toBe('1.5.0')
  })
})

describe('resolveTarget (ceiling semantics)', () => {
  const vi = info('pkg', ['1.2.3', '1.2.9', '1.5.0', '2.0.0', '2.1.0'])

  it('patch stays within the same major.minor', () => {
    expect(resolveTarget('1.2.3', vi, 'patch')).toBe('1.2.9')
  })

  it('minor stays within the same major', () => {
    expect(resolveTarget('1.2.3', vi, 'minor')).toBe('1.5.0')
  })

  it('major/latest reach the newest stable', () => {
    expect(resolveTarget('1.2.3', vi, 'major')).toBe('2.1.0')
    expect(resolveTarget('1.2.3', vi, 'latest')).toBe('2.1.0')
  })

  it('treats pre-1.0 minor bumps as breaking (caret on 0.x stays in 0.minor)', () => {
    const zero = info('z', ['0.4.0', '0.4.5', '0.5.0'])
    expect(resolveTarget('0.4.0', zero, 'minor')).toBe('0.4.5')
    expect(resolveTarget('0.4.0', zero, 'patch')).toBe('0.4.5')
    // major/latest may still cross the 0.x boundary on request.
    expect(resolveTarget('0.4.0', zero, 'major')).toBe('0.5.0')
  })

  it('excludes prereleases unless the current version is one', () => {
    const pre = info('p', ['1.0.0', '1.1.0', '2.0.0-beta.1'])
    expect(resolveTarget('1.0.0', pre, 'latest')).toBe('1.1.0')

    const fromPre = info('p', ['1.0.0-beta.1', '1.0.0-beta.2', '1.0.0'])
    expect(resolveTarget('1.0.0-beta.1', fromPre, 'latest')).toBe('1.0.0')
  })

  it('returns null when there are no usable candidates', () => {
    expect(resolveTarget('1.0.0', info('x', []), 'latest')).toBeNull()
  })
})

describe('analyzeDep', () => {
  it('produces a target and diff for an outdated dep', () => {
    const a = analyzeDep(dep('vue', '^3.4.0'), info('vue', ['3.4.0', '3.5.13', '4.0.0']), 'minor')
    expect(a.skip).toBeUndefined()
    expect(a.current).toBe('3.4.0')
    expect(a.target).toBe('3.5.13')
    expect(a.diff).toBe('minor')
    expect(a.latest).toBe('4.0.0')
    expect(a.latestDiff).toBe('major')
  })

  it('marks up-to-date deps', () => {
    const a = analyzeDep(dep('vue', '^3.5.13'), info('vue', ['3.5.0', '3.5.13']), 'latest')
    expect(a.skip).toBe('up-to-date')
    expect(a.target).toBeNull()
  })

  it('skips protocol specifiers', () => {
    expect(analyzeDep(dep('ui', 'workspace:*'), undefined, 'latest').skip).toBe('protocol')
    expect(analyzeDep(dep('x', 'catalog:'), undefined, 'latest').skip).toBe('protocol')
  })

  it('skips packages missing from the registry', () => {
    const a = analyzeDep(
      dep('ghost', '^1.0.0'),
      { name: 'ghost', versions: [], latest: null, exists: false },
      'latest',
    )
    expect(a.skip).toBe('not-found')
  })

  it('skips complex ranges it cannot safely rewrite', () => {
    const a = analyzeDep(dep('x', '>=1.0.0 <2.0.0'), info('x', ['1.0.0', '1.5.0']), 'latest')
    expect(a.skip).toBe('unparseable')
  })
})

describe('buildUpgradePlan', () => {
  it('partitions deps and re-applies the original prefix', () => {
    const deps = [
      dep('vue', '^3.4.0'),
      dep('lodash', '~4.17.20'),
      dep('eslint', '8.0.0', true),
      dep('ui', 'workspace:*'),
      dep('stable', '^2.0.0'),
    ]
    const versions = new Map<string, VersionInfo>([
      ['vue', info('vue', ['3.4.0', '3.9.0'])],
      ['lodash', info('lodash', ['4.17.20', '4.17.21', '4.18.0'])],
      ['eslint', info('eslint', ['8.0.0', '8.5.0', '9.0.0'])],
      ['stable', info('stable', ['2.0.0'])],
    ])
    const plan = buildUpgradePlan(deps, versions, 'minor')

    const byName = Object.fromEntries(plan.upgradable.map((i) => [i.name, i]))
    expect(byName.vue.proposed).toBe('^3.9.0')
    // minor mode lifts the ceiling to the newest minor (4.18.0); the original
    // `~` prefix is re-applied as a stylistic choice.
    expect(byName.lodash.proposed).toBe('~4.18.0')
    expect(byName.eslint.proposed).toBe('8.5.0') // exact pin stays exact, no major cross
    expect(plan.upToDate.map((i) => i.name)).toEqual(['stable'])
    expect(plan.skipped).toEqual([{ name: 'ui', depType: 'dependencies', reason: 'protocol' }])
  })
})

describe('collectQueryNames', () => {
  it('dedupes upgradable names across manifests and skips non-registry specifiers', () => {
    const manifests = [
      manifest('/root/package.json', [dep('vue', '^3.4.0'), dep('ui', 'workspace:*')]),
      manifest('/root/packages/a/package.json', [dep('vue', '^3.5.0'), dep('zod', '^3.0.0')]),
    ]
    expect(collectQueryNames(manifests).toSorted()).toEqual(['vue', 'zod'])
  })
})

describe('planManifests', () => {
  it('plans each manifest independently from a shared version map', () => {
    const manifests = [
      manifest('/root/package.json', [dep('vue', '^3.4.0')]),
      manifest('/root/packages/a/package.json', [dep('vue', '^3.4.0'), dep('zod', '^3.0.0')]),
    ]
    const versions = new Map<string, VersionInfo>([
      ['vue', info('vue', ['3.4.0', '3.9.0'])],
      ['zod', info('zod', ['3.0.0', '3.23.0'])],
    ])
    const planned = planManifests(manifests, versions, 'minor')

    expect(planned.map((p) => p.manifest.path)).toEqual([
      '/root/package.json',
      '/root/packages/a/package.json',
    ])
    // Same dep in both manifests resolves to the same target, independently.
    expect(planned[0].plan.upgradable.map((i) => [i.name, i.proposed])).toEqual([['vue', '^3.9.0']])
    expect(planned[1].plan.upgradable.map((i) => [i.name, i.proposed])).toEqual([
      ['vue', '^3.9.0'],
      ['zod', '^3.23.0'],
    ])
  })
})
