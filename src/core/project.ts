import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import process from 'node:process'
import { glob } from 'tinyglobby'

import { escapeRegExp } from './text.ts'

/** The two dependency blocks Siz upgrades. */
export type DepType = 'dependencies' | 'devDependencies'

/** A single dependency entry read from a project's package.json. */
export interface ProjectDep {
  name: string
  /** The raw version specifier as written, e.g. `^1.2.3`, `~1.0.0`, `workspace:*`. */
  range: string
  depType: DepType
}

/** A loaded project manifest plus the dependencies extracted from it. */
export interface ProjectManifest {
  /** Absolute path to the package.json. */
  path: string
  /** The original file text — the source of truth for format-preserving writes. */
  raw: string
  data: Record<string, unknown>
  deps: ProjectDep[]
}

const DEP_TYPES: DepType[] = ['dependencies', 'devDependencies']

/**
 * Specifiers we never rewrite: workspace/catalog protocols, npm aliases,
 * git/file/link sources, and URLs. None of these map to a plain registry
 * semver range we can safely bump.
 */
const SKIP_PROTOCOL =
  /^(workspace:|catalog:|npm:|file:|link:|portal:|git\+|git:|github:|gitlab:|bitbucket:|https?:\/\/)/i

/** Bare dist-tags / wildcards that aren't concrete versions. */
const SKIP_TAGS = new Set(['*', 'latest', 'next', 'x'])

/** True when a specifier is a registry version range Siz can resolve and rewrite. */
export function isUpgradableSpecifier(range: string): boolean {
  const r = range.trim()
  if (!r) return false
  if (SKIP_PROTOCOL.test(r)) return false
  if (SKIP_TAGS.has(r.toLowerCase())) return false
  return true
}

/** Walk up from `cwd` to the filesystem root, returning the nearest package.json. */
export function findPackageJson(cwd: string = process.cwd()): string | undefined {
  let dir = cwd
  while (dir) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined // reached the filesystem root
    dir = parent
  }
  return undefined
}

/** Extract every string-valued dependency from both dep blocks. */
export function collectDeps(data: Record<string, unknown>): ProjectDep[] {
  const deps: ProjectDep[] = []
  for (const depType of DEP_TYPES) {
    const block = data[depType]
    if (!block || typeof block !== 'object') continue
    for (const [name, range] of Object.entries(block as Record<string, unknown>)) {
      if (typeof range !== 'string') continue
      deps.push({ name, range, depType })
    }
  }
  return deps
}

/** Read, parse, and collect deps from a single package.json at `path`. */
export function loadManifestAt(path: string): ProjectManifest {
  const raw = readFileSync(path, 'utf8')
  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw) as Record<string, unknown>
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`)
  }
  return { path, raw, data, deps: collectDeps(data) }
}

/** Load the nearest package.json (walking up from `cwd`). Returns undefined if none. */
export function loadProjectManifest(cwd?: string): ProjectManifest | undefined {
  const path = findPackageJson(cwd)
  if (!path) return undefined
  return loadManifestAt(path)
}

/** Directories never worth scanning for workspace manifests. */
const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/.git/**']

export interface DiscoverOptions {
  /** Glob every package.json under `cwd` instead of just the nearest one. */
  recursive?: boolean
  /** Extra ignore globs, merged with the defaults (node_modules, dist, .git). */
  ignore?: string[]
}

/**
 * Discover project manifests to upgrade.
 *
 * Non-recursive (default): the single nearest package.json walking up from
 * `cwd` — identical to {@link loadProjectManifest}. Recursive: a Taze-style
 * brute-force glob of every `package.json` under `cwd` (ignoring node_modules,
 * dist, .git, plus any extra `ignore` globs), sorted by path.
 */
export async function discoverManifests(
  cwd: string = process.cwd(),
  opts: DiscoverOptions = {},
): Promise<ProjectManifest[]> {
  if (!opts.recursive) {
    const manifest = loadProjectManifest(cwd)
    return manifest ? [manifest] : []
  }
  const matches = await glob('**/package.json', {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore: [...DEFAULT_IGNORE, ...(opts.ignore ?? [])],
  })
  // tinyglobby yields POSIX-style paths even on Windows; normalize to native
  // separators so results match findPackageJson()/loadProjectManifest().
  const paths = matches.map((p) => normalize(p)).sort((a, b) => a.localeCompare(b))
  return paths.map(loadManifestAt)
}

/**
 * Find the `[start, end)` span of a dependency block's `{ ... }` object in `raw`.
 * Brace-matched; package.json dep values never contain braces, so this is safe.
 */
function findBlockSpan(raw: string, depType: DepType): [number, number] | null {
  const keyRe = new RegExp(`"${depType}"\\s*:\\s*\\{`)
  const m = keyRe.exec(raw)
  if (!m) return null
  const open = raw.indexOf('{', m.index)
  let depth = 0
  for (let i = open; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return [open, i + 1]
    }
  }
  return null
}

/** Replace just the version string of `name` within one dep block. */
function replaceInBlock(raw: string, depType: DepType, name: string, specifier: string): string {
  const span = findBlockSpan(raw, depType)
  if (!span) return raw
  const [start, end] = span
  const block = raw.slice(start, end)
  // Anchored on the quoted key so `react` never matches inside `react-dom`.
  const valueRe = new RegExp(`("${escapeRegExp(name)}"\\s*:\\s*")[^"]*(")`)
  const replaced = block.replace(
    valueRe,
    (_match, p1: string, p2: string) => `${p1}${specifier}${p2}`,
  )
  return raw.slice(0, start) + replaced + raw.slice(end)
}

/**
 * Apply version-range edits to the raw package.json text without reformatting.
 * Each edit is keyed `${depType}:${name}` so a package present in both
 * `dependencies` and `devDependencies` is disambiguated. Pure — no I/O.
 */
export function applyRangeEdits(raw: string, edits: Map<string, string>): string {
  let result = raw
  for (const [key, specifier] of edits) {
    const sep = key.indexOf(':')
    const depType = key.slice(0, sep) as DepType
    const name = key.slice(sep + 1)
    result = replaceInBlock(result, depType, name, specifier)
  }
  return result
}

/** Atomically write manifest text: temp file then rename (mirrors store.saveData). */
export function writeManifest(path: string, text: string): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, path)
}
