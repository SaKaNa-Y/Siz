import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getDataFile } from './paths.ts'
import type { SizData, TrackedPackage } from './types.ts'

/** Current schema version. Bump when adding a migration step below. */
export const CURRENT_VERSION = 1

const SCHEMA_HINT = 'https://github.com/siz-cli/siz/schema.json'

/** A fresh, default-initialized package record. */
function newPackage(name: string): TrackedPackage {
  return { name, addedAt: new Date().toISOString(), favorite: false, tags: [] }
}

/** A fresh, empty data object. */
export function emptyData(): SizData {
  return {
    $schema: SCHEMA_HINT,
    version: CURRENT_VERSION,
    packages: {},
    settings: {},
  }
}

/**
 * Migrate raw on-disk data up to CURRENT_VERSION.
 *
 * IMPORTANT: every step is *non-destructive*. We only add or transform fields
 * and never drop tracked packages, favorites, tags, or unknown keys. This is
 * what guarantees user data survives Siz upgrades.
 */
export function migrate(raw: unknown): SizData {
  // Start from a defensive shallow copy of whatever we were given.
  const data: Record<string, unknown> =
    raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {}

  // Ensure the core containers exist without clobbering existing values.
  if (typeof data.version !== 'number') data.version = 0
  if (!data.packages || typeof data.packages !== 'object') data.packages = {}
  if (!data.settings || typeof data.settings !== 'object') data.settings = {}

  const packages = data.packages as Record<string, Partial<TrackedPackage>>

  // --- Step: v0 -> v1 -------------------------------------------------------
  // Normalize each package to the full TrackedPackage shape, filling defaults
  // for fields that did not exist in older versions. Never remove a package.
  if ((data.version as number) < 1) {
    for (const [name, pkg] of Object.entries(packages)) {
      const p = (pkg && typeof pkg === 'object' ? pkg : {}) as Partial<TrackedPackage>
      packages[name] = {
        // Preserve any extra/unknown per-package fields first...
        ...p,
        // ...then guarantee the required fields exist.
        name: p.name ?? name,
        addedAt: typeof p.addedAt === 'string' ? p.addedAt : new Date(0).toISOString(),
        favorite: typeof p.favorite === 'boolean' ? p.favorite : false,
        tags: Array.isArray(p.tags) ? p.tags : [],
      }
    }
    data.version = 1
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
    throw new Error(`Failed to read Siz data at ${file}: ${(err as Error).message}`)
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

export function trackPackage(
  pkg: { name: string; version?: string; category?: string },
  file?: string,
): TrackedPackage {
  return withData(file, (data) => {
    const existing = data.packages[pkg.name]
    if (existing) {
      // Update version/category without discarding favorites/tags.
      if (pkg.version) existing.version = pkg.version
      if (pkg.category && !existing.category) existing.category = pkg.category
      return existing
    }
    const created: TrackedPackage = {
      ...newPackage(pkg.name),
      ...(pkg.version ? { version: pkg.version } : {}),
      ...(pkg.category ? { category: pkg.category } : {}),
    }
    data.packages[pkg.name] = created
    return created
  })
}

export function setFavorite(name: string, favorite: boolean, file?: string): TrackedPackage {
  return withData(file, (data) => {
    const pkg = (data.packages[name] ??= newPackage(name))
    pkg.favorite = favorite
    return pkg
  })
}

export function addTags(name: string, tags: string[], file?: string): TrackedPackage {
  return withData(file, (data) => {
    const pkg = (data.packages[name] ??= newPackage(name))
    for (const t of tags) {
      const tag = t.trim()
      if (tag && !pkg.tags.includes(tag)) pkg.tags.push(tag)
    }
    return pkg
  })
}

export function removeTags(name: string, tags: string[], file?: string): TrackedPackage | undefined {
  return withData(file, (data) => {
    const pkg = data.packages[name]
    if (!pkg) return undefined
    pkg.tags = pkg.tags.filter((t) => !tags.includes(t))
    return pkg
  })
}

export function setCategory(name: string, category: string, file?: string): TrackedPackage {
  return withData(file, (data) => {
    const pkg = (data.packages[name] ??= newPackage(name))
    pkg.category = category
    return pkg
  })
}

export function untrack(name: string, file?: string): boolean {
  return withData(file, (data) => {
    if (!data.packages[name]) return false
    delete data.packages[name]
    return true
  })
}

/** Sort tracked packages favorites-first, then alphabetically by name. */
export function sortByFavoriteThenName(pkgs: TrackedPackage[]): TrackedPackage[] {
  return pkgs.sort((a, b) =>
    a.favorite !== b.favorite ? (a.favorite ? -1 : 1) : a.name.localeCompare(b.name),
  )
}

/** List tracked packages with optional filters. */
export function listPackages(
  filters: { tag?: string; category?: string; favorite?: boolean } = {},
  file?: string,
): TrackedPackage[] {
  const data = loadData(file ?? getDataFile())
  return Object.values(data.packages).filter((p) => {
    if (filters.favorite && !p.favorite) return false
    if (filters.tag && !p.tags.includes(filters.tag)) return false
    if (filters.category && p.category !== filters.category) return false
    return true
  })
}
