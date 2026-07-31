import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CURRENT_VERSION,
  FAVORITES_BUNDLE,
  addToBundle,
  getBundle,
  listBundles,
  listSavedEntries,
  loadData,
  migrate,
  removeBundle,
  removeFromBundle,
  renameBundle,
  touchBundle,
  upsertBundle,
} from '../src/core/store.ts'

/** The migrated `favorites` bundle's entries, keyed by package name. */
function favBundle(file: string) {
  return getBundle(FAVORITES_BUNDLE, file)?.packages ?? {}
}

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
  it('preserves every stored package and unknown top-level field from an older file', () => {
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

    // Schema bumped; `packages` and `favorites` are both gone as containers.
    expect(data.version).toBe(CURRENT_VERSION)
    expect((data as Record<string, unknown>).packages).toBeUndefined()
    expect((data as Record<string, unknown>).favorites).toBeUndefined()

    // No package lost — every former tracked package is a saved entry now.
    expect(Object.keys(favBundle(file)).toSorted()).toEqual(['lodash', 'react', 'some-future-pkg'])

    // Unknown top-level fields round-trip untouched.
    expect(data.settings.theme).toBe('dark')
    expect((data as Record<string, unknown>).unknownTopLevel).toEqual({ keep: 'me' })
  })

  it('treats a missing file as empty data, not an error', () => {
    const data = loadData(file)
    expect(data.version).toBe(CURRENT_VERSION)
    expect(data.bundles).toEqual({})
  })

  it('is idempotent: migrating already-current data changes nothing material', () => {
    const once = migrate({ version: 0, packages: { a: { favorite: true, tags: ['x'] } } })
    const twice = migrate(once)
    expect(twice.bundles).toEqual(once.bundles)
    expect(twice.version).toBe(CURRENT_VERSION)
  })
})

describe('v3 -> v4 migration moves favorites into a bundle', () => {
  it('keeps every favorite as a saved entry and drops its version and category', () => {
    const v3 = {
      version: 3,
      favorites: {
        vue: {
          name: 'vue',
          addedAt: '2020-01-01T00:00:00.000Z',
          version: '3.0.0',
          category: 'Frontend',
        },
        lodash: { name: 'lodash', addedAt: '2020-02-02T00:00:00.000Z' },
      },
      bundles: {},
      settings: {},
    }
    writeFileSync(file, JSON.stringify(v3), 'utf8')

    const data = loadData(file)
    expect(data.version).toBe(CURRENT_VERSION)
    expect((data as Record<string, unknown>).packages).toBeUndefined()
    expect((data as Record<string, unknown>).favorites).toBeUndefined()

    const packages = favBundle(file)
    expect(Object.keys(packages).toSorted()).toEqual(['lodash', 'vue'])
    // Regular dependencies tracking latest: the stale version snapshot and the
    // guessed category are both dropped rather than carried over.
    expect(packages.vue).toEqual({ name: 'vue', strategy: 'latest', depType: 'dependencies' })
    expect(packages.lodash).toEqual({ name: 'lodash', strategy: 'latest', depType: 'dependencies' })

    // The migrated packages show up in the flat saved-entry list.
    expect(listSavedEntries({}, file).map((e) => [e.bundle, e.name])).toEqual([
      [FAVORITES_BUNDLE, 'lodash'],
      [FAVORITES_BUNDLE, 'vue'],
    ])
  })

  it('is idempotent and never removes a package or a bundle', () => {
    const once = migrate({
      version: 3,
      favorites: { a: { name: 'a' } },
      bundles: { web: { name: 'web', tags: [], packages: {}, createdAt: 'x' } },
      settings: {},
    })
    const twice = migrate(once)
    expect(twice.bundles).toEqual(once.bundles)
    expect(twice.version).toBe(CURRENT_VERSION)
    expect(Object.keys(twice.bundles).toSorted()).toEqual([FAVORITES_BUNDLE, 'web'])
  })

  it('migrates a v3 store with no favorites, and a v4 store, without error', () => {
    const noFavorites = migrate({ version: 3, favorites: {}, bundles: {}, settings: {} })
    expect(noFavorites.version).toBe(CURRENT_VERSION)
    // An empty favorites map must not conjure an empty bundle.
    expect(noFavorites.bundles).toEqual({})

    const alreadyV4 = migrate({ version: 4, bundles: {}, settings: {} })
    expect(alreadyV4.version).toBe(CURRENT_VERSION)
    expect(alreadyV4.bundles).toEqual({})
  })

  it('never overwrites an existing entry, and leaves other bundles alone', () => {
    const web = {
      name: 'web',
      tags: ['ui'],
      packages: { react: { name: 'react', strategy: 'caret', depType: 'dependencies' } },
      createdAt: '2024-01-01T00:00:00.000Z',
    }
    const favorites = {
      name: FAVORITES_BUNDLE,
      tags: [],
      // An entry the user already curated: the migration must not overwrite it.
      packages: { vue: { name: 'vue', strategy: 'exact', depType: 'devDependencies' } },
      createdAt: '2024-01-01T00:00:00.000Z',
    }
    writeFileSync(
      file,
      JSON.stringify({
        version: 3,
        favorites: { vue: { name: 'vue', version: '2.0.0' }, zod: { name: 'zod' } },
        bundles: { web, favorites },
        settings: {},
      }),
      'utf8',
    )

    expect(getBundle('web', file)).toEqual(web)
    const packages = favBundle(file)
    expect(packages.vue).toEqual({ name: 'vue', strategy: 'exact', depType: 'devDependencies' })
    expect(packages.zod).toEqual({ name: 'zod', strategy: 'latest', depType: 'dependencies' })
  })
})

describe('atomic save', () => {
  it('produces valid JSON with trailing newline', () => {
    addToBundle('stack', [{ name: 'a', strategy: 'caret', depType: 'dependencies' }], file)
    const raw = readFileSync(file, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})

describe('bundles survive migration', () => {
  it('preserves existing bundles on a v2 file (round-trip into v4)', () => {
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
