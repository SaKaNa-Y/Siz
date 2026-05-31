#!/usr/bin/env node
import ansis from 'ansis'
import { cac } from 'cac'

import type { SearchMode } from './core/registry.ts'

import { runAdd } from './commands/add.ts'
import { runFavorite } from './commands/favorite.ts'
import { runInteractive } from './commands/interactive.ts'
import { runList } from './commands/list.ts'
import { runRemove } from './commands/remove.ts'
import { runSearchPrint } from './commands/search.ts'
import { runTag, runUntag } from './commands/tag.ts'

const cli = cac('siz')

/** Shared handler for the name (`siz`) and full-text (`siz search`) commands. */
function searchAction(mode: SearchMode) {
  return async (query: string[], opts: { size: number; json?: boolean; list?: boolean }) => {
    const q = query.join(' ').trim()
    // Non-interactive paths require a query.
    if ((opts.json || opts.list) && q) {
      await runSearchPrint(q, { size: Number(opts.size), json: opts.json, mode })
      return
    }
    // Interactive: bare `siz` opens the search box; `siz <query>` seeds it.
    await runInteractive(q || undefined, mode)
  }
}

cli
  .command('[...query]', 'Search npm packages by name (use qualifiers like keyword:cli)')
  .option('-n, --size <n>', 'Number of results to fetch', { default: 20 })
  .option('--json', 'Output raw JSON results (requires a query)')
  .option('--list', 'Print results without the interactive box (requires a query)')
  .action(searchAction('name'))

cli
  .command('search [...query]', 'Full-text search including package descriptions')
  .option('-n, --size <n>', 'Number of results to fetch', { default: 20 })
  .option('--json', 'Output raw JSON results (requires a query)')
  .option('--list', 'Print results without the interactive box (requires a query)')
  .action(searchAction('description'))

cli
  .command('add <package> [...packages]', 'Track package(s) manually')
  .action(async (pkg: string, packages: string[]) => {
    await runAdd([pkg, ...packages])
  })

cli
  .command('list', 'List tracked packages')
  .alias('ls')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('-c, --category <category>', 'Filter by category')
  .option('-f, --fav', 'Show favorites only')
  .action((opts: { tag?: string; category?: string; fav?: boolean }) => {
    runList({ tag: opts.tag, category: opts.category, fav: opts.fav })
  })

cli
  .command('fav <package>', 'Mark a package as favorite')
  .action((pkg: string) => runFavorite(pkg, true))
cli
  .command('unfav <package>', 'Remove favorite mark')
  .action((pkg: string) => runFavorite(pkg, false))

cli
  .command('tag <package> [...tags]', 'Add tags to a package')
  .action((pkg: string, tags: string[]) => runTag(pkg, tags))

cli
  .command('untag <package> [...tags]', 'Remove tags from a package')
  .action((pkg: string, tags: string[]) => runUntag(pkg, tags))

cli.command('rm <package>', 'Untrack a package').action((pkg: string) => runRemove(pkg))

cli.help()
cli.version(process.env.npm_package_version ?? '0.1.0')

async function main() {
  try {
    cli.parse(process.argv, { run: false })
    await cli.runMatchedCommand()
  } catch (err) {
    console.error(ansis.red(`\nsiz: ${(err as Error).message}`))
    process.exit(1)
  }
}

main()
