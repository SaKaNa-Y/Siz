import ansis from 'ansis'

import type { BundleDepType, VersionStrategy } from '../core/types.ts'

import { suggestCategory } from '../core/categories.ts'
import { resolveLatest } from '../core/meta.ts'
import { addFavorite, addToBundle } from '../core/store.ts'

export interface AddOptions {
  /** Record the packages into this bundle (created if missing) instead of favoriting. */
  bundle?: string
  /** Record bundle entries as devDependencies. */
  dev?: boolean
  /** Version strategy for bundle entries (defaults to caret). */
  strategy?: VersionStrategy
}

/**
 * Add one or more packages. Without `--bundle`, this favorites them (resolving
 * the latest version and auto-suggesting a category). With `--bundle <name>`,
 * the packages are recorded into that bundle instead and are *not* favorited.
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

  // Resolve all versions concurrently; output stays in input order.
  const metas = await Promise.all(names.map((name) => resolveLatest(name)))
  for (const meta of metas) {
    const { name } = meta
    if (!meta.exists) {
      console.log(ansis.yellow(`! ${name} not found on npm — favoriting anyway.`))
    }
    const category = suggestCategory({ name })
    const pkg = addFavorite({ name, version: meta.version, category })
    const v = pkg.version ? ansis.dim(` v${pkg.version}`) : ''
    const cat = pkg.category ? ` ${ansis.magenta(`[${pkg.category}]`)}` : ''
    console.log(`${ansis.green('+')} ${ansis.bold(name)}${v}${cat}`)
  }
}

/** Record the packages into the named bundle (created if missing). */
function recordIntoBundle(names: string[], target: string, opts: AddOptions): void {
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
