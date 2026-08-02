import type { Agent } from 'package-manager-detector'

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

/**
 * One saved package as the flat store surfaces it: a bundle entry tagged with
 * the bundle it came from. Backs the interactive front door and `siz list`.
 */
export interface SavedEntry extends BundlePackage {
  bundle: string
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
  /**
   * The registry's own relevance number for this hit. **Internal only** — it is
   * the last tiebreaker in name-affinity ranking and is never rendered or emitted
   * in `--json`. npm's `score.quality`/`popularity`/`maintenance` are gone from
   * this shape entirely: the search endpoint now returns a constant `1.000` for
   * all three on every package, so the bars they fed were structurally always
   * full. Weekly downloads (see {@link TrustSignals.downloads}) replaced them.
   */
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
   * trend is flat, below the volume floor, or unavailable (e.g. scoped packages,
   * for which only the last-week total is fetched).
   */
  momentum?: 'rising' | 'falling'
  /**
   * Last week's total downloads, straight from npm's download API — the adoption
   * fact that replaced npm's retired quality/popularity bars. Absent when the
   * endpoint had no data for the package; a missing count renders nothing rather
   * than a zero, since "we don't know" and "nobody installs it" are not the same.
   */
  downloads?: number
}

/**
 * Weight/cost facts about a package, fetched separately from the search endpoint
 * and surfaced inline on a result — a *size signal*, distinct from the health
 * oriented {@link TrustSignals}. Purely informational; all fields optional (an
 * empty object means "no sizes to show"). See ADR 0008.
 */
export interface SizeSignals {
  /**
   * The package's own unpacked-on-disk size in bytes (npm `dist.unpackedSize`
   * of the latest version). Excludes dependencies. Fetched eagerly for every
   * result and shown on every row.
   */
  installSize?: number
  /**
   * Minified + gzipped browser-ship size in bytes, including transitive deps,
   * from Bundlephobia. Fetched lazily (focused row only) and never in
   * `--list`/`--json`, so it is absent unless a row was focused interactively.
   */
  bundle?: { gzip: number; minified: number }
}

/**
 * The license a package declares — a *legal* fact, and the third result-signal
 * family alongside the health-oriented {@link TrustSignals} and the weight
 * oriented {@link SizeSignals}. Purely informational; siz reports the declared
 * value and passes no judgement on the terms. See ADR 0009.
 *
 * Unlike its sibling families this field is **not** optional, because the
 * difference between two kinds of "nothing" is load-bearing:
 *
 * - `{ license: 'MIT' }` — declared, resolvable
 * - `{ license: null }` — the manifest resolved and declared nothing (an
 *   *unclear license*, worth flagging)
 * - **no entry at all** in a `Map<string, LicenseSignals>` — the packument never
 *   resolved, so siz knows nothing and must show nothing
 *
 * Collapse the last two and one slow network call flags every result as having
 * no license.
 */
export interface LicenseSignals {
  license: string | null
}
