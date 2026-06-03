import type { Agent } from 'package-manager-detector'

/** A package the user has chosen to track in Siz. */
export interface TrackedPackage {
  /** npm package name, e.g. "lodash" or "@vue/reactivity". */
  name: string
  /** ISO timestamp of when it was first tracked. */
  addedAt: string
  /** Whether the user marked it as a favorite. */
  favorite: boolean
  /** User-defined tags, e.g. ["lightweight", "production"]. */
  tags: string[]
  /** Optional category (see core/categories.ts). */
  category?: string
  /** Optional free-form note. */
  note?: string
  /** Last resolved version, cached for display (optional). */
  version?: string
}

/** How a bundle package's version range is written at install time. */
export type VersionStrategy = 'latest' | 'exact' | 'caret' | 'tilde'

/**
 * The dependency bucket a bundle package targets. A superset of project.ts's
 * `DepType` — named distinctly to avoid a conflict, and to allow storing
 * peer/optional even though v1 install only distinguishes prod vs dev.
 */
export type BundleDepType =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies'

/**
 * One package entry inside a bundle. For most strategies the concrete version
 * is resolved fresh at install; when `strategy === 'exact'` the `version` below
 * pins the snapshot taken when the package was added.
 */
export interface BundlePackage {
  name: string
  strategy: VersionStrategy
  depType: BundleDepType
  /** Pinned version, set when `strategy === 'exact'` from a snapshot at add time. */
  version?: string
}

/** A named, reusable collection of packages for one-click installation. */
export interface Bundle {
  name: string
  description?: string
  tags: string[]
  /** Entries keyed by package name (dedupe-by-name, last-write-wins). */
  packages: Record<string, BundlePackage>
  /** Preferred package manager; seeds the install picker default. */
  packageManager?: Agent
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of the last install; drives `bundle list` sort. */
  lastUsedAt?: string
}

/** Persisted Siz data file shape. Stored in the user config dir. */
export interface SizData {
  /** JSON Schema hint for editors (optional, informational). */
  $schema?: string
  /** Schema version for non-destructive migrations. */
  version: number
  /** Tracked packages keyed by package name. */
  packages: Record<string, TrackedPackage>
  /** Saved bundles keyed by bundle name. */
  bundles: Record<string, Bundle>
  /** User settings (reserved for future use). */
  settings: Record<string, unknown>
  /** Preserve any unknown top-level keys across read/write. */
  [extra: string]: unknown
}

/** A single search result from the npm registry search API. */
export interface SearchResult {
  name: string
  version: string
  description: string
  keywords: string[]
  /** Best available link (homepage > repository > npm page). */
  link?: string
  npmLink?: string
  publisher?: string
  /** Normalized 0..1 quality/popularity/maintenance scores. */
  score: {
    final: number
    quality: number
    popularity: number
    maintenance: number
  }
  /** Raw search relevance score from the registry. */
  searchScore: number
}
