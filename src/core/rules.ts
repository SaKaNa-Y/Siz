import { readFileSync } from 'node:fs'

import { findUp } from './paths.ts'
import { escapeRegExp } from './text.ts'

/** Filename Siz reads for project-local dependency rules. */
export const CONFIG_FILENAME = 'siz.config.json'

/** Allow/deny glob patterns for package names. No versions in v1. */
export interface DependencyRules {
  allow: string[]
  deny: string[]
}

/** Parsed `siz.config.json` shape. `$schema` is tolerated and ignored. */
export interface SizConfig {
  $schema?: string
  rules?: { allow?: string[]; deny?: string[] }
}

/** Verdict for a single package name. `reason` is set only when blocked. */
export interface RuleVerdict {
  allowed: boolean
  reason?: string
}

/** Pure partition of items into allowed vs blocked (with the reason each was blocked). */
export interface RulePartition<T> {
  allowed: T[]
  blocked: { item: T; reason: string }[]
}

/** Loaded rules plus the config path they came from, for messaging. */
export interface LoadedRules {
  rules: DependencyRules
  path: string
}

/**
 * Compile an anchored glob pattern to a RegExp. `*` becomes `.*` (slash-agnostic);
 * every other regex metachar is escaped, so `lodash` is exact, `*-deprecated` is a
 * suffix match, `@ourorg/*` matches `@ourorg/foo`, and `*` matches everything.
 *
 * Note: `escapeRegExp` escapes `*`, so we split on `*` first and escape only the
 * literal segments.
 */
export function globToRegExp(pattern: string): RegExp {
  const body = pattern.split('*').map(escapeRegExp).join('.*')
  return new RegExp(`^${body}$`)
}

/** True when `name` matches the glob `pattern`. */
export function matchesPattern(name: string, pattern: string): boolean {
  return globToRegExp(pattern).test(name)
}

/**
 * Evaluate one package name against the rules. Deny always wins:
 *   permitted = (allow empty OR name matches some allow) AND NOT (name matches some deny)
 */
export function evaluateRule(name: string, rules: DependencyRules): RuleVerdict {
  const deny = rules.deny.find((p) => matchesPattern(name, p))
  if (deny) return { allowed: false, reason: `denied by "${deny}"` }
  if (rules.allow.length > 0 && !rules.allow.some((p) => matchesPattern(name, p))) {
    return { allowed: false, reason: 'not in allow list' }
  }
  return { allowed: true }
}

/**
 * Partition `items` into allowed/blocked using a name selector, so it works on
 * plain strings and on objects that carry a `name` (interactive `Selection`,
 * bundle install items). Originals are preserved in both buckets.
 */
export function partitionByRules<T>(
  items: T[],
  rules: DependencyRules,
  getName: (item: T) => string = (x) => x as unknown as string,
): RulePartition<T> {
  const allowed: T[] = []
  const blocked: { item: T; reason: string }[] = []
  for (const item of items) {
    const verdict = evaluateRule(getName(item), rules)
    if (verdict.allowed) allowed.push(item)
    else blocked.push({ item, reason: verdict.reason ?? 'blocked by dependency rules' })
  }
  return { allowed, blocked }
}

/** Normalize a parsed config into concrete allow/deny arrays (tolerant of partials). */
export function normalizeRules(config: SizConfig | undefined): DependencyRules {
  return {
    allow: config?.rules?.allow ?? [],
    deny: config?.rules?.deny ?? [],
  }
}

/**
 * Load the nearest `siz.config.json` (walking up from `cwd`). Returns `undefined`
 * when no file exists — a missing config means everything is allowed. Throws a
 * friendly Error on malformed JSON (fail-closed: a broken committed policy must
 * never silently wave packages through). Mirrors `loadManifestAt` / `loadCatalogManifest`.
 */
export function loadRules(cwd?: string): LoadedRules | undefined {
  const path = findUp(CONFIG_FILENAME, cwd)
  if (!path) return undefined

  const raw = readFileSync(path, 'utf8')
  let parsed: SizConfig
  try {
    parsed = JSON.parse(raw) as SizConfig
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`, { cause: err })
  }
  return { rules: normalizeRules(parsed), path }
}
