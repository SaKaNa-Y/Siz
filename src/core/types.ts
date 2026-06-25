import type { Agent } from 'package-manager-detector'

/** A package the user has favorited in Siz. */
export interface FavoritePackage {
  /** npm package name, e.g. "lodash" or "@vue/reactivity". */
  name: string
  /** ISO timestamp of when it was first favorited. */
  addedAt: string
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
  /** Favorited packages keyed by package name. */
  favorites: Record<string, FavoritePackage>
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

/**
 * Maintenance/health facts about a package, fetched separately from the search
 * endpoint (which does not return them) and surfaced inline on a result. Purely
 * informational — never blocks, filters, or reranks. All fields optional: an
 * empty object means "no signals to show".
 */
export interface TrustSignals {
  /** Non-empty deprecation message when the package is deprecated. */
  deprecated?: string
  /** ISO publish date of the latest version. */
  publishedAt?: string
  /** True when the package has npm provenance or a trusted publisher. */
  provenance?: boolean
  /**
   * Successor package name(s) parsed (high-confidence only) from the deprecation
   * message — what the maintainer pointed users to. Absent when not deprecated or
   * when the message names no clear successor. Informational, never editorial.
   */
  replacedBy?: string[]
  /**
   * Download-trend direction, derived from npm's download API (a different
   * endpoint than the search/metadata sources above). `undefined` when the
   * trend is flat, below the volume floor, or unavailable (e.g. scoped packages).
   */
  momentum?: 'rising' | 'falling'
}
