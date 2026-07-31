import ansis from 'ansis'

import { buildRemoveCommand, detectPM, formatCommand, parseSpec, runInstall } from '../core/pm.ts'
import { discoverManifests, relativeScope } from '../core/project.ts'
import { clack, pickInstallTarget } from '../ui/prompts.ts'

/**
 * Remove one or more packages: **uninstall** them from the current project (via
 * the package manager, which rewrites package.json). There is no mode flag —
 * curating saved packages is `siz bundle rm`, and the two never touch.
 */
export async function runRemove(names: string[]): Promise<void> {
  if (names.length === 0) {
    console.log(ansis.yellow('Usage: siz rm <package> [...packages]'))
    return
  }

  // Accept `pkg@version` for safety (users may paste a spec); key on bare name.
  const bare = names.map((n) => parseSpec(n).name)

  // Uninstall from the project. No dependency-rules guardrail — removing
  // a package never adds one — and no confirm (symmetric with `siz add`).
  const cwd = process.cwd()
  clack.intro(ansis.bold.cyan('siz rm'))

  const manifests = await discoverManifests(cwd, { recursive: true })
  const targetDir = manifests.length > 1 ? await pickInstallTarget(manifests, cwd) : cwd

  const agent = await detectPM(targetDir)
  const cmd = buildRemoveCommand(agent, bare)
  const scope = relativeScope(cwd, targetDir)
  const where = scope ? ` in ${ansis.bold(scope)}` : ''
  clack.log.step(`Removing with ${ansis.bold(agent)}${where}: ${ansis.cyan(formatCommand(cmd))}`)

  const code = await runInstall(cmd, targetDir)
  if (code !== 0) {
    clack.log.error(`Uninstall exited with code ${code}`)
    return
  }
  clack.outro('Done.')
}
