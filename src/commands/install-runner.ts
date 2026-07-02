import ansis from 'ansis'

import { buildInstallCommands, detectPM, formatCommand, parseSpec, runInstall } from '../core/pm.ts'
import { discoverManifests, relativeScope } from '../core/project.ts'
import { clack, ensure, pickInstallTarget, pickPackageManager } from '../ui/prompts.ts'
import { applyInstallRules } from './install-rules.ts'

/** A package to install (`name` is the PM token, so it may carry a version). */
export interface InstallSelection {
  name: string
  dev: boolean
}

export interface InstallRunOptions {
  cwd?: string
  /** Bypass the dependency-rules guardrail. */
  noRules?: boolean
  /** Prompt for the package manager instead of silently using the detected one. */
  pickPM?: boolean
  /** Ask a yes/no confirm before running the command(s). */
  confirm?: boolean
}

/**
 * Shared install path for the interactive Install action and the direct
 * `siz add` command. Discovers the target manifest (prompting in a monorepo),
 * applies the dependency-rules guardrail, then builds and runs the install
 * command(s). Assumes the caller has already opened a clack session (intro);
 * this function emits the closing outro.
 */
export async function runInstallSelections(
  selections: InstallSelection[],
  opts: InstallRunOptions = {},
): Promise<void> {
  const cwd = opts.cwd ?? process.cwd()

  // In a monorepo, let the user pick which package to install into; otherwise
  // (single or no package.json) install in the current directory.
  const manifests = await discoverManifests(cwd, { recursive: true })
  const targetDir = manifests.length > 1 ? await pickInstallTarget(manifests, cwd) : cwd

  // Dependency-rules guardrail: drop denied packages before building the install
  // command. Rules match on the bare name, so a versioned spec still resolves.
  const installable = applyInstallRules(selections, (s) => parseSpec(s.name).name, {
    cwd,
    noRules: opts.noRules,
    abortOutro: 'Aborted.',
  })
  if (!installable) return

  const detected = await detectPM(targetDir)
  const agent = opts.pickPM ? await pickPackageManager(detected) : detected
  const cmds = buildInstallCommands(agent, installable)
  const styled = cmds.map((c) => ansis.cyan(formatCommand(c)))
  const scope = relativeScope(cwd, targetDir)
  const where = scope ? ` in ${ansis.bold(scope)}` : ''

  if (opts.confirm) {
    const ok = ensure(
      await clack.confirm({ message: `Run ${styled.join(' && ')}${where}?`, initialValue: true }),
    )
    if (!ok) {
      clack.outro('Aborted.')
      return
    }
  }

  clack.log.step(`Installing with ${ansis.bold(agent)}${where}`)
  for (const cmd of cmds) {
    // Run installs sequentially and bail on the first failure (no parallelism).
    // eslint-disable-next-line no-await-in-loop
    const code = await runInstall(cmd, targetDir)
    if (code !== 0) {
      clack.log.error(`Install exited with code ${code}`)
      return
    }
  }
  clack.outro('Done.')
}
