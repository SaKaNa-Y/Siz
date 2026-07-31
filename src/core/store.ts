import type { Agent } from 'package-manager-detector'

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { Bundle, BundlePackage, SavedEntry, SizData } from './types.ts'

import { getDataFile } from './paths.ts'

/** Current schema version. Bump when adding a migration step below. */
export const CURRENT_VERSION = 4

const SCHEMA_HINT = 'https://github.com/siz-cli/siz/schema.json'

/**
 * Bundle that v3 favorites are migrated into. Named so an upgrading user can
 * find their curated packages immediately (`siz list -b favorites`).
 */
export const FAVORITES_BUNDLE = 'favorites'

/** A fresh, default-initialized bundle record. */
function newBundle(name: string): Bundle {
  return { name, tags: [], packages: {}, createdAt: new Date().toISOString() }
}

/** A fresh, empty data object. */
export function emptyData(): SizData {
  return {
    $schema: SCHEMA_HINT,
    version: CURRENT_VERSION,
    bundles: {},
    settings: {},
  }
}

/**
 * Migrate raw on-disk data up to CURRENT_VERSION.
 *
 * IMPORTANT: no step ever drops a stored **package**, and unknown top-level keys
 * round-trip untouched. That is what guarantees the packages a user curated
 * survive Siz upgrades. Individual *fields* may be dropped when a step retires
 * the concept they belonged to — the v3→v4 step does exactly that — but such a
 * drop must be deliberate and documented at the step.
 */
export function migrate(raw: unknown): SizData {
  // Start from a defensive shallow copy of whatever we were given.
  const data: Record<string, unknown> =
    raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {}

  // Ensure the core containers exist without clobbering existing values. Older
  // files (<= v2) keep their packages under `packages`; v3+ uses `favorites`.
  if (typeof data.version !== 'number') data.version = 0
  if (!data.packages || typeof data.packages !== 'object') data.packages = {}
  if (!data.bundles || typeof data.bundles !== 'object') data.bundles = {}
  if (!data.settings || typeof data.settings !== 'object') data.settings = {}

  const packages = data.packages as Record<string, Record<string, unknown>>

  // --- Step: v0 -> v1 -------------------------------------------------------
  // Normalize each package, filling required fields that did not exist in older
  // versions. Never remove a package.
  if ((data.version as number) < 1) {
    for (const [name, pkg] of Object.entries(packages)) {
      const p = (pkg && typeof pkg === 'object' ? pkg : {}) as Record<string, unknown>
      packages[name] = {
        // Preserve any extra/unknown per-package fields first...
        ...p,
        // ...then guarantee the required fields exist.
        name: typeof p.name === 'string' ? p.name : name,
        addedAt: typeof p.addedAt === 'string' ? p.addedAt : new Date(0).toISOString(),
      }
    }
    data.version = 1
  }

  // --- Step: v1 -> v2 -------------------------------------------------------
  // Introduce the `bundles` container. Non-destructive: the guard above already
  // initialized it when missing, so older files simply gain an empty map.
  if ((data.version as number) < 2) {
    data.version = 2
  }

  // --- Step: v2 -> v3 -------------------------------------------------------
  // Collapse the two-tier track/favorite model into a single favorites list:
  // rename `packages` -> `favorites` (every former tracked package becomes a
  // favorite) and drop the now-defunct per-package `favorite` boolean. Never
  // drop an entry or any other field. Idempotent: skip if `favorites` exists.
  if ((data.version as number) < 3) {
    if (!data.favorites || typeof data.favorites !== 'object') {
      const favorites: Record<string, Record<string, unknown>> = {}
      for (const [name, pkg] of Object.entries(packages)) {
        const { favorite: _drop, ...rest } = pkg
        favorites[name] = rest
      }
      data.favorites = favorites
    }
    data.version = 3
  }

  // The pre-v3 `packages` container is retired: the guard above re-creates it as
  // an empty object even for a file that never had one, so drop it again rather
  // than writing a stray `"packages": {}` back to disk.
  delete data.packages

  // --- Step: v3 -> v4 -------------------------------------------------------
  // Favorites stop existing as a concept: every favorite moves into the
  // `favorites` bundle so the packages the user curated stay reachable through
  // the flat saved-entry list. Recorded as regular dependencies tracking latest
  // — the favorite's stored version was a snapshot taken whenever it was
  // favorited and never refreshed, so it (and its guessed category, and the rest
  // of its per-favorite fields) is deliberately dropped rather than carried over
  // as a pin. Never removes a package or a bundle, and an entry that already
  // exists in the bundle wins, which makes a second run a no-op.
  if ((data.version as number) < 4) {
    const favorites = (
      data.favorites && typeof data.favorites === 'object' ? data.favorites : {}
    ) as Record<string, { name?: unknown } | undefined>
    const names = Object.keys(favorites)
    if (names.length > 0) {
      const bundles = data.bundles as Record<string, Bundle>
      const bundle = (bundles[FAVORITES_BUNDLE] ??= newBundle(FAVORITES_BUNDLE))
      for (const key of names) {
        const stored = favorites[key]
        const name = typeof stored?.name === 'string' ? stored.name : key
        bundle.packages[name] ??= { name, strategy: 'latest', depType: 'dependencies' }
      }
    }
    delete data.favorites
    data.version = 4
  }

  // Future migrations go here, each guarded by `if (data.version < N)`.

  data.$schema = SCHEMA_HINT
  data.version = CURRENT_VERSION
  return data as SizData
}

/**
 * Load the Siz data file, running migrations as needed.
 * Returns fresh empty data if the file does not exist yet.
 */
export function loadData(file: string = getDataFile()): SizData {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return emptyData()
    // Corrupt/unreadable JSON: do not blow away the file — surface the error.
    throw new Error(`Failed to read Siz data at ${file}: ${(err as Error).message}`, {
      cause: err,
    })
  }
  return migrate(raw)
}

/** Atomically persist data: write to a temp file then rename into place. */
export function saveData(data: SizData, file: string = getDataFile()): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  renameSync(tmp, file)
}

// --- High-level mutators -----------------------------------------------------
// Each loads, mutates, saves, and returns the affected package (where useful).

function withData<T>(file: string | undefined, fn: (data: SizData) => T): T {
  const target = file ?? getDataFile()
  const data = loadData(target)
  const result = fn(data)
  saveData(data, target)
  return result
}

// --- Bundle mutators ---------------------------------------------------------

/** Metadata that can be set/updated on a bundle without touching its packages. */
export interface BundleMeta {
  description?: string
  tags?: string[]
  packageManager?: Agent
}

/** Create or update a bundle's metadata, leaving its packages untouched. */
export function upsertBundle(name: string, meta: BundleMeta = {}, file?: string): Bundle {
  return withData(file, (data) => {
    const bundle = (data.bundles[name] ??= newBundle(name))
    if (meta.description !== undefined) bundle.description = meta.description
    if (meta.tags !== undefined) bundle.tags = meta.tags
    if (meta.packageManager !== undefined) bundle.packageManager = meta.packageManager
    return bundle
  })
}

/** Add (or overwrite) package entries in a bundle, creating it if missing. */
export function addToBundle(name: string, entries: BundlePackage[], file?: string): Bundle {
  return withData(file, (data) => {
    const bundle = (data.bundles[name] ??= newBundle(name))
    for (const entry of entries) bundle.packages[entry.name] = entry
    return bundle
  })
}

/** Outcome of a per-entry bundle removal: what went, and what was never there. */
export interface BundleRemoval {
  bundle: Bundle
  /** Names that existed in the bundle and were deleted. */
  removed: string[]
  /** Names that were not in the bundle — reportable, not an error. */
  missing: string[]
}

/**
 * Remove package entries from a bundle. Returns undefined if the bundle is
 * missing; otherwise reports which names went and which were never there.
 * Removing every entry leaves an empty bundle — it never deletes the bundle.
 */
export function removeFromBundle(
  name: string,
  pkgNames: string[],
  file?: string,
): BundleRemoval | undefined {
  return withData(file, (data) => {
    const bundle = data.bundles[name]
    if (!bundle) return undefined
    const removed: string[] = []
    const missing: string[] = []
    for (const pkg of pkgNames) {
      if (bundle.packages[pkg]) {
        delete bundle.packages[pkg]
        removed.push(pkg)
      } else {
        missing.push(pkg)
      }
    }
    return { bundle, removed, missing }
  })
}

/** Read a single bundle by name. */
export function getBundle(name: string, file?: string): Bundle | undefined {
  return loadData(file ?? getDataFile()).bundles[name]
}

/** List bundles, most-recently-used first (then alphabetically). */
export function listBundles(file?: string): Bundle[] {
  const data = loadData(file ?? getDataFile())
  return Object.values(data.bundles).toSorted((a, b) => {
    const at = a.lastUsedAt ?? ''
    const bt = b.lastUsedAt ?? ''
    if (at !== bt) return at < bt ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

/** Delete a bundle. Returns false if it didn't exist. */
export function removeBundle(name: string, file?: string): boolean {
  return withData(file, (data) => {
    if (!data.bundles[name]) return false
    delete data.bundles[name]
    return true
  })
}

/** Rename a bundle. Returns 'missing' if absent, 'exists' if the target name is taken. */
export function renameBundle(
  oldName: string,
  newName: string,
  file?: string,
): 'ok' | 'missing' | 'exists' {
  return withData(file, (data) => {
    const bundle = data.bundles[oldName]
    if (!bundle) return 'missing'
    if (data.bundles[newName]) return 'exists'
    bundle.name = newName
    data.bundles[newName] = bundle
    delete data.bundles[oldName]
    return 'ok'
  })
}

/**
 * Every bundle entry, flattened across all bundles and tagged with the bundle it
 * came from. One query backs both the interactive front door and `siz list`, so
 * the two views are the same data by construction.
 *
 * Order is stable and independent of insertion order: bundle name, then package
 * name, both alphabetically.
 */
export function listSavedEntries(filters: { bundle?: string } = {}, file?: string): SavedEntry[] {
  const data = loadData(file ?? getDataFile())
  const entries: SavedEntry[] = []
  for (const bundle of Object.values(data.bundles)) {
    if (filters.bundle && bundle.name !== filters.bundle) continue
    for (const pkg of Object.values(bundle.packages)) entries.push({ ...pkg, bundle: bundle.name })
  }
  return entries.toSorted(
    (a, b) => a.bundle.localeCompare(b.bundle) || a.name.localeCompare(b.name),
  )
}

/** Stamp a bundle's lastUsedAt with the current time. */
export function touchBundle(name: string, file?: string): Bundle | undefined {
  return withData(file, (data) => {
    const bundle = data.bundles[name]
    if (!bundle) return undefined
    bundle.lastUsedAt = new Date().toISOString()
    return bundle
  })
}
