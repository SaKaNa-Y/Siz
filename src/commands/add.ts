import ansis from 'ansis'

import type { BundleDepType, BundlePackage, VersionStrategy } from '../core/types.ts'

import { suggestCategory } from '../core/categories.ts'
import { resolveLatest } from '../core/meta.ts'
import { parseSpec } from '../core/pm.ts'
import { addFavorite, addToBundle } from '../core/store.ts'
import { clack } from '../ui/prompts.ts'
import { runInstallSelections } from './install-runner.ts'

export interface AddOptions {
  /** Record the packages into this bundle (created if missing) instead of installing. */
  bundle?: string
  /** Favorite the packages instead of installing them. */
  fav?: boolean
  /** Install / record as devDependencies. */
  dev?: boolean
  /** Version strategy for bundle entries (defaults to caret). */
  strategy?: VersionStrategy
  /** Bypass the dependency-rules guardrail (install mode only). */
  noRules?: boolean
}

/**
 * Add one or more packages. Three mutually exclusive modes:
 * - default: **install** them into the current project (via the package manager),
 * - `--fav`: favorite them (resolving the latest version, suggesting a category),
 * - `--bundle <name>`: record them into that bundle (not installed, not favorited).
 * Package specs may carry a version (`react@18`, `@scope/pkg@1.2.3`) — it flows
 * through to the PM on install and pins the exact version for a bundle entry.
 */
export async function runAdd(names: string[], opts: AddOptions = {}): Promise<void> {
  if (names.length === 0) {
    console.log(ansis.yellow('Usage: siz add <package> [...packages]'))
    return
  }

  if (opts.fav && opts.bundle) {
    throw new Error('Use --fav or --bundle, not both.')
  }

  if (opts.bundle) {
    recordIntoBundle(names, opts.bundle, opts)
    return
  }

  if (opts.fav) {
    if (opts.dev) {
      console.log(ansis.yellow('! --dev has no effect with --fav (favorites have no dep type).'))
    }
    await favorite(names)
    return
  }

  // Default: install into the project (delegates to the package manager).
  clack.intro(ansis.bold.cyan('siz add'))
  await runInstallSelections(
    names.map((name) => ({ name, dev: !!opts.dev })),
    { noRules: opts.noRules },
  )
}

/** Favorite each package, keyed on its bare name; any version part is dropped. */
async function favorite(names: string[]): Promise<void> {
  const specs = names.map(parseSpec)
  const metas = await Promise.all(specs.map((s) => resolveLatest(s.name)))
  metas.forEach((meta, i) => {
    const { name } = meta
    if (specs[i].version) {
      console.log(ansis.dim(`  (ignoring version for ${name} — favorites track the name only)`))
    }
    if (!meta.exists) {
      console.log(ansis.yellow(`! ${name} not found on npm — favoriting anyway.`))
    }
    const category = suggestCategory({ name })
    const pkg = addFavorite({ name, version: meta.version, category })
    const v = pkg.version ? ansis.dim(` v${pkg.version}`) : ''
    const cat = pkg.category ? ` ${ansis.magenta(`[${pkg.category}]`)}` : ''
    console.log(`${ansis.green('+')} ${ansis.bold(name)}${v}${cat}`)
  })
}

/** Record the packages into the named bundle (created if missing). */
function recordIntoBundle(names: string[], target: string, opts: AddOptions): void {
  const depType: BundleDepType = opts.dev ? 'devDependencies' : 'dependencies'
  const fallback: VersionStrategy = opts.strategy ?? 'caret'
  const entries: BundlePackage[] = names.map((raw) => {
    const { name, version } = parseSpec(raw)
    // An explicit `@version` pins the entry exactly, overriding --strategy.
    if (version) return { name, strategy: 'exact', depType, version }
    return { name, strategy: fallback, depType }
  })
  addToBundle(target, entries)
  console.log(
    `${ansis.green('+')} added ${names.length} package${names.length === 1 ? '' : 's'} to bundle ${ansis.bold(target)}`,
  )
}
