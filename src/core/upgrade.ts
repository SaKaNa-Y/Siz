import { gt, maxSatisfying, prerelease } from 'semver'

import type { CatalogManifest } from './catalog.ts'
import type { CompareSkip, DiffLevel, VersionInfo } from './compare.ts'
import type { DepType, ProjectDep, ProjectManifest } from './project.ts'

import {
  applyPrefix,
  compareDep,
  currentVersionFromRange,
  detectRangePrefix,
  safeDiff,
  stableCandidates,
} from './compare.ts'

/** Upgrade ceiling: how far a version is allowed to move. */
export type UpgradeMode = 'major' | 'minor' | 'patch'

/** Accepted `siz upgrade [level]` values, in the order the help text lists them. */
export const UPGRADE_LEVELS: readonly UpgradeMode[] = ['major', 'minor', 'patch']

/** The level bare `siz upgrade` means: newest overall. */
export const DEFAULT_UPGRADE_MODE: UpgradeMode = 'major'

/**
 * Validate a `siz upgrade [level]` argument. Omitted means `major` (newest
 * overall) — the one name for that ceiling, so `latest` is rejected like any
 * other unknown level rather than silently aliasing `major`.
 */
export function parseUpgradeMode(level: string | undefined): UpgradeMode {
  if (level == null) return DEFAULT_UPGRADE_MODE
  const mode = level as UpgradeMode
  if (!UPGRADE_LEVELS.includes(mode)) {
    throw new Error(`Unknown upgrade level "${level}". Use: ${UPGRADE_LEVELS.join(' | ')}`)
  }
  return mode
}

/** Why a dependency was excluded from the upgradable set. */
export type SkipReason = CompareSkip | 'up-to-date'

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

/**
 * Resolve the highest version reachable from `current` under `mode`.
 *
 * Ceiling semantics (taze-style):
 * - `patch` → newest within the same major.minor (`~current`)
 * - `minor` → newest within the same major (`^current`)
 * - `major` → newest stable overall (`*`)
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

/**
 * Analyze a single dependency against its registry info under a mode. Builds on
 * the neutral {@link compareDep} facts, then applies upgrade semantics: a
 * `complex` range is skipped (it can't be rewritten safely), and a concrete
 * target is resolved under the mode ceiling.
 */
export function analyzeDep(
  dep: ProjectDep,
  info: VersionInfo | undefined,
  mode: UpgradeMode,
): DepAnalysis {
  const base = { name: dep.name, depType: dep.depType, range: dep.range }
  const none = { current: null, latest: null, target: null, diff: null, latestDiff: null }

  const result = compareDep(dep, info)
  if (result.kind === 'skipped') {
    if (result.reason === 'protocol') return { ...base, ...none, skip: 'protocol' }
    if (result.reason === 'not-found') {
      return { ...base, ...none, current: currentVersionFromRange(dep.range), skip: 'not-found' }
    }
    return { ...base, ...none, latest: info?.latest ?? null, skip: 'unparseable' }
  }

  const f = result.facts
  if (f.prefix === 'complex') {
    return { ...base, ...none, current: f.current, latest: f.latest, skip: 'unparseable' }
  }

  const target = info ? resolveTarget(f.current, info, mode) : null
  if (!target || !gt(target, f.current)) {
    return {
      ...base,
      current: f.current,
      latest: f.latest,
      target: null,
      diff: null,
      latestDiff: f.latestDiff,
      skip: 'up-to-date',
    }
  }
  return {
    ...base,
    current: f.current,
    latest: f.latest,
    target,
    diff: safeDiff(f.current, target),
    latestDiff: f.latestDiff,
  }
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
