import { gt, maxSatisfying, valid } from 'semver'

import type { CatalogManifest } from './catalog.ts'
import type { CompareSkip, DiffLevel, VersionInfo } from './compare.ts'
import type { DepType, ProjectDep, ProjectManifest } from './project.ts'

import { compareDep, safeDiff } from './compare.ts'

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
  skipped: { name: string; depType: DepType; reason: CompareSkip }[]
  /** Count of dependencies already at the latest version. */
  upToDate: number
}

/** The analysis of one dependency: an outdated item, a skip reason, or up-to-date. */
type OutdatedAnalysis =
  | { kind: 'outdated'; item: OutdatedItem }
  | { kind: 'skipped'; reason: CompareSkip }
  | { kind: 'up-to-date' }

/**
 * Analyze one dependency against its registry info. Builds on the neutral
 * {@link compareDep} facts. Unlike the upgrade path, this is read-only: it never
 * rewrites a range, so it can report **complex** ranges (`>=2 <3`, `1.x`, …)
 * too — `wanted` is simply the highest version satisfying the literal range.
 * Prereleases are excluded unless `current` is itself a prerelease.
 */
export function analyzeOutdated(dep: ProjectDep, info: VersionInfo | undefined): OutdatedAnalysis {
  const result = compareDep(dep, info)
  if (result.kind === 'skipped') return { kind: 'skipped', reason: result.reason }

  const f = result.facts
  const latest = f.latest
  if (!latest || !valid(latest) || !gt(latest, f.current)) return { kind: 'up-to-date' }

  const wanted =
    maxSatisfying(f.candidates, dep.range, { includePrerelease: f.currentIsPre }) ?? f.current

  return {
    kind: 'outdated',
    item: {
      name: f.name,
      depType: f.depType,
      range: f.range,
      current: f.current,
      wanted,
      latest,
      wantedDiff: safeDiff(f.current, wanted),
      latestDiff: f.latestDiff,
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
