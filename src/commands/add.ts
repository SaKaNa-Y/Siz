import ansis from 'ansis'

import type { BundleDepType, BundlePackage, VersionStrategy } from '../core/types.ts'

import { parseSpec } from '../core/pm.ts'
import { addToBundle } from '../core/store.ts'
import { clack } from '../ui/prompts.ts'
import { runInstallSelections } from './install-runner.ts'

export interface AddOptions {
  /** Record the packages into this bundle (created if missing) instead of installing. */
  bundle?: string
  /** Install / record as devDependencies. */
  dev?: boolean
  /** Version strategy for bundle entries (defaults to caret). */
  strategy?: VersionStrategy
  /** Bypass the dependency-rules guardrail (install mode only). */
  noRules?: boolean
}

/**
 * Add one or more packages. Two mutually exclusive modes:
 * - default: **install** them into the current project (via the package manager),
 * - `--bundle <name>`: record them into that bundle (saved, not installed).
 * Package specs may carry a version (`react@18`, `@scope/pkg@1.2.3`) — it flows
 * through to the PM on install and pins the exact version for a bundle entry.
 */
export async function runAdd(names: string[], opts: AddOptions = {}): Promise<void> {
  if (names.length === 0) {
    console.log(ansis.yellow('Usage: siz add <package> [...packages]'))
    return
  }

  if (opts.bundle) {
    recordIntoBundle(names, opts.bundle, opts)
    return
  }

  // Default: install into the project (delegates to the package manager).
  clack.intro(ansis.bold.cyan('siz add'))
  await runInstallSelections(
    names.map((name) => ({ name, dev: !!opts.dev })),
    { noRules: opts.noRules },
  )
}

/** Record the packages into the named bundle (created if missing). */
function recordIntoBundle(names: string[], target: string, opts: AddOptions): void {
  const depType: BundleDepType = opts.dev ? 'devDependencies' : 'dependencies'
  const fallback: VersionStrategy = opts.strategy ?? 'caret'
  const pinned: string[] = []
  const entries: BundlePackage[] = names.map((raw) => {
    const { name, version } = parseSpec(raw)
    // An explicit `@version` pins the entry exactly, overriding --strategy.
    if (version) {
      pinned.push(name)
      return { name, strategy: 'exact', depType, version }
    }
    return { name, strategy: fallback, depType }
  })
  addToBundle(target, entries)
  // Say when the two inputs disagreed, so a pinned entry is never a surprise.
  if (pinned.length > 0 && opts.strategy && opts.strategy !== 'exact') {
    console.log(
      ansis.yellow(
        `! ${pinned.join(', ')} pinned exact — an explicit @version overrides --strategy ${opts.strategy}`,
      ),
    )
  }
  console.log(
    `${ansis.green('+')} added ${names.length} package${names.length === 1 ? '' : 's'} to bundle ${ansis.bold(target)}`,
  )
}
