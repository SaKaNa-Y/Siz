import type { ReleaseType } from 'semver'

import { getVersionsBatch } from 'fast-npm-meta'
import { diff, gt, maxSatisfying, minVersion, prerelease, valid } from 'semver'

import type { CatalogManifest } from './catalog.ts'
import type { DepType, ProjectDep, ProjectManifest } from './project.ts'

import { isUpgradableSpecifier } from './project.ts'

/** Upgrade ceiling: how far a version is allowed to move. */
export type UpgradeMode = 'major' | 'minor' | 'patch' | 'latest'

/** semver bump classification between two versions, or null when indeterminate. */
export type DiffLevel = ReleaseType | null

/** Why a dependency was excluded from the upgradable set. */
export type SkipReason = 'protocol' | 'not-found' | 'unparseable' | 'up-to-date'

/** Registry version data for a single package. */
export interface VersionInfo {
  name: string
  versions: string[]
  latest: string | null
  /** False when the package isn't on the registry. */
  exists: boolean
}

/** The result of analyzing one dependency against the registry under a mode. */
export interface DepAnalysis {
  name: string
  depType: DepType
  range: string
  /** Lowest version satisfying the current range, or null if unparseable. */
  current: string | null
  /** dist-tag latest, for display + filter classification. */
  latest: string | null
  /** Resolved upgrade target under the mode, or null when none applies. */
  target: string | null
  /** Bump level current → target. */
  diff: DiffLevel
  /** Bump level current → latest (independent of mode). */
  latestDiff: DiffLevel
  skip?: SkipReason
}

/** An analysis that has a concrete upgrade to offer. */
export interface UpgradePlanItem extends DepAnalysis {
  current: string
  target: string
  /** The new specifier to write, with the original prefix re-applied. */
  proposed: string
}

/** A partitioned view of every dependency under a mode. */
export interface UpgradePlan {
  upgradable: UpgradePlanItem[]
  upToDate: DepAnalysis[]
  skipped: { name: string; depType: DepType; reason: SkipReason }[]
}

export type RangePrefix = '^' | '~' | '' | 'complex'

/** Classify the leading operator of a version range. */
export function detectRangePrefix(range: string): RangePrefix {
  const r = range.trim()
  if (/^\^\d/.test(r)) return '^'
  if (/^~\d/.test(r)) return '~'
  // A bare, fully-valid version (e.g. `1.2.3`) is an exact pin.
  if (valid(r)) return ''
  // Anything else (`>=2 <3`, `1.x`, `a || b`, hyphen ranges) is too complex to rewrite safely.
  return 'complex'
}

/** Re-apply a detected prefix to a resolved version. */
export function applyPrefix(prefix: RangePrefix, version: string): string {
  switch (prefix) {
    case '^':
      return `^${version}`
    case '~':
      return `~${version}`
    default:
      return version
  }
}

/** The lowest version satisfying a range, or null if it can't be parsed. */
export function currentVersionFromRange(range: string): string | null {
  try {
    return minVersion(range)?.version ?? null
  } catch {
    return null
  }
}

/** semver bump classification between two versions, swallowing parse errors. */
export function safeDiff(from: string, to: string): DiffLevel {
  try {
    return diff(from, to)
  } catch {
    return null
  }
}

/** Versions valid for resolution: stable, plus prereleases only if current is one. */
export function stableCandidates(versions: string[], currentIsPre: boolean): string[] {
  return versions.filter((v) => {
    if (!valid(v)) return false
    if (!currentIsPre && (prerelease(v)?.length ?? 0) > 0) return false
    return true
  })
}

/**
 * Resolve the highest version reachable from `current` under `mode`.
 *
 * Ceiling semantics (taze-style):
 * - `patch`        → newest within the same major.minor (`~current`)
 * - `minor`        → newest within the same major (`^current`)
 * - `major`/`latest` → newest stable overall (`*`)
 *
 * Pre-1.0 caution comes for free: caret/tilde on a `0.x` version already keep
 * the bump inside the same `0.minor`, so `siz upgrade minor` won't cross a
 * breaking `0.x` boundary. Prereleases are excluded unless `current` is one.
 */
export function resolveTarget(
  current: string,
  info: VersionInfo,
  mode: UpgradeMode,
): string | null {
  const currentIsPre = (prerelease(current)?.length ?? 0) > 0
  const candidates = stableCandidates(info.versions, currentIsPre)
  if (candidates.length === 0) return null

  let range: string
  switch (mode) {
    case 'patch':
      range = `~${current}`
      break
    case 'minor':
      range = `^${current}`
      break
    default:
      range = '*'
  }
  return maxSatisfying(candidates, range, { includePrerelease: currentIsPre })
}

/** Analyze a single dependency against its registry info under a mode. */
export function analyzeDep(
  dep: ProjectDep,
  info: VersionInfo | undefined,
  mode: UpgradeMode,
): DepAnalysis {
  const base = { name: dep.name, depType: dep.depType, range: dep.range }
  const none = { current: null, latest: null, target: null, diff: null, latestDiff: null }

  if (!isUpgradableSpecifier(dep.range)) {
    return { ...base, ...none, skip: 'protocol' }
  }
  if (!info || !info.exists) {
    return { ...base, ...none, current: currentVersionFromRange(dep.range), skip: 'not-found' }
  }

  const prefix = detectRangePrefix(dep.range)
  const current = currentVersionFromRange(dep.range)
  if (current === null || prefix === 'complex') {
    return { ...base, ...none, current, latest: info.latest, skip: 'unparseable' }
  }

  const latest = info.latest
  const latestDiff = latest && valid(latest) ? safeDiff(current, latest) : null
  const target = resolveTarget(current, info, mode)
  if (!target || !gt(target, current)) {
    return { ...base, current, latest, target: null, diff: null, latestDiff, skip: 'up-to-date' }
  }
  return { ...base, current, latest, target, diff: safeDiff(current, target), latestDiff }
}

/** Build the upgradable item for a non-skipped analysis: attach the prefixed `proposed` range. */
function toUpgradePlanItem(a: DepAnalysis): UpgradePlanItem {
  const proposed = applyPrefix(detectRangePrefix(a.range), a.target as string)
  return { ...a, current: a.current as string, target: a.target as string, proposed }
}

/** Partition every dependency into upgradable / up-to-date / skipped under a mode. */
export function buildUpgradePlan(
  deps: ProjectDep[],
  versions: Map<string, VersionInfo>,
  mode: UpgradeMode,
): UpgradePlan {
  const upgradable: UpgradePlanItem[] = []
  const upToDate: DepAnalysis[] = []
  const skipped: UpgradePlan['skipped'] = []

  for (const dep of deps) {
    const a = analyzeDep(dep, versions.get(dep.name), mode)
    if (a.skip === 'up-to-date') {
      upToDate.push(a)
    } else if (a.skip) {
      skipped.push({ name: a.name, depType: a.depType, reason: a.skip })
    } else {
      upgradable.push(toUpgradePlanItem(a))
    }
  }
  return { upgradable, upToDate, skipped }
}

/** A manifest paired with its computed upgrade plan. */
export interface ManifestPlan {
  manifest: ProjectManifest
  plan: UpgradePlan
}

/**
 * Unique upgradable dependency names across every manifest — the set to fetch
 * registry data for in a single batched request.
 */
export function collectQueryNames(manifests: ProjectManifest[]): string[] {
  const names = new Set<string>()
  for (const m of manifests) {
    for (const dep of m.deps) {
      if (isUpgradableSpecifier(dep.range)) names.add(dep.name)
    }
  }
  return [...names]
}

/**
 * Plan each manifest independently against a shared registry map. Resolution is
 * per-package (Taze-style): the same dependency in two manifests is analyzed
 * separately, though it draws from the same {@link VersionInfo} data.
 */
export function planManifests(
  manifests: ProjectManifest[],
  versions: Map<string, VersionInfo>,
  mode: UpgradeMode,
): ManifestPlan[] {
  return manifests.map((manifest) => ({
    manifest,
    plan: buildUpgradePlan(manifest.deps, versions, mode),
  }))
}

/** An upgradable pnpm catalog entry, tagged with the catalog it lives in. */
export interface CatalogPlanItem extends UpgradePlanItem {
  /** `'default'` for the top-level `catalog:` block, otherwise the named catalog. */
  catalog: string
}

/**
 * Unique upgradable catalog entry names — joined with {@link collectQueryNames}
 * so catalog versions share the single batched registry request.
 */
export function collectCatalogNames(catalog: CatalogManifest): string[] {
  const names = new Set<string>()
  for (const entry of catalog.entries) {
    if (isUpgradableSpecifier(entry.range)) names.add(entry.name)
  }
  return [...names]
}

/**
 * Plan each catalog entry against the shared registry map, reusing the same
 * per-package analysis as package.json deps. Each entry is treated as a
 * standalone `dependencies` range; only those with a concrete upgrade are kept.
 */
export function planCatalog(
  catalog: CatalogManifest,
  versions: Map<string, VersionInfo>,
  mode: UpgradeMode,
): CatalogPlanItem[] {
  const items: CatalogPlanItem[] = []
  for (const entry of catalog.entries) {
    const dep: ProjectDep = { name: entry.name, range: entry.range, depType: 'dependencies' }
    const a = analyzeDep(dep, versions.get(entry.name), mode)
    if (a.skip) continue
    items.push({ ...toUpgradePlanItem(a), catalog: entry.catalog })
  }
  return items
}

/** Fetch registry version lists for a set of package names (one batched request). */
export async function fetchVersionInfo(names: string[]): Promise<Map<string, VersionInfo>> {
  const map = new Map<string, VersionInfo>()
  if (names.length === 0) return map
  const results = await getVersionsBatch(names, { throw: false })
  for (const r of results) {
    if ('error' in r) {
      map.set(r.name, { name: r.name, versions: [], latest: null, exists: false })
    } else {
      map.set(r.name, {
        name: r.name,
        versions: r.versions ?? [],
        latest: r.distTags?.latest ?? null,
        exists: true,
      })
    }
  }
  return map
}
