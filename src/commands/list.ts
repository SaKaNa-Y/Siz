import ansis from 'ansis'

import { listFavorites } from '../core/store.ts'
import { renderFavoriteLine } from '../ui/render.ts'

export interface ListOptions {
  category?: string
}

export function runList(opts: ListOptions = {}): void {
  const packages = listFavorites({ category: opts.category })

  if (packages.length === 0) {
    console.log(ansis.dim('No favorites yet. Try `siz search <query>` or `siz add <pkg>`.'))
    return
  }

  for (const pkg of packages) {
    console.log(renderFavoriteLine(pkg))
  }
  console.log(ansis.dim(`\n${packages.length} package(s)`))
}
