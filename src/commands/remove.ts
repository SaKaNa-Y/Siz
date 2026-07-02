import ansis from 'ansis'

import { buildRemoveCommand, detectPM, formatCommand, parseSpec, runInstall } from '../core/pm.ts'
import { discoverManifests, relativeScope } from '../core/project.ts'
import { removeFavorite } from '../core/store.ts'
import { clack, pickInstallTarget } from '../ui/prompts.ts'

export interface RemoveOptions {
  /** Remove the packages from favorites instead of uninstalling them. */
  fav?: boolean
}

/**
 * Remove one or more packages. By default this **uninstalls** them from the
 * current project (via the package manager, which rewrites package.json). With
 * `--fav`, it removes them from the favorites store instead — the two are
 * orthogonal, so uninstalling never touches favorites and vice versa.
 */
export async function runRemove(names: string[], opts: RemoveOptions = {}): Promise<void> {
  if (names.length === 0) {
    console.log(ansis.yellow('Usage: siz rm <package> [...packages]'))
    return
  }

  // Accept `pkg@version` for safety (users may paste a spec); key on bare name.
  const bare = names.map((n) => parseSpec(n).name)

  if (opts.fav) {
    for (const name of bare) {
      const removed = removeFavorite(name)
      if (removed) console.log(`${ansis.red('-')} Removed favorite ${ansis.bold(name)}`)
      else console.log(ansis.yellow(`${name} is not a favorite.`))
    }
    return
  }

  // Default: uninstall from the project. No dependency-rules guardrail — removing
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
