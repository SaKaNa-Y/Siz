import ansis from 'ansis'
import { dirname, relative } from 'node:path'
import process from 'node:process'

import type { CatalogManifest } from '../core/catalog.ts'
import type { ProjectManifest } from '../core/project.ts'
import type { CatalogPlanItem, UpgradeMode, UpgradePlan, UpgradePlanItem } from '../core/upgrade.ts'

import { applyCatalogEdits } from '../core/catalog.ts'
import { fetchVersionInfo } from '../core/compare.ts'
import { buildSyncCommand, detectPM, formatCommand, runInstall } from '../core/pm.ts'
import { applyRangeEdits, relativeScope, writeManifest } from '../core/project.ts'
import { discoverProjectDeps } from '../core/resolve.ts'
import { DEFAULT_UPGRADE_MODE, planCatalog, planManifests } from '../core/upgrade.ts'
import { clack, ensure, pickPackageManager } from '../ui/prompts.ts'
import {
  renderUpgradeSummary,
  renderVersionDelta,
  upgradeOptionLabel,
} from '../ui/upgrade-render.ts'

export interface UpgradeOptions {
  /** Upgrade ceiling. Defaults to `major` (newest overall, no ceiling). */
  mode?: UpgradeMode
  /** Discover every package.json under cwd, not just the nearest one. */
  recursive?: boolean
  /** Preview changes without writing package.json or installing. */
  dryRun?: boolean
  /** Project directory (defaults to cwd). */
  cwd?: string
}

/** Stable key matching a dep to a multiselect value within one manifest. */
function itemKey(item: { depType: string; name: string }): string {
  return `${item.depType}:${item.name}`
}

/** One upgradable package.json dep tagged with the manifest it belongs to. */
interface ManifestRow {
  kind: 'manifest'
  item: UpgradePlanItem
  manifest: ProjectManifest
  /** Package dir relative to cwd (e.g. `packages/ui`), or undefined for the root. */
  scope?: string
  /** Globally-unique multiselect value across all rows. */
  key: string
}

/** One upgradable pnpm catalog entry tagged with its workspace file. */
interface CatalogRow {
  kind: 'catalog'
  item: CatalogPlanItem
  catalog: CatalogManifest
  /** Display tag: `catalog` for the default block, else `catalog:<name>`. */
  scope: string
  /** Globally-unique multiselect value across all rows. */
  key: string
}

/** A single selectable upgrade row — either a manifest dep or a catalog entry. */
type FlatItem = ManifestRow | CatalogRow

/** Catalog edit key within one pnpm-workspace.yaml: `${catalog}:${name}`. */
function catalogKey(item: CatalogPlanItem): string {
  return `${item.catalog}:${item.name}`
}

/**
 * `siz upgrade [level]` — inspect the local package.json (or every package.json
 * under cwd with `-r`), let the user pick which dependencies to bump (under the
 * chosen ceiling), rewrite the version ranges in place, and run the package
 * manager once to apply them.
 */
export async function runUpgrade(opts: UpgradeOptions = {}): Promise<void> {
  const mode = opts.mode ?? DEFAULT_UPGRADE_MODE
  const cwd = opts.cwd ?? process.cwd()

  clack.intro(ansis.bold.cyan('siz upgrade'))

  const { manifests, catalog, queryNames } = await discoverProjectDeps(cwd, {
    recursive: opts.recursive,
  })
  if (manifests.length === 0 && !catalog) {
    clack.log.error('No package.json found in this directory.')
    clack.outro('Nothing to upgrade.')
    return
  }

  if (queryNames.length === 0) {
    clack.log.info('No upgradable dependencies found.')
    clack.outro('Nothing to upgrade.')
    return
  }

  const spin = clack.spinner()
  spin.start('Checking for updates…')
  let aggregate: UpgradePlan
  let flat: FlatItem[]
  try {
    const versions = await fetchVersionInfo(queryNames)
    const planned = planManifests(manifests, versions, mode)
    const catalogItems = catalog ? planCatalog(catalog, versions, mode) : []
    aggregate = {
      upgradable: [...planned.flatMap((p) => p.plan.upgradable), ...catalogItems],
      upToDate: planned.flatMap((p) => p.plan.upToDate),
      skipped: planned.flatMap((p) => p.plan.skipped),
    }
    const manifestRows: FlatItem[] = planned.flatMap(({ manifest, plan }) => {
      const scope = relativeScope(cwd, dirname(manifest.path))
      return plan.upgradable.map((item) => ({
        kind: 'manifest' as const,
        item,
        manifest,
        scope,
        key: `${relative(cwd, manifest.path)} ${itemKey(item)}`,
      }))
    })
    const catalogRows: FlatItem[] = catalog
      ? catalogItems.map((item) => ({
          kind: 'catalog' as const,
          item,
          catalog,
          scope: item.catalog === 'default' ? 'catalog' : `catalog:${item.catalog}`,
          key: `${relative(cwd, catalog.path)} ${catalogKey(item)}`,
        }))
      : []
    flat = [...manifestRows, ...catalogRows]
  } catch (err) {
    spin.stop('Failed to check for updates.')
    clack.log.error((err as Error).message)
    return
  }
  spin.stop(renderUpgradeSummary(aggregate))

  if (flat.length === 0) {
    clack.log.success('All dependencies are up to date.')
    clack.outro('Done.')
    return
  }

  const options = flat.map((f) => ({
    value: f.key,
    label: upgradeOptionLabel(f.item, f.scope),
    hint: f.kind === 'manifest' && f.item.depType === 'devDependencies' ? 'dev' : undefined,
  }))
  const selected = ensure(
    await clack.multiselect<string>({
      message: `Select packages to upgrade (${mode})`,
      required: false,
      initialValues: options.map((o) => o.value),
      options,
    }),
  )

  if (selected.length === 0) {
    clack.outro('Nothing selected.')
    return
  }

  const chosen = flat.filter((f) => selected.includes(f.key))

  if (opts.dryRun) {
    clack.note(renderDryRun(chosen), 'Dry run')
    clack.outro('Dry run — no changes written.')
    return
  }

  const agent = await pickPackageManager(await detectPM(cwd))
  const syncCmd = buildSyncCommand(agent)
  const styled = ansis.cyan(formatCommand(syncCmd))
  const count = `${chosen.length} package${chosen.length === 1 ? '' : 's'}`
  const where = describeFiles(
    new Set(chosen.filter((f) => f.kind === 'manifest').map((f) => f.manifest.path)).size,
    new Set(chosen.filter((f) => f.kind === 'catalog').map((f) => f.catalog.path)).size,
  )
  const ok = ensure(
    await clack.confirm({
      message: `Update ${count} in ${where} and run ${styled}?`,
      initialValue: true,
    }),
  )
  if (!ok) {
    clack.outro('Aborted.')
    return
  }

  // Group selections back by their file, then rewrite each once. package.json
  // deps rewrite via applyRangeEdits; catalog entries via applyCatalogEdits.
  const manifestGroups = new Map<string, { manifest: ProjectManifest; rows: ManifestRow[] }>()
  const catalogGroups = new Map<string, { catalog: CatalogManifest; rows: CatalogRow[] }>()
  for (const f of chosen) {
    if (f.kind === 'manifest') {
      const g = manifestGroups.get(f.manifest.path)
      if (g) g.rows.push(f)
      else manifestGroups.set(f.manifest.path, { manifest: f.manifest, rows: [f] })
    } else {
      const g = catalogGroups.get(f.catalog.path)
      if (g) g.rows.push(f)
      else catalogGroups.set(f.catalog.path, { catalog: f.catalog, rows: [f] })
    }
  }

  try {
    for (const { manifest, rows } of manifestGroups.values()) {
      const edits = new Map(rows.map((f) => [itemKey(f.item), f.item.proposed]))
      writeManifest(manifest.path, applyRangeEdits(manifest.raw, edits))
    }
    for (const { catalog: cat, rows } of catalogGroups.values()) {
      const edits = new Map(rows.map((f) => [catalogKey(f.item), f.item.proposed]))
      writeManifest(cat.path, applyCatalogEdits(cat.raw, edits))
    }
  } catch (err) {
    clack.log.error(`Failed to update files: ${(err as Error).message}`)
    return
  }
  clack.log.success(`Updated ${count} in ${where}`)

  clack.log.step(`Installing with ${ansis.bold(agent)}`)
  const code = await runInstall(syncCmd, cwd)
  if (code !== 0) {
    clack.log.error(`Install exited with code ${code}`)
    return
  }
  clack.outro(ansis.green('Upgraded.'))
}

/** Human-readable summary of which files were rewritten. */
function describeFiles(manifestCount: number, catalogCount: number): string {
  const parts: string[] = []
  if (manifestCount > 0) {
    parts.push(manifestCount === 1 ? 'package.json' : `${manifestCount} package.json files`)
  }
  if (catalogCount > 0) parts.push('pnpm-workspace.yaml')
  return parts.join(' and ')
}

/** Dry-run note body: changes grouped by package, with scope headers when recursive. */
function renderDryRun(chosen: FlatItem[]): string {
  const lines: string[] = []
  let lastScope: string | undefined
  for (const f of chosen) {
    if (f.scope !== lastScope) {
      if (f.scope) lines.push(ansis.dim(f.scope))
      lastScope = f.scope
    }
    lines.push(`${ansis.bold(f.item.name)}  ${renderVersionDelta(f.item)}`)
  }
  return lines.join('\n')
}
