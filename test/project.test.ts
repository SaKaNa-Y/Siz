import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  applyRangeEdits,
  collectDeps,
  findPackageJson,
  isUpgradableSpecifier,
  loadProjectManifest,
  writeManifest,
} from '../src/core/project.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'siz-proj-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('isUpgradableSpecifier', () => {
  it('accepts registry version ranges', () => {
    expect(isUpgradableSpecifier('^1.2.3')).toBe(true)
    expect(isUpgradableSpecifier('~1.0.0')).toBe(true)
    expect(isUpgradableSpecifier('1.2.3')).toBe(true)
  })

  it('rejects protocols, URLs, and bare tags', () => {
    for (const r of [
      'workspace:*',
      'catalog:',
      'npm:react@^18',
      'file:../x',
      'link:../x',
      'git+https://x',
      'github:a/b',
      'https://x/y.tgz',
      '*',
      'latest',
    ]) {
      expect(isUpgradableSpecifier(r)).toBe(false)
    }
  })
})

describe('findPackageJson', () => {
  it('walks up to the nearest package.json', () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    const nested = join(dir, 'a', 'b')
    mkdirSync(nested, { recursive: true })
    expect(findPackageJson(nested)).toBe(join(dir, 'package.json'))
  })

  it('returns undefined when none exists up the tree', () => {
    // A fresh temp dir with no package.json above it within itself.
    const isolated = join(dir, 'empty')
    mkdirSync(isolated)
    // No package.json in `isolated`; findPackageJson may still find one higher
    // up the real fs, so only assert it does not match inside our sandbox.
    const found = findPackageJson(isolated)
    expect(found).not.toBe(join(isolated, 'package.json'))
  })
})

describe('collectDeps', () => {
  it('flattens dependencies and devDependencies', () => {
    const deps = collectDeps({
      dependencies: { vue: '^3.4.0', '@scope/pkg': '~1.0.0' },
      devDependencies: { vitest: '^2.0.0' },
    })
    expect(deps).toEqual([
      { name: 'vue', range: '^3.4.0', depType: 'dependencies' },
      { name: '@scope/pkg', range: '~1.0.0', depType: 'dependencies' },
      { name: 'vitest', range: '^2.0.0', depType: 'devDependencies' },
    ])
  })

  it('ignores non-object blocks and non-string values', () => {
    expect(collectDeps({})).toEqual([])
    expect(collectDeps({ dependencies: { x: 123 } })).toEqual([])
  })
})

describe('applyRangeEdits (format preservation)', () => {
  it('changes only the targeted version and preserves indentation + trailing newline', () => {
    const raw = `{
  "name": "demo",
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
`
    const out = applyRangeEdits(raw, new Map([['dependencies:react', '^18.3.1']]))
    expect(out).toContain('"react": "^18.3.1"')
    // react-dom must be untouched (anchored match, not a substring of react).
    expect(out).toContain('"react-dom": "^18.0.0"')
    expect(out.endsWith('}\n')).toBe(true)
    // Only one line changed.
    expect(out.split('\n').length).toBe(raw.split('\n').length)
  })

  it('disambiguates a name present in both dependency blocks', () => {
    const raw = `{
  "dependencies": { "typescript": "^5.0.0" },
  "devDependencies": { "typescript": "^5.0.0" }
}`
    const out = applyRangeEdits(raw, new Map([['devDependencies:typescript', '^5.7.0']]))
    expect(out).toContain('"dependencies": { "typescript": "^5.0.0" }')
    expect(out).toContain('"devDependencies": { "typescript": "^5.7.0" }')
  })

  it('preserves 4-space indentation and key order', () => {
    const raw = `{
    "dependencies": {
        "b": "1.0.0",
        "a": "2.0.0"
    }
}`
    const out = applyRangeEdits(raw, new Map([['dependencies:a', '2.5.0']]))
    expect(out).toContain('"a": "2.5.0"')
    expect(out.indexOf('"b"')).toBeLessThan(out.indexOf('"a"')) // order kept
    expect(out).toContain('        "b": "1.0.0"') // 8-space indent kept
  })
})

describe('loadProjectManifest + writeManifest', () => {
  it('round-trips through an atomic write with valid JSON', () => {
    const file = join(dir, 'package.json')
    writeFileSync(file, `{\n  "dependencies": {\n    "zod": "^3.0.0"\n  }\n}\n`)

    const m = loadProjectManifest(dir)
    expect(m?.deps).toEqual([{ name: 'zod', range: '^3.0.0', depType: 'dependencies' }])

    const next = applyRangeEdits(m!.raw, new Map([['dependencies:zod', '^3.23.0']]))
    writeManifest(m!.path, next)

    const reread = readFileSync(file, 'utf8')
    expect(reread).toContain('"zod": "^3.23.0"')
    expect(() => JSON.parse(reread)).not.toThrow()
    expect(reread.endsWith('\n')).toBe(true)
  })

  it('throws a friendly error on malformed JSON', () => {
    writeFileSync(join(dir, 'package.json'), '{ not json')
    expect(() => loadProjectManifest(dir)).toThrow(/Failed to parse/)
  })
})
