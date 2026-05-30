import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CURRENT_VERSION,
  addTags,
  listPackages,
  loadData,
  migrate,
  setFavorite,
  trackPackage,
  untrack,
} from '../src/core/store.ts'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'siz-test-'))
  file = join(dir, 'data.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('migration is non-destructive (update-safety constraint)', () => {
  it('preserves every tracked package, favorite, and tag from an older file', () => {
    // Simulate a v0 data file written by an older Siz version, with extra
    // fields we have never seen before.
    const legacy = {
      version: 0,
      packages: {
        lodash: { favorite: true, tags: ['lightweight', 'frequently-used'], note: 'utils' },
        react: { favorite: false, tags: ['production'], category: 'Frontend' },
        'some-future-pkg': { favorite: true, tags: [], futureField: 42 },
      },
      settings: { theme: 'dark' },
      unknownTopLevel: { keep: 'me' },
    }
    writeFileSync(file, JSON.stringify(legacy), 'utf8')

    const data = loadData(file)

    // Schema bumped.
    expect(data.version).toBe(CURRENT_VERSION)

    // No package lost.
    expect(Object.keys(data.packages).sort()).toEqual(['lodash', 'react', 'some-future-pkg'])

    // Favorites preserved.
    expect(data.packages.lodash.favorite).toBe(true)
    expect(data.packages.react.favorite).toBe(false)

    // Tags preserved.
    expect(data.packages.lodash.tags).toEqual(['lightweight', 'frequently-used'])
    expect(data.packages.react.tags).toEqual(['production'])

    // Existing optional fields preserved.
    expect(data.packages.react.category).toBe('Frontend')
    expect(data.packages.lodash.note).toBe('utils')

    // Missing required fields filled with safe defaults.
    expect(data.packages.lodash.name).toBe('lodash')
    expect(typeof data.packages.lodash.addedAt).toBe('string')

    // Unknown fields (per-package and top-level) round-trip untouched.
    expect((data.packages['some-future-pkg'] as unknown as Record<string, unknown>).futureField).toBe(42)
    expect(data.settings.theme).toBe('dark')
    expect((data as Record<string, unknown>).unknownTopLevel).toEqual({ keep: 'me' })
  })

  it('treats a missing file as empty data, not an error', () => {
    const data = loadData(file)
    expect(data.version).toBe(CURRENT_VERSION)
    expect(data.packages).toEqual({})
  })

  it('is idempotent: migrating already-current data changes nothing material', () => {
    const once = migrate({ version: 0, packages: { a: { favorite: true, tags: ['x'] } } })
    const twice = migrate(once)
    expect(twice.packages).toEqual(once.packages)
    expect(twice.version).toBe(CURRENT_VERSION)
  })
})

describe('mutators persist and never clobber user state', () => {
  it('tracking an existing package keeps its favorite and tags', () => {
    trackPackage({ name: 'vue', version: '3.0.0' }, file)
    setFavorite('vue', true, file)
    addTags('vue', ['ui'], file)

    // Re-track with new version — must not reset favorite/tags.
    trackPackage({ name: 'vue', version: '3.5.0' }, file)

    const data = loadData(file)
    expect(data.packages.vue.favorite).toBe(true)
    expect(data.packages.vue.tags).toEqual(['ui'])
    expect(data.packages.vue.version).toBe('3.5.0')
  })

  it('addTags de-duplicates', () => {
    addTags('x', ['a', 'b'], file)
    addTags('x', ['b', 'c'], file)
    expect(loadData(file).packages.x.tags).toEqual(['a', 'b', 'c'])
  })

  it('listPackages filters by favorite, tag, and category', () => {
    trackPackage({ name: 'p1', category: 'Frontend' }, file)
    setFavorite('p1', true, file)
    addTags('p1', ['fast'], file)
    trackPackage({ name: 'p2', category: 'Backend' }, file)

    expect(listPackages({ favorite: true }, file).map((p) => p.name)).toEqual(['p1'])
    expect(listPackages({ tag: 'fast' }, file).map((p) => p.name)).toEqual(['p1'])
    expect(listPackages({ category: 'Backend' }, file).map((p) => p.name)).toEqual(['p2'])
    expect(listPackages({}, file)).toHaveLength(2)
  })

  it('untrack removes only the target', () => {
    trackPackage({ name: 'a' }, file)
    trackPackage({ name: 'b' }, file)
    expect(untrack('a', file)).toBe(true)
    expect(untrack('missing', file)).toBe(false)
    expect(Object.keys(loadData(file).packages)).toEqual(['b'])
  })
})

describe('atomic save', () => {
  it('produces valid JSON with trailing newline', () => {
    trackPackage({ name: 'a' }, file)
    const raw = readFileSync(file, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})
