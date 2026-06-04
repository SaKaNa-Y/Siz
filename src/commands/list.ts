import ansis from 'ansis'

import { listPackages, sortByFavoriteThenName } from '../core/store.ts'
import { renderTrackedLine } from '../ui/render.ts'

export interface ListOptions {
  category?: string
  fav?: boolean
}

export function runList(opts: ListOptions = {}): void {
  // Favorites first, then alphabetical.
  const packages = sortByFavoriteThenName(
    listPackages({
      category: opts.category,
      favorite: opts.fav,
    }),
  )

  if (packages.length === 0) {
    console.log(ansis.dim('No tracked packages yet. Try `siz search <query>` or `siz add <pkg>`.'))
    return
  }

  for (const pkg of packages) {
    console.log(renderTrackedLine(pkg))
  }
  console.log(ansis.dim(`\n${packages.length} package(s)`))
}
