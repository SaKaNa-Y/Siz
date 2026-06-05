import { readFileSync } from 'node:fs'
import process from 'node:process'
import { parse as parseYaml } from 'yaml'

import { findUp } from './paths.ts'
import { escapeRegExp } from './text.ts'

/** The name Siz uses for pnpm's top-level (default) `catalog:` block. */
export const DEFAULT_CATALOG = 'default'

/** A single version entry declared in a pnpm catalog. */
export interface CatalogEntry {
  /** `'default'` for the top-level `catalog:` block, otherwise the named catalog. */
  catalog: string
  name: string
  /** The raw version specifier as written, e.g. `^1.2.3`. */
  range: string
}

/** A loaded `pnpm-workspace.yaml` plus the catalog entries extracted from it. */
export interface CatalogManifest {
  /** Absolute path to the pnpm-workspace.yaml. */
  path: string
  /** The original file text — the source of truth for format-preserving writes. */
  raw: string
  entries: CatalogEntry[]
}

/** Walk up from `cwd` to the filesystem root, returning the nearest pnpm-workspace.yaml. */
export function findWorkspaceYaml(cwd: string = process.cwd()): string | undefined {
  return findUp('pnpm-workspace.yaml', cwd)
}

/** Pull string-valued entries out of one catalog object under `catalog` name. */
function collectCatalogBlock(catalog: string, block: unknown, into: CatalogEntry[]): void {
  if (!block || typeof block !== 'object') return
  for (const [name, range] of Object.entries(block as Record<string, unknown>)) {
    if (typeof range === 'string') into.push({ catalog, name, range })
  }
}

/** Read and parse a single pnpm-workspace.yaml at `path`. */
export function loadCatalogManifest(path: string): CatalogManifest {
  const raw = readFileSync(path, 'utf8')
  let doc: unknown
  try {
    doc = parseYaml(raw)
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`, { cause: err })
  }
  const entries: CatalogEntry[] = []
  if (doc && typeof doc === 'object') {
    const root = doc as { catalog?: unknown; catalogs?: unknown }
    collectCatalogBlock(DEFAULT_CATALOG, root.catalog, entries)
    if (root.catalogs && typeof root.catalogs === 'object') {
      for (const [name, block] of Object.entries(root.catalogs as Record<string, unknown>)) {
        collectCatalogBlock(name, block, entries)
      }
    }
  }
  return { path, raw, entries }
}

/**
 * Discover the pnpm catalog for `cwd`: the nearest `pnpm-workspace.yaml` walking
 * up. Returns undefined when none exists (not a pnpm workspace). A workspace file
 * with no catalog blocks yields a manifest with an empty `entries` list.
 */
export function discoverCatalog(cwd: string = process.cwd()): CatalogManifest | undefined {
  const path = findWorkspaceYaml(cwd)
  if (!path) return undefined
  return loadCatalogManifest(path)
}

/**
 * Read the declared workspace member globs from a `pnpm-workspace.yaml` — its
 * top-level `packages` array (e.g. `['packages/*']`). Returns `[]` when the key
 * is absent or malformed. Used by manifest discovery, not catalog upgrades.
 */
export function readWorkspacePackages(path: string): string[] {
  let doc: unknown
  try {
    doc = parseYaml(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
  if (!doc || typeof doc !== 'object') return []
  const packages = (doc as { packages?: unknown }).packages
  if (!Array.isArray(packages)) return []
  return packages.filter((p): p is string => typeof p === 'string')
}

/**
 * Find the `[start, end)` char span of a block's *body* in `raw` — the lines
 * below a header line, up to (but not including) the next non-blank line indented
 * no more than the header. `headerRe` must capture the header's leading
 * whitespace in group 1 and be anchored with the `m` flag.
 */
function findBlockBody(raw: string, headerRe: RegExp): { start: number; end: number } | null {
  const m = headerRe.exec(raw)
  if (!m) return null
  const headerIndent = (m[1] ?? '').length
  const headerNl = raw.indexOf('\n', m.index)
  const start = headerNl === -1 ? raw.length : headerNl + 1

  let i = start
  while (i < raw.length) {
    const nl = raw.indexOf('\n', i)
    const stop = nl === -1 ? raw.length : nl
    const line = raw.slice(i, stop)
    const trimmed = line.trimStart()
    if (trimmed !== '' && !trimmed.startsWith('#')) {
      const indent = line.length - trimmed.length
      if (indent <= headerIndent) return { start, end: i }
    }
    if (nl === -1) break
    i = nl + 1
  }
  return { start, end: raw.length }
}

/** Replace only the version value of `name` within a catalog block's body text. */
function replaceEntryValue(body: string, name: string, range: string): string {
  // Anchored on the (optionally quoted) key; preserves quoting style and any
  // trailing comment. The value char class excludes quotes/space/# so we never
  // swallow a `# note`. Complex ranges (with spaces) are filtered out upstream.
  const re = new RegExp(
    `^([ \\t]*)(['"]?)${escapeRegExp(name)}\\2([ \\t]*:[ \\t]*)(['"]?)[^'"\\s#]+\\4`,
    'm',
  )
  return body.replace(
    re,
    (_match, indent: string, kq: string, sep: string, vq: string) =>
      `${indent}${kq}${name}${kq}${sep}${vq}${range}${vq}`,
  )
}

function editDefaultCatalog(raw: string, name: string, range: string): string {
  const body = findBlockBody(raw, /^([ \t]*)catalog:[ \t]*$/m)
  if (!body) return raw
  const replaced = replaceEntryValue(raw.slice(body.start, body.end), name, range)
  return raw.slice(0, body.start) + replaced + raw.slice(body.end)
}

function editNamedCatalog(raw: string, catalog: string, name: string, range: string): string {
  const cats = findBlockBody(raw, /^([ \t]*)catalogs:[ \t]*$/m)
  if (!cats) return raw
  const catsBody = raw.slice(cats.start, cats.end)
  const namedRe = new RegExp(`^([ \\t]*)(['"]?)${escapeRegExp(catalog)}\\2:[ \\t]*$`, 'm')
  const named = findBlockBody(catsBody, namedRe)
  if (!named) return raw
  const replaced = replaceEntryValue(catsBody.slice(named.start, named.end), name, range)
  const newCats = catsBody.slice(0, named.start) + replaced + catsBody.slice(named.end)
  return raw.slice(0, cats.start) + newCats + raw.slice(cats.end)
}

/**
 * Apply version edits to the raw pnpm-workspace.yaml text without reformatting.
 * Each edit is keyed `${catalog}:${name}` (catalog `'default'` for the top-level
 * block). Edits are scoped to their catalog block by indentation, so the same
 * package under two catalogs — or a `packages:` entry — is never confused. Pure.
 */
export function applyCatalogEdits(raw: string, edits: Map<string, string>): string {
  let result = raw
  for (const [key, range] of edits) {
    const sep = key.indexOf(':')
    const catalog = key.slice(0, sep)
    const name = key.slice(sep + 1)
    result =
      catalog === DEFAULT_CATALOG
        ? editDefaultCatalog(result, name, range)
        : editNamedCatalog(result, catalog, name, range)
  }
  return result
}
