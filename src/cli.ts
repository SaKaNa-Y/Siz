#!/usr/bin/env node
import ansis from 'ansis'
import { cac } from 'cac'

import type { SearchMode } from './core/registry.ts'
import type { VersionStrategy } from './core/types.ts'
import type { UpgradeMode } from './core/upgrade.ts'

import packageJson from '../package.json' with { type: 'json' }
import { runAdd } from './commands/add.ts'
import {
  runBundleInstall,
  runBundleList,
  runBundleRemove,
  runBundleRename,
  runBundleShow,
} from './commands/bundle.ts'
import { runInteractive } from './commands/interactive.ts'
import { runList } from './commands/list.ts'
import { runOutdated } from './commands/outdated.ts'
import { runRemove } from './commands/remove.ts'
import { runSearchPrint } from './commands/search.ts'
import { runUpgrade } from './commands/upgrade.ts'

const cli = cac('siz')

/** Shared handler for the name (`siz`) and full-text (`siz search`) commands. */
function searchAction(mode: SearchMode) {
  return async (
    query: string[],
    opts: { size: number; json?: boolean; list?: boolean; rules?: boolean },
  ) => {
    const q = query.join(' ').trim()
    // Non-interactive paths require a query.
    if ((opts.json || opts.list) && q) {
      await runSearchPrint(q, { size: Number(opts.size), json: opts.json, mode })
      return
    }
    // Interactive: bare `siz` opens the search box; `siz <query>` seeds it.
    // cac exposes `--no-rules` as `rules === false`.
    await runInteractive(q || undefined, mode, { noRules: opts.rules === false })
  }
}

const defaultCommand = cli
  .command('[...query]', 'Search npm packages by name (use qualifiers like keyword:cli)')
  .option('-n, --size <n>', 'Number of results to fetch', { default: 20 })
  .option('--json', 'Output raw JSON results (requires a query)')
  .option('--list', 'Print results without the interactive box (requires a query)')
  .option('--no-rules', 'Bypass dependency rules in siz.config.json when installing')
  .action(searchAction('name'))

cli
  .command('search [...query]', 'Full-text search including package descriptions')
  .option('-n, --size <n>', 'Number of results to fetch', { default: 20 })
  .option('--json', 'Output raw JSON results (requires a query)')
  .option('--list', 'Print results without the interactive box (requires a query)')
  .option('--no-rules', 'Bypass dependency rules in siz.config.json when installing')
  .action(searchAction('description'))

const ADD_STRATEGIES = ['latest', 'exact', 'caret', 'tilde'] as const

cli
  .command(
    'add <package> [...packages]',
    'Favorite package(s) (use --bundle to add to a bundle instead)',
  )
  .option('-b, --bundle <name>', 'Record packages into a named bundle instead of favoriting')
  .option('-D, --dev', 'Record bundle entries as devDependencies')
  .option(
    '-s, --strategy <strategy>',
    'Version strategy for bundle entries: latest | exact | caret | tilde',
    { default: 'caret' },
  )
  .action(
    async (
      pkg: string,
      packages: string[],
      opts: { bundle?: string; dev?: boolean; strategy?: string },
    ) => {
      const strategy = (opts.strategy ?? 'caret') as VersionStrategy
      if (!ADD_STRATEGIES.includes(strategy)) {
        throw new Error(
          `Unknown version strategy "${strategy}". Use: latest | exact | caret | tilde`,
        )
      }
      await runAdd([pkg, ...packages], { bundle: opts.bundle, dev: opts.dev, strategy })
    },
  )

// cac matches commands by a single leading token, so the bundle subcommands
// live under one command that dispatches on `action` (e.g. `siz bundle list`).
const BUNDLE_USAGE = 'Use: list | install <name> | show <name> | rm <name> | rename <old> <new>'

cli
  .command('bundle <action> [arg1] [arg2]', 'Manage preset bundles')
  .option('--no-rules', 'Bypass dependency rules in siz.config.json (bundle install)')
  .action(
    async (
      action: string,
      arg1: string | undefined,
      arg2: string | undefined,
      opts: { rules?: boolean },
    ) => {
      switch (action) {
        case 'list':
        case 'ls':
          runBundleList()
          return
        case 'install':
          if (!arg1) throw new Error('Usage: siz bundle install <name>')
          await runBundleInstall(arg1, { noRules: opts.rules === false })
          return
        case 'show':
          if (!arg1) throw new Error('Usage: siz bundle show <name>')
          runBundleShow(arg1)
          return
        case 'rm':
          if (!arg1) throw new Error('Usage: siz bundle rm <name>')
          await runBundleRemove(arg1)
          return
        case 'rename':
          if (!arg1 || !arg2) throw new Error('Usage: siz bundle rename <old> <new>')
          runBundleRename(arg1, arg2)
          return
        default:
          throw new Error(`Unknown bundle action "${action}". ${BUNDLE_USAGE}`)
      }
    },
  )

const UPGRADE_LEVELS = ['major', 'minor', 'patch', 'latest'] as const

cli
  .command(
    'upgrade [level]',
    'Upgrade project dependencies (level: major | minor | patch | latest)',
  )
  .alias('up')
  .option('-r, --recursive', 'Recursively upgrade every package.json under the current directory')
  .option('--dry-run', 'Preview updates without writing package.json or installing')
  .action(async (level: string | undefined, opts: { recursive?: boolean; dryRun?: boolean }) => {
    const mode = (level ?? 'latest') as UpgradeMode
    if (!UPGRADE_LEVELS.includes(mode)) {
      throw new Error(`Unknown upgrade level "${level}". Use: major | minor | patch | latest`)
    }
    await runUpgrade({ mode, recursive: opts.recursive, dryRun: opts.dryRun })
  })

cli
  .command('outdated', 'Report outdated dependencies (read-only)')
  .option('-r, --recursive', 'Scan every package.json under the current directory')
  .option('--json', 'Output the report as JSON (for CI)')
  .option('--exit-code', 'Exit 1 when any dependency is outdated')
  .action(async (opts: { recursive?: boolean; json?: boolean; exitCode?: boolean }) => {
    process.exitCode = await runOutdated({
      recursive: opts.recursive,
      json: opts.json,
      exitCode: opts.exitCode,
    })
  })

cli
  .command('list', 'List favorited packages')
  .alias('ls')
  .option('-c, --category <category>', 'Filter by category')
  .action((opts: { category?: string }) => {
    runList({ category: opts.category })
  })

cli.command('rm <package>', 'Remove a favorite').action((pkg: string) => runRemove(pkg))

// Render the full program help (the default command's), not the `help` command's own usage.
cli.command('help', 'Show this help message').action(() => defaultCommand.outputHelp())
cli.command('version', 'Show the installed version').action(() => cli.outputVersion())

const EXAMPLES = [
  'siz react form validation',
  'siz search "state management" --list',
  'siz add zod vitest',
  'siz add react vue --bundle my-stack',
  'siz add zod --strategy exact --bundle my-stack',
  'siz bundle install my-stack',
  'siz upgrade minor',
  'siz list --category Testing',
]

cli.help((sections) => {
  // Drop cac's verbose per-command "--help" footer.
  const trimmed = sections.filter((s) => !s.title?.startsWith('For more info'))
  // Only the top-level help lists Commands; enrich it with the description (kept in
  // sync with package.json) and usage examples, leaving per-command help untouched.
  if (trimmed.some((s) => s.title === 'Commands')) {
    trimmed[0] = { ...trimmed[0], body: `${trimmed[0].body}\n${packageJson.description}` }
    trimmed.push({ title: 'Examples', body: EXAMPLES.map((e) => `  $ ${e}`).join('\n') })
  }
  return trimmed
})
cli.version(packageJson.version)
// cac's default outputVersion appends platform/runtime info; print just the version.
cli.outputVersion = () => console.log(packageJson.version)

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
