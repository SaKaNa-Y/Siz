import type { Bundle, BundleDepType, BundlePackage, VersionStrategy } from './types.ts'

import { applyPrefix, fetchVersionInfo, type RangePrefix } from './compare.ts'

/** A single resolved package from a bundle, ready to install. */
export interface BundleInstallItem {
  name: string
  depType: BundleDepType
  strategy: VersionStrategy
  /** dist-tag latest from the registry, or null when unresolved. */
  resolved: string | null
  /** The install spec, e.g. `react@^18.2.0` or a bare `react`. */
  spec: string
  /** True when the package wasn't found on the registry. */
  missing: boolean
}

/** The result of resolving a bundle's packages against the registry. */
export interface BundleInstallPlan {
  items: BundleInstallItem[]
  /** Names of packages not found on the registry (still installed as bare specs). */
  missing: string[]
}

/** Map a version strategy to the range prefix used when writing a resolved version. */
function strategyPrefix(strategy: VersionStrategy): RangePrefix {
  if (strategy === 'caret') return '^'
  if (strategy === 'tilde') return '~'
  return '' // exact (and latest, handled separately)
}

/** A pinned entry carries its own snapshot version and skips registry resolution. */
export function isPinned(entry: BundlePackage): entry is BundlePackage & { version: string } {
  return entry.strategy === 'exact' && entry.version != null
}

/** Build the install spec for one package under its strategy. */
function specFor(name: string, strategy: VersionStrategy, version: string | null): string {
  // `latest` defers to the package manager; a bare name lets it resolve + write
  // its own range. Same fallback when we couldn't resolve a concrete version.
  if (strategy === 'latest' || !version) return name
  return `${name}@${applyPrefix(strategyPrefix(strategy), version)}`
}

/**
 * Resolve a bundle's packages against the registry (one batched request) and
 * build install specs honoring each package's version strategy. Versions are
 * resolved fresh here, never snapshotted — a bundle install always targets the
 * current latest.
 */
export async function resolveBundleInstall(bundle: Bundle): Promise<BundleInstallPlan> {
  const entries = Object.values(bundle.packages)
  // Pinned entries carry their own version — only fetch the rest.
  const versions = await fetchVersionInfo(entries.filter((e) => !isPinned(e)).map((e) => e.name))

  const items: BundleInstallItem[] = entries.map((e) => {
    const pinned = isPinned(e)
    const info = pinned ? undefined : versions.get(e.name)
    // Pinned → its snapshot; otherwise the registry's current latest.
    const resolved = pinned ? e.version : info?.exists ? info.latest : null
    return {
      name: e.name,
      depType: e.depType,
      strategy: e.strategy,
      resolved,
      spec: specFor(e.name, e.strategy, resolved),
      missing: pinned ? false : !info?.exists,
    }
  })

  return { items, missing: items.filter((i) => i.missing).map((i) => i.name) }
}
