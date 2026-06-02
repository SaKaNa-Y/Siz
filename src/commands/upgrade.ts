import ansis from 'ansis'
import process from 'node:process'

import type { UpgradeMode, UpgradePlan } from '../core/upgrade.ts'

import { buildSyncCommand, detectPM, formatCommand, runInstall } from '../core/pm.ts'
import {
  applyRangeEdits,
  isUpgradableSpecifier,
  loadProjectManifest,
  writeManifest,
} from '../core/project.ts'
import { buildUpgradePlan, fetchVersionInfo } from '../core/upgrade.ts'
import { clack, ensure, pickPackageManager } from '../ui/prompts.ts'
import {
  renderUpgradeSummary,
  renderVersionDelta,
  upgradeOptionLabel,
} from '../ui/upgrade-render.ts'

export interface UpgradeOptions {
  /** Upgrade ceiling. Defaults to `latest` (no ceiling). */
  mode?: UpgradeMode
  /** Preview changes without writing package.json or installing. */
  dryRun?: boolean
  /** Project directory (defaults to cwd). */
  cwd?: string
}

/** Stable key matching a plan item to a multiselect value. */
function itemKey(item: { depType: string; name: string }): string {
  return `${item.depType}:${item.name}`
}

/**
 * `siz upgrade [level]` — inspect the local package.json, let the user pick
 * which dependencies to bump (under the chosen ceiling), rewrite the version
 * ranges in place, and run the package manager to apply them.
 */
export async function runUpgrade(opts: UpgradeOptions = {}): Promise<void> {
  const mode = opts.mode ?? 'latest'
  const cwd = opts.cwd ?? process.cwd()

  clack.intro(ansis.bold.cyan('siz upgrade'))

  const manifest = loadProjectManifest(cwd)
  if (!manifest) {
    clack.log.error('No package.json found in this directory.')
    clack.outro('Nothing to upgrade.')
    return
  }

  const queryNames = [
    ...new Set(manifest.deps.filter((d) => isUpgradableSpecifier(d.range)).map((d) => d.name)),
  ]
  if (queryNames.length === 0) {
    clack.log.info('No upgradable dependencies found.')
    clack.outro('Nothing to upgrade.')
    return
  }

  const spin = clack.spinner()
  spin.start('Checking for updates…')
  let plan: UpgradePlan
  try {
    const versions = await fetchVersionInfo(queryNames)
    plan = buildUpgradePlan(manifest.deps, versions, mode)
  } catch (err) {
    spin.stop('Failed to check for updates.')
    clack.log.error((err as Error).message)
    return
  }
  spin.stop(renderUpgradeSummary(plan))

  if (plan.upgradable.length === 0) {
    clack.log.success('All dependencies are up to date.')
    clack.outro('Done.')
    return
  }

  const options = plan.upgradable.map((item) => ({
    value: itemKey(item),
    label: upgradeOptionLabel(item),
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

  const chosen = plan.upgradable.filter((item) => selected.includes(itemKey(item)))

  if (opts.dryRun) {
    clack.note(
      chosen.map((item) => `${ansis.bold(item.name)}  ${renderVersionDelta(item)}`).join('\n'),
      'Dry run',
    )
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

  const edits = new Map(chosen.map((item) => [itemKey(item), item.proposed]))
  try {
    writeManifest(manifest.path, applyRangeEdits(manifest.raw, edits))
  } catch (err) {
    clack.log.error(`Failed to update package.json: ${(err as Error).message}`)
    return
  }
  clack.log.success(`Updated ${count} in package.json`)

  clack.log.step(`Installing with ${ansis.bold(agent)}`)
  const code = await runInstall(syncCmd, cwd)
  if (code !== 0) {
    clack.log.error(`Install exited with code ${code}`)
    return
  }
  clack.outro(ansis.green('Upgraded.'))
}
