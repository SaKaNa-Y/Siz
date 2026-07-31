import ansis from 'ansis'

import { listSavedEntries } from '../core/store.ts'
import { renderSavedEntryLine } from '../ui/bundle-render.ts'

export interface ListOptions {
  /** Narrow the list to a single bundle. */
  bundle?: string
}

/** `siz list` — print every saved entry across all bundles, tagged with its bundle. */
export function runList(opts: ListOptions = {}): void {
  const entries = listSavedEntries({ bundle: opts.bundle })

  if (entries.length === 0) {
    console.log(
      ansis.dim(
        opts.bundle
          ? `Bundle "${opts.bundle}" has no saved packages.`
          : 'Nothing saved yet. Save packages with `siz add <pkg> --bundle <name>`.',
      ),
    )
    return
  }

  for (const entry of entries) {
    console.log(renderSavedEntryLine(entry))
  }
  console.log(ansis.dim(`\n${entries.length} package(s)`))
}
