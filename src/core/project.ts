import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, normalize, relative } from 'node:path'
import process from 'node:process'
import { glob } from 'tinyglobby'

import { findWorkspaceYaml, readWorkspacePackages } from './catalog.ts'
import { findUp } from './paths.ts'
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

/** Relative path from `cwd` to `dir`, or undefined when `dir` IS `cwd` (the root). */
export function relativeScope(cwd: string, dir: string): string | undefined {
  const rel = relative(cwd, dir)
  return rel === '' || rel === '.' ? undefined : rel
}

/** Walk up from `cwd` to the filesystem root, returning the nearest package.json. */
export function findPackageJson(cwd: string = process.cwd()): string | undefined {
  return findUp('package.json', cwd)
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
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`, { cause: err })
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

/** The declared workspace root and its member globs (pnpm or npm/yarn). */
export interface WorkspaceGlobs {
  /** Directory holding the workspace definition (pnpm-workspace.yaml or package.json). */
  root: string
  /** Declared member globs, e.g. `['packages/*']`. May be empty (root-only). */
  patterns: string[]
}

/** Read the npm/yarn `workspaces` field (array or `{ packages: [...] }`); undefined when absent. */
function readWorkspacesField(path: string): string[] | undefined {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
  const ws = data.workspaces
  if (Array.isArray(ws)) return ws.filter((p): p is string => typeof p === 'string')
  if (ws && typeof ws === 'object') {
    const pkgs = (ws as { packages?: unknown }).packages
    if (Array.isArray(pkgs)) return pkgs.filter((p): p is string => typeof p === 'string')
  }
  return undefined
}

/**
 * Resolve the declared workspace member globs for `cwd`, if any. Prefers pnpm's
 * `pnpm-workspace.yaml` (`packages:`), then the npm/yarn `workspaces` field of
 * the nearest package.json. Returns undefined when no workspace is declared —
 * the signal for {@link discoverManifests} to fall back to a brute-force glob.
 */
export function loadWorkspaceGlobs(cwd: string = process.cwd()): WorkspaceGlobs | undefined {
  const yamlPath = findWorkspaceYaml(cwd)
  if (yamlPath) return { root: dirname(yamlPath), patterns: readWorkspacePackages(yamlPath) }

  const pkgPath = findPackageJson(cwd)
  if (pkgPath) {
    const patterns = readWorkspacesField(pkgPath)
    if (patterns) return { root: dirname(pkgPath), patterns }
  }
  return undefined
}

/** Turn a workspace member glob (a directory pattern) into a package.json glob, preserving negation. */
function toManifestGlob(pattern: string): string {
  const negated = pattern.startsWith('!')
  const body = (negated ? pattern.slice(1) : pattern).replace(/\/+$/, '')
  const manifestGlob = body.endsWith('/package.json') ? body : `${body}/package.json`
  return negated ? `!${manifestGlob}` : manifestGlob
}

/**
 * Normalize tinyglobby's POSIX-style output to native separators (so paths match
 * findPackageJson()/loadProjectManifest()), dedupe, sort, and load each.
 */
function finalizeManifests(matches: string[]): ProjectManifest[] {
  const paths = [...new Set(matches.map((p) => normalize(p)))].toSorted((a, b) =>
    a.localeCompare(b),
  )
  return paths.map(loadManifestAt)
}

/**
 * Discover project manifests to upgrade.
 *
 * Non-recursive (default): the single nearest package.json walking up from
 * `cwd` — identical to {@link loadProjectManifest}.
 *
 * Recursive: workspace-aware. When `cwd` is inside a declared workspace
 * (pnpm `packages:` or an npm/yarn `workspaces` field), only that workspace's
 * declared members (plus the root manifest) are returned — so stray
 * `package.json` files in `examples/`, `fixtures/`, etc. are not treated as
 * members. With no workspace definition, falls back to a Taze-style brute-force
 * glob of every `package.json` under `cwd`. Both honor the default ignores
 * (node_modules, dist, .git) plus any extra `ignore` globs, sorted by path.
 */
export async function discoverManifests(
  cwd: string = process.cwd(),
  opts: DiscoverOptions = {},
): Promise<ProjectManifest[]> {
  if (!opts.recursive) {
    const manifest = loadProjectManifest(cwd)
    return manifest ? [manifest] : []
  }
  const ignore = [...DEFAULT_IGNORE, ...(opts.ignore ?? [])]

  const ws = loadWorkspaceGlobs(cwd)
  if (ws) {
    // The root manifest is always a member; member globs are matched from the root.
    const patterns = ['package.json', ...ws.patterns.map(toManifestGlob)]
    const matches = await glob(patterns, {
      cwd: ws.root,
      absolute: true,
      onlyFiles: true,
      dot: false,
      ignore,
    })
    return finalizeManifests(matches)
  }

  const matches = await glob('**/package.json', {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: false,
    ignore,
  })
  return finalizeManifests(matches)
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
