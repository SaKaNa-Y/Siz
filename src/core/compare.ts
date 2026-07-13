import type { ReleaseType } from 'semver'

import { getVersionsBatch } from 'fast-npm-meta'
import { diff, minVersion, prerelease, valid } from 'semver'

import type { DepType, ProjectDep } from './project.ts'

import { isUpgradableSpecifier } from './project.ts'

/**
 * Registry comparison — the neutral, per-dependency comparison of a declared
 * range against the registry's published versions. It computes only the facts
 * that `siz upgrade` and `siz outdated` share (range-floor `current`, `latest`,
 * bump level, range prefix, candidate versions); each command then specializes
 * these facts into its own question (upgrade → a target under a mode ceiling;
 * outdated → the highest version satisfying the literal range). See ADR 0007.
 */

/** semver bump classification between two versions, or null when indeterminate. */
export type DiffLevel = ReleaseType | null

/** Why a dependency can't be compared against the registry at all. */
export type CompareSkip = 'protocol' | 'not-found' | 'unparseable'

/** Registry version data for a single package. */
export interface VersionInfo {
  name: string
  versions: string[]
  latest: string | null
  /** False when the package isn't on the registry. */
  exists: boolean
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
 * The neutral facts about one dependency versus the registry. Shared by the
 * upgrade and outdated specializers. Note `prefix` is a **fact**, not a skip:
 * a `complex` range is reported here (read-only `outdated` uses it; rewrite-safe
 * `upgrade` turns it into its own skip).
 */
export interface DepComparison {
  name: string
  depType: DepType
  range: string
  /** Lowest version satisfying the range — siz's "current" (range floor). */
  current: string
  /** dist-tag latest. */
  latest: string | null
  /** Bump level current → latest. */
  latestDiff: DiffLevel
  /** Leading operator of the declared range. */
  prefix: RangePrefix
  /** Whether `current` is itself a prerelease. */
  currentIsPre: boolean
  /** Versions valid for resolution (stable, plus prereleases iff current is one). */
  candidates: string[]
}

/** The result of comparing one dependency: a skip reason, or the neutral facts. */
export type CompareResult =
  | { kind: 'skipped'; reason: CompareSkip }
  | { kind: 'comparison'; facts: DepComparison }

/**
 * Compare one dependency against its registry info, producing the neutral facts
 * both `siz upgrade` and `siz outdated` build on. Skips only on the truly shared
 * conditions — a non-registry protocol, a package missing from the registry, or
 * a range whose floor can't be parsed. A `complex` range is **not** a skip: it
 * comes back as a fact (`prefix: 'complex'`) so each command decides what to do.
 */
export function compareDep(dep: ProjectDep, info: VersionInfo | undefined): CompareResult {
  if (!isUpgradableSpecifier(dep.range)) return { kind: 'skipped', reason: 'protocol' }
  if (!info || !info.exists) return { kind: 'skipped', reason: 'not-found' }

  const current = currentVersionFromRange(dep.range)
  if (current === null) return { kind: 'skipped', reason: 'unparseable' }

  const latest = info.latest
  const latestDiff = latest && valid(latest) ? safeDiff(current, latest) : null
  const currentIsPre = (prerelease(current)?.length ?? 0) > 0

  return {
    kind: 'comparison',
    facts: {
      name: dep.name,
      depType: dep.depType,
      range: dep.range,
      current,
      latest,
      latestDiff,
      prefix: detectRangePrefix(dep.range),
      currentIsPre,
      candidates: stableCandidates(info.versions, currentIsPre),
    },
  }
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
