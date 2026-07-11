import { dirname, relative } from 'node:path'
import process from 'node:process'

import type { DiffLevel } from '../core/upgrade.ts'
import type { OutdatedRow } from '../ui/outdated-render.ts'

import { planCatalogOutdated, planManifestsOutdated } from '../core/outdated.ts'
import { relativeScope } from '../core/project.ts'
import { discoverProjectDeps } from '../core/resolve.ts'
import { fetchVersionInfo } from '../core/upgrade.ts'
import { renderOutdatedSummary, renderOutdatedTable } from '../ui/outdated-render.ts'

export interface OutdatedOptions {
  /** Scan every package.json under cwd, not just the nearest one. */
  recursive?: boolean
  /** Emit the report as JSON (stdout only) for CI. */
  json?: boolean
  /** Exit 1 when any dependency is outdated. */
  exitCode?: boolean
  /** Project directory (defaults to cwd). */
  cwd?: string
}

/** A flattened outdated row tagged with where it came from, for JSON + table output. */
interface ReportRow {
  name: string
  source: string
  scope?: string
  catalog?: string
  depType?: string
  range: string
  current: string
  wanted: string
  latest: string
  wantedDiff: DiffLevel
  latestDiff: DiffLevel
  group?: string
}

/**
 * `siz outdated` — a read-only, non-interactive report of dependencies whose
 * registry `latest` is ahead of their declared range. Reuses the upgrade
 * version-fetch core; never writes or installs. Returns the process exit code.
 */
export async function runOutdated(opts: OutdatedOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd()

  const { manifests, catalog, queryNames } = await discoverProjectDeps(cwd, {
    recursive: opts.recursive,
  })
  if (manifests.length === 0 && !catalog) {
    if (opts.json) {
      console.log(
        JSON.stringify(
          { outdated: [], skipped: [], summary: { total: 0, upToDate: 0, skipped: 0 } },
          null,
          2,
        ),
      )
    } else {
      console.error('No package.json found in this directory.')
    }
    return 0
  }

  const versions = await fetchVersionInfo(queryNames)

  const planned = planManifestsOutdated(manifests, versions)
  const catalogItems = catalog ? planCatalogOutdated(catalog, versions) : []

  const rows: ReportRow[] = []
  const skipped: { name: string; source: string; reason: string }[] = []
  let upToDate = 0

  for (const { manifest, report } of planned) {
    const source = relative(cwd, manifest.path) || 'package.json'
    const scope = relativeScope(cwd, dirname(manifest.path))
    for (const item of report.outdated) {
      rows.push({
        name: item.name,
        source,
        scope,
        depType: item.depType,
        range: item.range,
        current: item.current,
        wanted: item.wanted,
        latest: item.latest,
        wantedDiff: item.wantedDiff,
        latestDiff: item.latestDiff,
        group: scope,
      })
    }
    for (const s of report.skipped) skipped.push({ name: s.name, source, reason: s.reason })
    upToDate += report.upToDate
  }

  if (catalog) {
    const source = relative(cwd, catalog.path) || 'pnpm-workspace.yaml'
    for (const item of catalogItems) {
      const tag = item.catalog === 'default' ? 'catalog' : `catalog:${item.catalog}`
      rows.push({
        name: item.name,
        source,
        catalog: item.catalog,
        range: item.range,
        current: item.current,
        wanted: item.wanted,
        latest: item.latest,
        wantedDiff: item.wantedDiff,
        latestDiff: item.latestDiff,
        group: tag,
      })
    }
  }

  const summary = { total: rows.length, upToDate, skipped: skipped.length }

  if (opts.json) {
    const outdated = rows.map(({ group: _g, ...rest }) => rest)
    console.log(JSON.stringify({ outdated, skipped, summary }, null, 2))
    return opts.exitCode && summary.total > 0 ? 1 : 0
  }

  if (rows.length === 0) {
    console.log('All dependencies up to date.')
    return 0
  }

  const grouped = Boolean(opts.recursive) || catalogItems.length > 0
  const tableRows: OutdatedRow[] = rows.map((r) => ({
    name: r.name,
    current: r.current,
    wanted: r.wanted,
    latest: r.latest,
    latestDiff: r.latestDiff,
    group: r.group,
  }))
  console.log(renderOutdatedTable(tableRows, { grouped }))
  console.log('')
  console.log(renderOutdatedSummary(summary))

  return opts.exitCode && summary.total > 0 ? 1 : 0
}
