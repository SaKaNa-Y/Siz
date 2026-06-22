import { gt, maxSatisfying, prerelease, valid } from 'semver'

import type { CatalogManifest } from './catalog.ts'
import type { DepType, ProjectDep, ProjectManifest } from './project.ts'
import type { DiffLevel, SkipReason, VersionInfo } from './upgrade.ts'

import { isUpgradableSpecifier } from './project.ts'
import { currentVersionFromRange, safeDiff, stableCandidates } from './upgrade.ts'

/**
 * One dependency that is behind the registry: its declared `current` (range
 * floor), the highest version still satisfying its range (`wanted`), and the
 * `latest` dist-tag. A dependency is *outdated* when `latest > current`.
 */
export interface OutdatedItem {
  name: string
  depType: DepType
  range: string
  /** Lowest version satisfying the range — siz's "current" (not the installed version). */
  current: string
  /** Highest version satisfying the literal range (npm-style "wanted"). */
  wanted: string
  /** dist-tag latest. */
  latest: string
  /** Bump level current → wanted. */
  wantedDiff: DiffLevel
  /** Bump level current → latest. */
  latestDiff: DiffLevel
}

/** A partitioned, read-only view of every dependency against the registry. */
export interface OutdatedReport {
  outdated: OutdatedItem[]
  skipped: { name: string; depType: DepType; reason: SkipReason }[]
  /** Count of dependencies already at the latest version. */
  upToDate: number
}

/** The analysis of one dependency: an outdated item, a skip reason, or up-to-date. */
type OutdatedAnalysis =
  | { kind: 'outdated'; item: OutdatedItem }
  | { kind: 'skipped'; reason: SkipReason }
  | { kind: 'up-to-date' }

/**
 * Analyze one dependency against its registry info. Unlike the upgrade path,
 * this is read-only: it never rewrites a range, so it can report **complex**
 * ranges (`>=2 <3`, `1.x`, …) too — `wanted` is simply the highest version
 * satisfying the literal range. Prereleases are excluded unless `current` is
 * itself a prerelease (mirrors `resolveTarget`).
 */
export function analyzeOutdated(dep: ProjectDep, info: VersionInfo | undefined): OutdatedAnalysis {
  if (!isUpgradableSpecifier(dep.range)) return { kind: 'skipped', reason: 'protocol' }
  if (!info || !info.exists) return { kind: 'skipped', reason: 'not-found' }

  const current = currentVersionFromRange(dep.range)
  if (current === null) return { kind: 'skipped', reason: 'unparseable' }

  const latest = info.latest
  if (!latest || !valid(latest) || !gt(latest, current)) return { kind: 'up-to-date' }

  const currentIsPre = (prerelease(current)?.length ?? 0) > 0
  const candidates = stableCandidates(info.versions, currentIsPre)
  const wanted =
    maxSatisfying(candidates, dep.range, { includePrerelease: currentIsPre }) ?? current

  return {
    kind: 'outdated',
    item: {
      name: dep.name,
      depType: dep.depType,
      range: dep.range,
      current,
      wanted,
      latest,
      wantedDiff: safeDiff(current, wanted),
      latestDiff: safeDiff(current, latest),
    },
  }
}

/** Partition every dependency into outdated / skipped / up-to-date. */
export function buildOutdatedReport(
  deps: ProjectDep[],
  versions: Map<string, VersionInfo>,
): OutdatedReport {
  const outdated: OutdatedItem[] = []
  const skipped: OutdatedReport['skipped'] = []
  let upToDate = 0

  for (const dep of deps) {
    const a = analyzeOutdated(dep, versions.get(dep.name))
    if (a.kind === 'outdated') outdated.push(a.item)
    else if (a.kind === 'skipped')
      skipped.push({ name: dep.name, depType: dep.depType, reason: a.reason })
    else upToDate++
  }
  return { outdated, skipped, upToDate }
}

/** A manifest paired with its computed outdated report. */
export interface ManifestOutdated {
  manifest: ProjectManifest
  report: OutdatedReport
}

/** Build an outdated report for each manifest against the shared registry map. */
export function planManifestsOutdated(
  manifests: ProjectManifest[],
  versions: Map<string, VersionInfo>,
): ManifestOutdated[] {
  return manifests.map((manifest) => ({
    manifest,
    report: buildOutdatedReport(manifest.deps, versions),
  }))
}

/** An outdated pnpm catalog entry, tagged with the catalog it lives in. */
export interface CatalogOutdatedItem extends OutdatedItem {
  /** `'default'` for the top-level `catalog:` block, otherwise the named catalog. */
  catalog: string
}

/**
 * Report outdated pnpm catalog entries, reusing the same per-dependency analysis
 * as package.json deps. Skipped/up-to-date entries are dropped.
 */
export function planCatalogOutdated(
  catalog: CatalogManifest,
  versions: Map<string, VersionInfo>,
): CatalogOutdatedItem[] {
  const items: CatalogOutdatedItem[] = []
  for (const entry of catalog.entries) {
    const dep: ProjectDep = { name: entry.name, range: entry.range, depType: 'dependencies' }
    const a = analyzeOutdated(dep, versions.get(entry.name))
    if (a.kind === 'outdated') items.push({ ...a.item, catalog: entry.catalog })
  }
  return items
}
