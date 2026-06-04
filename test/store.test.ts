import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CURRENT_VERSION,
  addToBundle,
  getBundle,
  listBundles,
  listPackages,
  loadData,
  migrate,
  removeBundle,
  removeFromBundle,
  renameBundle,
  setFavorite,
  touchBundle,
  trackPackage,
  untrack,
  upsertBundle,
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
  it('preserves every tracked package, favorite, and unknown field from an older file', () => {
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
    expect(Object.keys(data.packages).toSorted()).toEqual(['lodash', 'react', 'some-future-pkg'])

    // Favorites preserved.
    expect(data.packages.lodash.favorite).toBe(true)
    expect(data.packages.react.favorite).toBe(false)

    // Retired user-defined `tags` data round-trips untouched as an unknown field.
    expect((data.packages.lodash as unknown as Record<string, unknown>).tags).toEqual([
      'lightweight',
      'frequently-used',
    ])
    expect((data.packages.react as unknown as Record<string, unknown>).tags).toEqual(['production'])

    // Existing optional fields preserved.
    expect(data.packages.react.category).toBe('Frontend')
    expect(data.packages.lodash.note).toBe('utils')

    // Missing required fields filled with safe defaults.
    expect(data.packages.lodash.name).toBe('lodash')
    expect(typeof data.packages.lodash.addedAt).toBe('string')

    // Unknown fields (per-package and top-level) round-trip untouched.
    expect(
      (data.packages['some-future-pkg'] as unknown as Record<string, unknown>).futureField,
    ).toBe(42)
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
  it('tracking an existing package keeps its favorite', () => {
    trackPackage({ name: 'vue', version: '3.0.0' }, file)
    setFavorite('vue', true, file)

    // Re-track with new version — must not reset favorite.
    trackPackage({ name: 'vue', version: '3.5.0' }, file)

    const data = loadData(file)
    expect(data.packages.vue.favorite).toBe(true)
    expect(data.packages.vue.version).toBe('3.5.0')
  })

  it('listPackages filters by favorite and category', () => {
    trackPackage({ name: 'p1', category: 'Frontend' }, file)
    setFavorite('p1', true, file)
    trackPackage({ name: 'p2', category: 'Backend' }, file)

    expect(listPackages({ favorite: true }, file).map((p) => p.name)).toEqual(['p1'])
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

describe('v1 -> v2 migration introduces bundles non-destructively', () => {
  it('adds an empty bundles map while preserving tracked packages', () => {
    const v1 = {
      version: 1,
      packages: {
        lodash: { name: 'lodash', addedAt: '2020-01-01T00:00:00.000Z', favorite: true, tags: [] },
      },
      settings: {},
    }
    writeFileSync(file, JSON.stringify(v1), 'utf8')

    const data = loadData(file)
    expect(data.version).toBe(CURRENT_VERSION)
    expect(data.bundles).toEqual({})
    expect(data.packages.lodash.favorite).toBe(true)
  })

  it('preserves existing bundles on a v2 file (round-trip)', () => {
    const bundle = {
      name: 'web',
      tags: ['ui'],
      packages: { react: { name: 'react', strategy: 'caret', depType: 'dependencies' } },
      createdAt: '2024-01-01T00:00:00.000Z',
    }
    writeFileSync(
      file,
      JSON.stringify({ version: 2, packages: {}, bundles: { web: bundle }, settings: {} }),
      'utf8',
    )
    expect(loadData(file).bundles.web).toEqual(bundle)
  })

  it('is idempotent across repeated migration', () => {
    const once = migrate({ version: 1, packages: {}, bundles: { a: { name: 'a' } } })
    const twice = migrate(once)
    expect(twice.bundles).toEqual(once.bundles)
    expect(twice.version).toBe(CURRENT_VERSION)
  })
})

describe('bundle mutators', () => {
  it('addToBundle creates the bundle and dedupes by name (last-write-wins)', () => {
    addToBundle('stack', [{ name: 'react', strategy: 'caret', depType: 'dependencies' }], file)
    addToBundle('stack', [{ name: 'react', strategy: 'tilde', depType: 'devDependencies' }], file)

    const bundle = getBundle('stack', file)
    expect(Object.keys(bundle!.packages)).toEqual(['react'])
    expect(bundle!.packages.react.strategy).toBe('tilde')
    expect(bundle!.packages.react.depType).toBe('devDependencies')
  })

  it('upsertBundle updates metadata without clobbering packages', () => {
    addToBundle('stack', [{ name: 'vue', strategy: 'caret', depType: 'dependencies' }], file)
    upsertBundle('stack', { description: 'frontend', tags: ['ui'], packageManager: 'pnpm' }, file)

    const bundle = getBundle('stack', file)!
    expect(bundle.description).toBe('frontend')
    expect(bundle.tags).toEqual(['ui'])
    expect(bundle.packageManager).toBe('pnpm')
    expect(Object.keys(bundle.packages)).toEqual(['vue'])
  })

  it('removeFromBundle drops only the named entries', () => {
    addToBundle(
      'stack',
      [
        { name: 'a', strategy: 'caret', depType: 'dependencies' },
        { name: 'b', strategy: 'caret', depType: 'dependencies' },
      ],
      file,
    )
    removeFromBundle('stack', ['a'], file)
    expect(Object.keys(getBundle('stack', file)!.packages)).toEqual(['b'])
  })

  it('listBundles sorts by lastUsedAt desc, then name', () => {
    upsertBundle('alpha', {}, file)
    upsertBundle('beta', {}, file)
    upsertBundle('gamma', {}, file)
    touchBundle('beta', file) // most recent

    const names = listBundles(file).map((b) => b.name)
    // beta first (has lastUsedAt); the rest alphabetical.
    expect(names[0]).toBe('beta')
    expect(names.slice(1)).toEqual(['alpha', 'gamma'])
  })

  it('removeBundle returns true/false', () => {
    upsertBundle('x', {}, file)
    expect(removeBundle('x', file)).toBe(true)
    expect(removeBundle('x', file)).toBe(false)
  })

  it('renameBundle handles ok, missing, and exists', () => {
    upsertBundle('old', {}, file)
    upsertBundle('taken', {}, file)
    expect(renameBundle('missing', 'new', file)).toBe('missing')
    expect(renameBundle('old', 'taken', file)).toBe('exists')
    expect(renameBundle('old', 'new', file)).toBe('ok')
    expect(getBundle('new', file)!.name).toBe('new')
    expect(getBundle('old', file)).toBeUndefined()
  })
})
