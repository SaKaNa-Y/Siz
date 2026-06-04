import ansis from 'ansis'
import { dirname, relative } from 'node:path'
import process from 'node:process'

import type { ProjectManifest } from '../core/project.ts'
import type { UpgradeMode, UpgradePlan, UpgradePlanItem } from '../core/upgrade.ts'

import { buildSyncCommand, detectPM, formatCommand, runInstall } from '../core/pm.ts'
import { applyRangeEdits, discoverManifests, writeManifest } from '../core/project.ts'
import { collectQueryNames, fetchVersionInfo, planManifests } from '../core/upgrade.ts'
import { clack, ensure, pickPackageManager } from '../ui/prompts.ts'
import {
  renderUpgradeSummary,
  renderVersionDelta,
  upgradeOptionLabel,
} from '../ui/upgrade-render.ts'

export interface UpgradeOptions {
  /** Upgrade ceiling. Defaults to `latest` (no ceiling). */
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

/** One upgradable dep tagged with the manifest it belongs to. */
interface FlatItem {
  item: UpgradePlanItem
  manifest: ProjectManifest
  /** Package dir relative to cwd (e.g. `packages/ui`), or undefined for the root. */
  scope?: string
  /** Globally-unique multiselect value across all manifests. */
  key: string
}

/**
 * `siz upgrade [level]` — inspect the local package.json (or every package.json
 * under cwd with `-r`), let the user pick which dependencies to bump (under the
 * chosen ceiling), rewrite the version ranges in place, and run the package
 * manager once to apply them.
 */
export async function runUpgrade(opts: UpgradeOptions = {}): Promise<void> {
  const mode = opts.mode ?? 'latest'
  const cwd = opts.cwd ?? process.cwd()

  clack.intro(ansis.bold.cyan('siz upgrade'))

  const manifests = await discoverManifests(cwd, { recursive: opts.recursive })
  if (manifests.length === 0) {
    clack.log.error('No package.json found in this directory.')
    clack.outro('Nothing to upgrade.')
    return
  }

  const queryNames = collectQueryNames(manifests)
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
    aggregate = {
      upgradable: planned.flatMap((p) => p.plan.upgradable),
      upToDate: planned.flatMap((p) => p.plan.upToDate),
      skipped: planned.flatMap((p) => p.plan.skipped),
    }
    flat = planned.flatMap(({ manifest, plan }) => {
      const dir = dirname(relative(cwd, manifest.path))
      const scope = dir === '.' || dir === '' ? undefined : dir
      return plan.upgradable.map((item) => ({
        item,
        manifest,
        scope,
        key: `${relative(cwd, manifest.path)} ${itemKey(item)}`,
      }))
    })
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
    hint: f.item.depType === 'devDependencies' ? 'dev' : undefined,
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
  const ok = ensure(
    await clack.confirm({
      message: `Update ${count} in package.json and run ${styled}?`,
      initialValue: true,
    }),
  )
  if (!ok) {
    clack.outro('Aborted.')
    return
  }

  // Group selections back by their manifest, then rewrite each file once.
  const byManifest = new Map<string, FlatItem[]>()
  for (const f of chosen) {
    const group = byManifest.get(f.manifest.path)
    if (group) group.push(f)
    else byManifest.set(f.manifest.path, [f])
  }

  try {
    for (const group of byManifest.values()) {
      const { manifest } = group[0]
      const edits = new Map(group.map((f) => [itemKey(f.item), f.item.proposed]))
      writeManifest(manifest.path, applyRangeEdits(manifest.raw, edits))
    }
  } catch (err) {
    clack.log.error(`Failed to update package.json: ${(err as Error).message}`)
    return
  }
  const fileCount = byManifest.size
  const where = fileCount === 1 ? 'package.json' : `${fileCount} package.json files`
  clack.log.success(`Updated ${count} in ${where}`)

  clack.log.step(`Installing with ${ansis.bold(agent)}`)
  const code = await runInstall(syncCmd, cwd)
  if (code !== 0) {
    clack.log.error(`Install exited with code ${code}`)
    return
  }
  clack.outro(ansis.green('Upgraded.'))
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
