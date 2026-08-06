#!/usr/bin/env node
import ansis from 'ansis'
import { cac } from 'cac'

import type { VersionStrategy } from './core/types.ts'

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
import { assertNoRemovedFlags } from './commands/removed-flags.ts'
import { runSearchPrint } from './commands/search.ts'
import { runUpgrade } from './commands/upgrade.ts'
import { parseUpgradeMode } from './core/upgrade.ts'

const cli = cac('siz')

/** Shared handler for `siz [query]` and its `siz search` alias. */
const searchAction =
  ({ deprecated = false } = {}) =>
  async (
    query: string[],
    opts: { size: number; json?: boolean; list?: boolean; rules?: boolean },
  ) => {
    // Warn on stderr, so `--json` piped to a script stays clean.
    if (deprecated) {
      console.error(ansis.yellow('siz search is deprecated — `siz <query>` now does the same.'))
    }
    const q = query.join(' ').trim()
    if (opts.json || opts.list) {
      // A script whose query variable came out empty must never get a TUI.
      if (!q) {
        throw new Error('a query is required with --json / --list. Example: siz zod --json')
      }
      await runSearchPrint(q, { size: Number(opts.size), json: opts.json })
      return
    }
    // Interactive: bare `siz` opens the search box; `siz <query>` seeds it.
    // cac exposes `--no-rules` as `rules === false`.
    await runInteractive(q || undefined, { noRules: opts.rules === false })
  }

/** Register the search command's options + handler (shared by `siz` and its alias). */
function registerSearch(usage: string, description: string, opts: { deprecated?: boolean } = {}) {
  return cli
    .command(usage, description)
    .option('-n, --size <n>', 'Number of results to fetch', { default: 20 })
    .option('--json', 'Output raw JSON results (requires a query)')
    .option('--list', 'Print results without the interactive box (requires a query)')
    .option('--no-rules', 'Bypass dependency rules in siz.config.json when installing')
    .action(searchAction({ deprecated: opts.deprecated }))
}

const defaultCommand = registerSearch(
  '[...query]',
  'Search npm packages (use qualifiers like keyword:cli)',
)

// `siz search` folded into `siz`; kept as a hidden alias (see HIDDEN_COMMANDS)
// for one minor release so the documented command doesn't break without warning.
registerSearch('search [...query]', 'Alias of `siz [query]` (deprecated)', { deprecated: true })

const ADD_STRATEGIES = ['latest', 'exact', 'caret', 'tilde'] as const

cli
  .command(
    'add <package> [...packages]',
    'Install package(s) into the project (--bundle to record instead)',
  )
  .option('-b, --bundle <name>', 'Record packages into a named bundle instead of installing')
  .option('-D, --dev', 'Install / record as devDependencies')
  // No cac default here: `runAdd` falls back to caret, and leaving the option
  // unset is what tells it the user didn't ask for a strategy at all.
  .option(
    '-s, --strategy <strategy>',
    'Version strategy for bundle entries: latest | exact | caret | tilde (default: caret)',
  )
  .option('--no-rules', 'Bypass dependency rules in siz.config.json when installing')
  .action(
    async (
      pkg: string,
      packages: string[],
      opts: { bundle?: string; dev?: boolean; strategy?: string; rules?: boolean },
    ) => {
      const strategy = opts.strategy as VersionStrategy | undefined
      if (strategy && !ADD_STRATEGIES.includes(strategy)) {
        throw new Error(
          `Unknown version strategy "${strategy}". Use: ${ADD_STRATEGIES.join(' | ')}`,
        )
      }
      await runAdd([pkg, ...packages], {
        bundle: opts.bundle,
        dev: opts.dev,
        strategy,
        noRules: opts.rules === false,
      })
    },
  )

// cac matches commands by a single leading token, so the bundle subcommands
// live under one command that dispatches on `action` (e.g. `siz bundle list`).
const BUNDLE_USAGE =
  'Use: list | install <name> | show <name> | rm <name> [...packages] | rename <old> <new>'

cli
  .command('bundle <action> [arg1] [...args]', 'Manage preset bundles')
  .option('--no-rules', 'Bypass dependency rules in siz.config.json (bundle install)')
  .action(
    async (action: string, arg1: string | undefined, args: string[], opts: { rules?: boolean }) => {
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
          if (!arg1) throw new Error('Usage: siz bundle rm <name> [...packages]')
          await runBundleRemove(arg1, args)
          return
        case 'rename': {
          const [newName] = args
          if (!arg1 || !newName) throw new Error('Usage: siz bundle rename <old> <new>')
          runBundleRename(arg1, newName)
          return
        }
        default:
          throw new Error(`Unknown bundle action "${action}". ${BUNDLE_USAGE}`)
      }
    },
  )

cli
  .command('upgrade [level]', 'Upgrade project dependencies (level: major | minor | patch)')
  .alias('up')
  .option('-r, --recursive', 'Recursively upgrade every package.json under the current directory')
  .option('--dry-run', 'Preview updates without writing package.json or installing')
  .action(async (level: string | undefined, opts: { recursive?: boolean; dryRun?: boolean }) => {
    await runUpgrade({
      mode: parseUpgradeMode(level),
      recursive: opts.recursive,
      dryRun: opts.dryRun,
    })
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
  .command('list', 'List saved packages across all bundles')
  .alias('ls')
  .option('-b, --bundle <name>', 'Only list entries saved in this bundle')
  .action((opts: { bundle?: string }) => {
    runList({ bundle: opts.bundle })
  })

cli
  .command('rm <package> [...packages]', 'Uninstall package(s) from the project')
  .action((pkg: string, packages: string[]) => runRemove([pkg, ...packages]))

// Render the full program help (the default command's), not the `help` command's own usage.
cli.command('help', 'Show this help message').action(() => defaultCommand.outputHelp())
cli.command('version', 'Show the installed version').action(() => cli.outputVersion())

// Commands that still work but are no longer advertised in `siz -h`.
const HIDDEN_COMMANDS = new Set(['search'])

const EXAMPLES = [
  'siz react form validation',
  'siz "state management" --list',
  'siz add zod',
  'siz add vitest -D',
  'siz add react@18',
  'siz rm lodash',
  'siz add react vue --bundle my-stack',
  'siz bundle install my-stack',
  'siz upgrade minor',
]

/** One rendered block of cac's help output (cac doesn't export the type). */
interface HelpSection {
  title?: string
  body: string
}

/**
 * cac forces `default: true` onto every `--no-x` flag, so its help renders
 * "(default: true)" — which reads as though the bypass were on by default. The
 * description already says what the flag does; drop the misleading default.
 */
function stripNegatedDefaults(sections: HelpSection[]): HelpSection[] {
  return sections.map((section) =>
    section.title === 'Options'
      ? {
          ...section,
          body: section.body
            .split('\n')
            .map((line) =>
              line.trimStart().startsWith('--no-')
                ? line.replace(/\s*\(default: true\)\s*$/, '')
                : line,
            )
            .join('\n'),
        }
      : section,
  )
}

cli.help((sections) => {
  // Drop cac's verbose per-command "--help" footer.
  const trimmed = stripNegatedDefaults(sections.filter((s) => !s.title?.startsWith('For more info')))
  // Only the top-level help lists Commands; enrich it with the description (kept in
  // sync with package.json) and usage examples, leaving per-command help untouched.
  if (trimmed.some((s) => s.title === 'Commands')) {
    trimmed[0] = { ...trimmed[0], body: `${trimmed[0].body}\n${packageJson.description}` }
    trimmed.push({ title: 'Examples', body: EXAMPLES.map((e) => `  $ ${e}`).join('\n') })
    // Drop hidden commands from the listing; cac renders one padded line each.
    return trimmed.map((section) =>
      section.title === 'Commands'
        ? {
            ...section,
            body: section
              .body!.split('\n')
              .filter((line) => !HIDDEN_COMMANDS.has(line.trim().split(/\s/)[0]))
              .join('\n'),
          }
        : section,
    )
  }
  return trimmed
})
cli.version(packageJson.version)
// cac's default outputVersion appends platform/runtime info; print just the version.
cli.outputVersion = () => console.log(packageJson.version)

async function main() {
  try {
    // Removed flags are caught before parsing: cac would reject them with a bare
    // "Unknown option", which says nothing about what replaced them.
    assertNoRemovedFlags(process.argv.slice(2))
    cli.parse(process.argv, { run: false })
    await cli.runMatchedCommand()
  } catch (err) {
    console.error(ansis.red(`\nsiz: ${(err as Error).message}`))
    process.exit(1)
  }
}

main()
