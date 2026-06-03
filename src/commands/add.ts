import ansis from 'ansis'
import process from 'node:process'

import type { BundleDepType, VersionStrategy } from '../core/types.ts'

import { suggestCategory } from '../core/categories.ts'
import { resolveLatest } from '../core/meta.ts'
import { addToBundle, trackPackage } from '../core/store.ts'
import { pickOrCreateBundle } from '../ui/prompts.ts'

export interface AddOptions {
  /** Also record the packages into this bundle (created if missing). */
  bundle?: string
  /** Record bundle entries as devDependencies. */
  dev?: boolean
  /** Version strategy for bundle entries (defaults to caret). */
  strategy?: VersionStrategy
}

/**
 * Track one or more packages manually (e.g. things already installed).
 * Resolves the latest version and auto-suggests a category. Optionally records
 * the packages into a bundle (via `--bundle`, or an interactive prompt on a TTY).
 */
export async function runAdd(names: string[], opts: AddOptions = {}): Promise<void> {
  if (names.length === 0) {
    console.log(ansis.yellow('Usage: siz add <package> [...packages]'))
    return
  }

  // Resolve all versions concurrently; output stays in input order.
  const metas = await Promise.all(names.map((name) => resolveLatest(name)))
  for (const meta of metas) {
    const { name } = meta
    if (!meta.exists) {
      console.log(ansis.yellow(`! ${name} not found on npm — tracking anyway.`))
    }
    const category = suggestCategory({ name })
    const pkg = trackPackage({ name, version: meta.version, category })
    const v = pkg.version ? ansis.dim(` v${pkg.version}`) : ''
    const cat = pkg.category ? ` ${ansis.magenta(`[${pkg.category}]`)}` : ''
    console.log(`${ansis.green('+')} ${ansis.bold(name)}${v}${cat}`)
  }

  await recordIntoBundle(names, opts)
}

/** Resolve the target bundle (flag or interactive prompt) and record the packages. */
async function recordIntoBundle(names: string[], opts: AddOptions): Promise<void> {
  let target = opts.bundle
  // Without an explicit flag, offer an interactive picker only on a TTY so
  // scripted use (`siz add x`) stays non-interactive.
  if (!target && process.stdout.isTTY) {
    target = await pickOrCreateBundle()
  }
  if (!target) return

  const depType: BundleDepType = opts.dev ? 'devDependencies' : 'dependencies'
  const strategy: VersionStrategy = opts.strategy ?? 'caret'
  addToBundle(
    target,
    names.map((name) => ({ name, strategy, depType })),
  )
  console.log(
    `${ansis.green('+')} added ${names.length} package${names.length === 1 ? '' : 's'} to bundle ${ansis.bold(target)}`,
  )
}
