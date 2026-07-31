import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CURRENT_VERSION,
  addFavorite,
  addToBundle,
  getBundle,
  listBundles,
  listFavorites,
  listSavedEntries,
  loadData,
  migrate,
  removeBundle,
  removeFavorite,
  removeFromBundle,
  renameBundle,
  touchBundle,
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
  it('preserves every stored package and unknown field from an older file', () => {
    // Simulate a v0 data file written by an older Siz version, with extra
    // fields we have never seen before. Pre-v3 files kept packages under
    // `packages` with a `favorite` boolean.
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

    // Schema bumped, and packages moved under `favorites`.
    expect(data.version).toBe(CURRENT_VERSION)
    expect((data as Record<string, unknown>).packages).toBeUndefined()

    // No package lost — every former tracked package is now a favorite.
    expect(Object.keys(data.favorites).toSorted()).toEqual(['lodash', 'react', 'some-future-pkg'])

    // The defunct `favorite` boolean is dropped in v3.
    expect((data.favorites.lodash as unknown as Record<string, unknown>).favorite).toBeUndefined()
    expect((data.favorites.react as unknown as Record<string, unknown>).favorite).toBeUndefined()

    // Retired user-defined `tags` data round-trips untouched as an unknown field.
    expect((data.favorites.lodash as unknown as Record<string, unknown>).tags).toEqual([
      'lightweight',
      'frequently-used',
    ])
    expect((data.favorites.react as unknown as Record<string, unknown>).tags).toEqual([
      'production',
    ])

    // Existing optional fields preserved.
    expect(data.favorites.react.category).toBe('Frontend')
    expect(data.favorites.lodash.note).toBe('utils')

    // Missing required fields filled with safe defaults.
    expect(data.favorites.lodash.name).toBe('lodash')
    expect(typeof data.favorites.lodash.addedAt).toBe('string')

    // Unknown fields (per-package and top-level) round-trip untouched.
    expect(
      (data.favorites['some-future-pkg'] as unknown as Record<string, unknown>).futureField,
    ).toBe(42)
    expect(data.settings.theme).toBe('dark')
    expect((data as Record<string, unknown>).unknownTopLevel).toEqual({ keep: 'me' })
  })

  it('treats a missing file as empty data, not an error', () => {
    const data = loadData(file)
    expect(data.version).toBe(CURRENT_VERSION)
    expect(data.favorites).toEqual({})
  })

  it('is idempotent: migrating already-current data changes nothing material', () => {
    const once = migrate({ version: 0, packages: { a: { favorite: true, tags: ['x'] } } })
    const twice = migrate(once)
    expect(twice.favorites).toEqual(once.favorites)
    expect(twice.version).toBe(CURRENT_VERSION)
  })
})

describe('v2 -> v3 migration collapses track/favorite into one favorites list', () => {
  it('renames packages -> favorites, keeps every entry, and drops the favorite flag', () => {
    const v2 = {
      version: 2,
      packages: {
        // Mix of favorited and merely-tracked packages: both become favorites.
        vue: { name: 'vue', addedAt: '2020-01-01T00:00:00.000Z', favorite: true, note: 'fav' },
        lodash: { name: 'lodash', addedAt: '2020-02-02T00:00:00.000Z', favorite: false },
      },
      bundles: {},
      settings: {},
    }
    writeFileSync(file, JSON.stringify(v2), 'utf8')

    const data = loadData(file)
    expect(data.version).toBe(CURRENT_VERSION)
    expect((data as Record<string, unknown>).packages).toBeUndefined()
    expect(Object.keys(data.favorites).toSorted()).toEqual(['lodash', 'vue'])
    expect((data.favorites.vue as unknown as Record<string, unknown>).favorite).toBeUndefined()
    expect((data.favorites.lodash as unknown as Record<string, unknown>).favorite).toBeUndefined()
    // Other fields survive.
    expect(data.favorites.vue.note).toBe('fav')
    expect(data.favorites.lodash.addedAt).toBe('2020-02-02T00:00:00.000Z')
  })

  it('does not clobber a file that already uses favorites', () => {
    const already = migrate({ version: 2, packages: { a: { name: 'a', favorite: true } } })
    const again = migrate(already)
    expect(again.favorites).toEqual(already.favorites)
    expect(again.version).toBe(CURRENT_VERSION)
  })
})

describe('favorite mutators persist and never clobber user state', () => {
  it('re-favoriting an existing package refreshes version without losing metadata', () => {
    addFavorite({ name: 'vue', version: '3.0.0', category: 'Frontend' }, file)

    // Re-add with new version — must not reset the stored category.
    addFavorite({ name: 'vue', version: '3.5.0' }, file)

    const data = loadData(file)
    expect(data.favorites.vue.version).toBe('3.5.0')
    expect(data.favorites.vue.category).toBe('Frontend')
  })

  it('listFavorites filters by category and sorts by name', () => {
    addFavorite({ name: 'p2', category: 'Backend' }, file)
    addFavorite({ name: 'p1', category: 'Frontend' }, file)

    expect(listFavorites({ category: 'Backend' }, file).map((p) => p.name)).toEqual(['p2'])
    expect(listFavorites({}, file).map((p) => p.name)).toEqual(['p1', 'p2'])
  })

  it('removeFavorite removes only the target', () => {
    addFavorite({ name: 'a' }, file)
    addFavorite({ name: 'b' }, file)
    expect(removeFavorite('a', file)).toBe(true)
    expect(removeFavorite('missing', file)).toBe(false)
    expect(Object.keys(loadData(file).favorites)).toEqual(['b'])
  })
})

describe('atomic save', () => {
  it('produces valid JSON with trailing newline', () => {
    addFavorite({ name: 'a' }, file)
    const raw = readFileSync(file, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})

describe('bundles survive migration alongside favorites', () => {
  it('preserves existing bundles on a v2 file (round-trip into v3)', () => {
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

  it('removeFromBundle reports names that were not in the bundle', () => {
    addToBundle('stack', [{ name: 'a', strategy: 'caret', depType: 'dependencies' }], file)

    const result = removeFromBundle('stack', ['a', 'nope'], file)
    expect(result!.removed).toEqual(['a'])
    expect(result!.missing).toEqual(['nope'])
    // Removing the last entry leaves an empty bundle rather than deleting it.
    expect(getBundle('stack', file)!.packages).toEqual({})
    expect(removeFromBundle('absent', ['a'], file)).toBeUndefined()
  })

  it('lists every entry across bundles, tagged, ordered by bundle then name', () => {
    addToBundle(
      'zeta',
      [
        { name: 'vue', strategy: 'caret', depType: 'dependencies' },
        { name: 'axios', strategy: 'exact', depType: 'dependencies', version: '1.2.3' },
      ],
      file,
    )
    addToBundle('alpha', [{ name: 'vitest', strategy: 'caret', depType: 'devDependencies' }], file)

    const entries = listSavedEntries({}, file)
    expect(entries.map((e) => [e.bundle, e.name])).toEqual([
      ['alpha', 'vitest'],
      ['zeta', 'axios'],
      ['zeta', 'vue'],
    ])
    // Entries carry their bundle metadata through unchanged.
    expect(entries[1]).toMatchObject({ strategy: 'exact', version: '1.2.3' })
    expect(entries[0].depType).toBe('devDependencies')
  })

  it('filters saved entries to a single bundle and returns nothing for an empty store', () => {
    expect(listSavedEntries({}, file)).toEqual([])

    addToBundle('a', [{ name: 'p1', strategy: 'caret', depType: 'dependencies' }], file)
    addToBundle('b', [{ name: 'p2', strategy: 'caret', depType: 'dependencies' }], file)

    expect(listSavedEntries({ bundle: 'b' }, file).map((e) => e.name)).toEqual(['p2'])
    expect(listSavedEntries({ bundle: 'missing' }, file)).toEqual([])
    // An empty bundle contributes no entries.
    upsertBundle('empty', {}, file)
    expect(listSavedEntries({}, file).map((e) => e.name)).toEqual(['p1', 'p2'])
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
