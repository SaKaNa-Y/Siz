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

/** Persisted Siz data file shape. Stored in the user config dir. */
export interface SizData {
  /** JSON Schema hint for editors (optional, informational). */
  $schema?: string
  /** Schema version for non-destructive migrations. */
  version: number
  /** Tracked packages keyed by package name. */
  packages: Record<string, TrackedPackage>
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
