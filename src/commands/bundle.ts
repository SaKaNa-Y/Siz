import ansis from 'ansis'
import process from 'node:process'

import type { BundleInstallPlan } from '../core/bundle.ts'

import { resolveBundleInstall } from '../core/bundle.ts'
import {
  buildBundleInstallCommands,
  detectPM,
  formatCommand,
  runInstall,
  type SpecSelection,
} from '../core/pm.ts'
import { getBundle, listBundles, removeBundle, renameBundle, touchBundle } from '../core/store.ts'
import {
  bundleInstallOptionLabel,
  renderBundleList,
  renderBundleShow,
} from '../ui/bundle-render.ts'
import { clack, ensure, pickPackageManager } from '../ui/prompts.ts'

/** Stable key matching an install item to a multiselect value. */
function itemKey(item: { depType: string; name: string }): string {
  return `${item.depType}:${item.name}`
}

/** `siz bundle list` — show saved bundles, most-recently-used first. */
export function runBundleList(): void {
  const bundles = listBundles()
  if (bundles.length === 0) {
    console.log(ansis.dim('No bundles yet. Create one with `siz add <pkg> --bundle <name>`.'))
    return
  }
  console.log(renderBundleList(bundles))
}

/** `siz bundle show <name>` — print one bundle's full contents. */
export function runBundleShow(name: string): void {
  const bundle = getBundle(name)
  if (!bundle) {
    console.error(ansis.red(`Bundle "${name}" not found.`))
    process.exitCode = 1
    return
  }
  console.log(renderBundleShow(bundle))
}

/** `siz bundle rm <name>` — delete a bundle after confirmation. */
export async function runBundleRemove(name: string): Promise<void> {
  const bundle = getBundle(name)
  if (!bundle) {
    console.error(ansis.red(`Bundle "${name}" not found.`))
    process.exitCode = 1
    return
  }
  clack.intro(ansis.bold.cyan('siz bundle rm'))
  const ok = ensure(
    await clack.confirm({ message: `Delete bundle "${name}"?`, initialValue: false }),
  )
  if (!ok) {
    clack.outro('Aborted.')
    return
  }
  removeBundle(name)
  clack.outro(ansis.green(`Deleted "${name}".`))
}

/** `siz bundle rename <old> <new>` — rename a bundle. */
export function runBundleRename(oldName: string, newName: string): void {
  const result = renameBundle(oldName, newName)
  switch (result) {
    case 'missing':
      console.error(ansis.red(`Bundle "${oldName}" not found.`))
      process.exitCode = 1
      return
    case 'exists':
      console.error(ansis.red(`A bundle named "${newName}" already exists.`))
      process.exitCode = 1
      return
    default:
      console.log(`${ansis.green('✓')} Renamed ${ansis.bold(oldName)} → ${ansis.bold(newName)}`)
  }
}

export interface BundleInstallOptions {
  cwd?: string
}

/**
 * `siz bundle install <name>` — resolve fresh versions for a bundle's packages,
 * let the user pick which to install, and run the package manager.
 */
export async function runBundleInstall(
  name: string,
  opts: BundleInstallOptions = {},
): Promise<void> {
  const cwd = opts.cwd ?? process.cwd()

  clack.intro(ansis.bold.cyan('siz bundle install'))

  const bundle = getBundle(name)
  if (!bundle) {
    clack.log.error(`Bundle "${name}" not found.`)
    clack.outro('Nothing to install.')
    process.exitCode = 1
    return
  }
  if (Object.keys(bundle.packages).length === 0) {
    clack.log.info('This bundle has no packages.')
    clack.outro('Nothing to install.')
    return
  }

  const spin = clack.spinner()
  spin.start('Resolving versions…')
  let plan: BundleInstallPlan
  try {
    plan = await resolveBundleInstall(bundle)
  } catch (err) {
    spin.stop('Failed to resolve versions.')
    clack.log.error((err as Error).message)
    return
  }
  spin.stop(`Resolved ${plan.items.length} package${plan.items.length === 1 ? '' : 's'}`)

  if (plan.missing.length) {
    clack.log.warn(`Not on npm (installing as-is): ${plan.missing.join(', ')}`)
  }

  const options = plan.items.map((item) => ({
    value: itemKey(item),
    label: bundleInstallOptionLabel(item),
  }))
  const selected = ensure(
    await clack.multiselect<string>({
      message: 'Select packages to install',
      required: false,
      initialValues: options.map((o) => o.value),
      options,
    }),
  )
  if (selected.length === 0) {
    clack.outro('Nothing selected.')
    return
  }

  const chosen = plan.items.filter((item) => selected.includes(itemKey(item)))
  const hasPeerOrOptional = chosen.some(
    (i) => i.depType === 'peerDependencies' || i.depType === 'optionalDependencies',
  )

  const agent = await pickPackageManager(bundle.packageManager ?? (await detectPM(cwd)))
  const selections: SpecSelection[] = chosen.map((i) => ({ spec: i.spec, depType: i.depType }))
  const cmds = buildBundleInstallCommands(agent, selections)

  const note = [
    cmds.map((c) => ansis.cyan(formatCommand(c))).join('\n'),
    hasPeerOrOptional ? ansis.dim('peer/optional deps install as regular dependencies') : '',
  ]
    .filter(Boolean)
    .join('\n')
  clack.note(note, `Install ${chosen.length} into ${cwd}`)

  const ok = ensure(
    await clack.confirm({ message: `Run with ${ansis.bold(agent)}?`, initialValue: true }),
  )
  if (!ok) {
    clack.outro('Aborted.')
    return
  }

  for (const cmd of cmds) {
    const code = await runInstall(cmd, cwd)
    if (code !== 0) {
      clack.log.error(`Install exited with code ${code}`)
      return
    }
  }
  touchBundle(name)
  clack.outro(ansis.green('Installed.'))
}
