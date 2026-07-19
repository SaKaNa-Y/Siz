import { describe, expect, it } from 'vitest'

import type { CatalogManifest } from '../src/core/catalog.ts'
import type { VersionInfo } from '../src/core/compare.ts'
import type { ProjectDep } from '../src/core/project.ts'

import { analyzeOutdated, buildOutdatedReport, planCatalogOutdated } from '../src/core/outdated.ts'

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

describe('analyzeOutdated', () => {
  it('reports a caret dep: wanted within ^, latest beyond', () => {
    const a = analyzeOutdated(
      dep('react', '^18.2.0'),
      info('react', ['18.2.0', '18.3.1', '19.0.0']),
    )
    expect(a.kind).toBe('outdated')
    if (a.kind !== 'outdated') return
    expect(a.item.current).toBe('18.2.0')
    expect(a.item.wanted).toBe('18.3.1')
    expect(a.item.latest).toBe('19.0.0')
    expect(a.item.wantedDiff).toBe('minor')
    expect(a.item.latestDiff).toBe('major')
  })

  it('reports a tilde dep: wanted within ~', () => {
    const a = analyzeOutdated(dep('vue', '~3.4.0'), info('vue', ['3.4.0', '3.4.9', '3.5.13']))
    expect(a.kind).toBe('outdated')
    if (a.kind !== 'outdated') return
    expect(a.item.wanted).toBe('3.4.9')
    expect(a.item.latest).toBe('3.5.13')
  })

  it('reports an exact pin: wanted == current, still outdated when latest is ahead', () => {
    const a = analyzeOutdated(dep('zod', '3.22.0'), info('zod', ['3.22.0', '3.22.5', '4.0.0']))
    expect(a.kind).toBe('outdated')
    if (a.kind !== 'outdated') return
    expect(a.item.current).toBe('3.22.0')
    expect(a.item.wanted).toBe('3.22.0')
    expect(a.item.latest).toBe('4.0.0')
  })

  it('reports a complex range (not skipped) with wanted = max in range', () => {
    const a = analyzeOutdated(
      dep('foo', '>=2.0.0 <3.0.0'),
      info('foo', ['2.0.0', '2.5.1', '3.0.0']),
    )
    expect(a.kind).toBe('outdated')
    if (a.kind !== 'outdated') return
    expect(a.item.current).toBe('2.0.0')
    expect(a.item.wanted).toBe('2.5.1')
    expect(a.item.latest).toBe('3.0.0')
  })

  it('is up to date when latest does not exceed current', () => {
    const a = analyzeOutdated(dep('left-pad', '^1.3.0'), info('left-pad', ['1.3.0']))
    expect(a.kind).toBe('up-to-date')
  })

  it('excludes prereleases from wanted unless current is a prerelease', () => {
    const a = analyzeOutdated(
      dep('next', '^1.0.0'),
      info('next', ['1.0.0', '1.2.0', '2.0.0-beta.1'], '1.2.0'),
    )
    expect(a.kind).toBe('outdated')
    if (a.kind !== 'outdated') return
    expect(a.item.wanted).toBe('1.2.0')
  })

  it('skips non-registry protocols', () => {
    const a = analyzeOutdated(dep('ui', 'workspace:*'), info('ui', ['1.0.0']))
    expect(a).toEqual({ kind: 'skipped', reason: 'protocol' })
  })

  it('skips packages not found on the registry', () => {
    const a = analyzeOutdated(dep('ghost', '^1.0.0'), {
      name: 'ghost',
      versions: [],
      latest: null,
      exists: false,
    })
    expect(a).toEqual({ kind: 'skipped', reason: 'not-found' })
  })
})

describe('buildOutdatedReport', () => {
  it('partitions deps into outdated / skipped / up-to-date', () => {
    const versions = new Map<string, VersionInfo>([
      ['react', info('react', ['18.2.0', '19.0.0'])],
      ['vue', info('vue', ['3.5.0'])],
    ])
    const report = buildOutdatedReport(
      [dep('react', '^18.2.0'), dep('vue', '^3.5.0'), dep('ui', 'workspace:*')],
      versions,
    )
    expect(report.outdated.map((o) => o.name)).toEqual(['react'])
    expect(report.upToDate).toBe(1)
    expect(report.skipped).toEqual([{ name: 'ui', depType: 'dependencies', reason: 'protocol' }])
  })
})

describe('planCatalogOutdated', () => {
  it('tags each outdated catalog entry with its catalog name', () => {
    const catalog: CatalogManifest = {
      path: '/repo/pnpm-workspace.yaml',
      raw: '',
      entries: [
        { catalog: 'default', name: 'react', range: '^18.2.0' },
        { catalog: 'testing', name: 'vitest', range: '^1.0.0' },
      ],
    }
    const versions = new Map<string, VersionInfo>([
      ['react', info('react', ['18.2.0', '19.0.0'])],
      ['vitest', info('vitest', ['1.0.0'])],
    ])
    const items = planCatalogOutdated(catalog, versions)
    expect(items.map((i) => [i.name, i.catalog])).toEqual([['react', 'default']])
  })
})
