import { describe, expect, it } from 'vitest'

import type { CatalogManifest } from '../src/core/catalog.ts'
import type { VersionInfo } from '../src/core/upgrade.ts'

import { applyCatalogEdits, loadCatalogManifest } from '../src/core/catalog.ts'
import { planCatalog } from '../src/core/upgrade.ts'

function info(
  name: string,
  versions: string[],
  latest = versions[versions.length - 1],
): VersionInfo {
  return { name, versions, latest, exists: true }
}

const SAMPLE = `packages:
  - 'packages/*'

# shared versions
catalog:
  react: ^18.2.0
  react-dom: ^18.2.0

catalogs:
  prod:
    lodash: ^4.17.21
  dev:
    typescript: ~5.4.0
`

describe('loadCatalogManifest parsing', () => {
  it('flattens default and named catalogs into entries', async () => {
    // Write to a real temp file to exercise the reader end to end.
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'siz-cat-'))
    const path = join(dir, 'pnpm-workspace.yaml')
    writeFileSync(path, SAMPLE, 'utf8')

    const m = loadCatalogManifest(path)
    expect(m.entries).toEqual([
      { catalog: 'default', name: 'react', range: '^18.2.0' },
      { catalog: 'default', name: 'react-dom', range: '^18.2.0' },
      { catalog: 'prod', name: 'lodash', range: '^4.17.21' },
      { catalog: 'dev', name: 'typescript', range: '~5.4.0' },
    ])
  })
})

describe('applyCatalogEdits', () => {
  it('bumps a default-catalog version, preserving format and comments', () => {
    const out = applyCatalogEdits(SAMPLE, new Map([['default:react', '^18.3.1']]))
    expect(out).toContain('  react: ^18.3.1')
    expect(out).toContain('  react-dom: ^18.2.0') // sibling untouched
    expect(out).toContain('# shared versions') // comment preserved
    expect(out).toContain("  - 'packages/*'") // packages block untouched
  })

  it('targets the right named catalog without touching others', () => {
    const out = applyCatalogEdits(SAMPLE, new Map([['prod:lodash', '^4.18.0']]))
    expect(out).toContain('  lodash: ^4.18.0')
    expect(out).toContain('  typescript: ~5.4.0') // other named catalog untouched
  })

  it('preserves the tilde prefix and quoting style', () => {
    const quoted = `catalogs:\n  dev:\n    typescript: '~5.4.0'\n`
    const out = applyCatalogEdits(quoted, new Map([['dev:typescript', '~5.5.0']]))
    expect(out).toBe(`catalogs:\n  dev:\n    typescript: '~5.5.0'\n`)
  })

  it('applies multiple edits across blocks at once', () => {
    const out = applyCatalogEdits(
      SAMPLE,
      new Map([
        ['default:react', '^18.3.1'],
        ['prod:lodash', '^4.18.0'],
      ]),
    )
    expect(out).toContain('  react: ^18.3.1')
    expect(out).toContain('  lodash: ^4.18.0')
  })

  it('is a no-op for an unknown key', () => {
    expect(applyCatalogEdits(SAMPLE, new Map([['default:missing', '1.0.0']]))).toBe(SAMPLE)
  })
})

describe('planCatalog', () => {
  const versions = new Map<string, VersionInfo>([
    ['react', info('react', ['18.2.0', '18.3.1', '19.0.0'])],
    ['lodash', info('lodash', ['4.17.21', '4.18.0'])],
    ['typescript', info('typescript', ['5.4.0', '5.4.5', '5.5.0'])],
  ])
  const m: CatalogManifest = {
    path: '/repo/pnpm-workspace.yaml',
    raw: '',
    entries: [
      { catalog: 'default', name: 'react', range: '^18.2.0' },
      { catalog: 'prod', name: 'lodash', range: '^4.17.21' },
      { catalog: 'dev', name: 'typescript', range: '~5.4.0' },
    ],
  }

  it('resolves caret entries within the major under minor mode', () => {
    const items = planCatalog(m, versions, 'minor')
    const react = items.find((i) => i.name === 'react')
    expect(react?.proposed).toBe('^18.3.1') // stays within major 18
    expect(react?.catalog).toBe('default')
  })

  it('resolves to newest overall under major mode', () => {
    const items = planCatalog(m, versions, 'major')
    expect(items.find((i) => i.name === 'react')?.proposed).toBe('^19.0.0')
  })

  it('respects the tilde ceiling under patch mode', () => {
    const items = planCatalog(m, versions, 'patch')
    const ts = items.find((i) => i.name === 'typescript')
    expect(ts?.proposed).toBe('~5.4.5') // newest within 5.4.x, tilde preserved
  })

  it('skips complex and non-registry ranges', () => {
    const tricky: CatalogManifest = {
      ...m,
      entries: [
        { catalog: 'default', name: 'react', range: '>=18 <19' },
        { catalog: 'default', name: 'lodash', range: 'workspace:*' },
      ],
    }
    expect(planCatalog(tricky, versions, 'major')).toEqual([])
  })
})
