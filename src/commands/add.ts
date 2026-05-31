import ansis from 'ansis'

import { suggestCategory } from '../core/categories.ts'
import { resolveLatest } from '../core/meta.ts'
import { trackPackage } from '../core/store.ts'

/**
 * Track one or more packages manually (e.g. things already installed).
 * Resolves the latest version and auto-suggests a category.
 */
export async function runAdd(names: string[]): Promise<void> {
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
}
