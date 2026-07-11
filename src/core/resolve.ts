import process from 'node:process'

import type { CatalogManifest } from './catalog.ts'
import type { ProjectManifest } from './project.ts'

import { discoverCatalog } from './catalog.ts'
import { discoverManifests } from './project.ts'
import { collectCatalogNames, collectQueryNames } from './upgrade.ts'

/**
 * A dependency scan: a project's manifests + nearest pnpm catalog, and the
 * deduped set of upgradable names to query the registry for.
 */
export interface DependencyScan {
  manifests: ProjectManifest[]
  catalog?: CatalogManifest
  /** Deduped upgradable dependency names across the manifests + the catalog. */
  queryNames: string[]
}

/**
 * Discover a project's manifests (the nearest package.json, or the workspace
 * members when recursive) and its nearest pnpm catalog, then collect the deduped
 * set of upgradable names. The shared discovery front-half of `siz upgrade`, the
 * outdated report, and the planned `siz check` audit — discovery only, it fetches
 * nothing itself (the single batched registry request happens after).
 */
export async function discoverProjectDeps(
  cwd: string = process.cwd(),
  opts: { recursive?: boolean } = {},
): Promise<DependencyScan> {
  const manifests = await discoverManifests(cwd, { recursive: opts.recursive })
  // pnpm catalogs live in the nearest pnpm-workspace.yaml (workspace-global), so
  // discover them by walking up regardless of recursive mode.
  const catalog = discoverCatalog(cwd)
  const queryNames = [
    ...new Set([...collectQueryNames(manifests), ...(catalog ? collectCatalogNames(catalog) : [])]),
  ]
  return { manifests, catalog, queryNames }
}
