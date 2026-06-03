This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`siz` is a CLI for searching, favoriting, tagging and tracking npm packages. It ships both as a binary (`siz`) and as a library (importable from the package root). Package manager is **pnpm** (`pnpm@10.24.0`), Node `>=20.19.0`, ESM-only TypeScript.

## CLI (`siz -h`)

The command surface is defined entirely by the `cac` registrations in `src/cli.ts` — that file is the single source of truth. The top-level help (`siz -h`) currently renders as below; the `siz/<version>` line is dynamic (sourced from `package.json`), and per-command options (e.g. `siz add --help`) are listed only under that command's own help.

```
siz/0.1.2
Smarter npm package search & management CLI — search, favorite, tag and track packages.

Usage:
  $ siz [...query]

Commands:
  [...query]                     Search npm packages by name (use qualifiers like keyword:cli)
  search [...query]              Full-text search including package descriptions
  add <package> [...packages]    Track package(s) manually
  bundle <action> [arg1] [arg2]  Manage preset bundles
  upgrade [level]                Upgrade project dependencies (level: major | minor | patch | latest)
  list                           List tracked packages
  fav <package>                  Mark a package as favorite
  unfav <package>                Remove favorite mark
  tag <package> [...tags]        Add tags to a package
  untag <package> [...tags]      Remove tags from a package
  rm <package>                   Untrack a package
  help                           Show this help message
  version                        Show the installed version

Options:
  -n, --size <n>  Number of results to fetch (default: 20)
  --json          Output raw JSON results (requires a query)
  --list          Print results without the interactive box (requires a query)
  -h, --help      Display this message
  -v, --version   Display version number

Examples:
  $ siz react form validation
  $ siz search "state management" --list
  $ siz add zod vitest
  $ siz add react vue --bundle my-stack
  $ siz add zod --strategy exact --bundle my-stack
  $ siz bundle install my-stack
  $ siz upgrade minor
  $ siz list --fav --tag lightweight
```

**Rule:** whenever a command, option, flag, alias, or example is added, changed, or removed in `src/cli.ts`, update this help block (and the relevant per-command help) to match — `siz -h` is part of the public surface and must never drift from the code.

## Commands

- `pnpm dev` — run the CLI in dev (`tsx src/cli.ts`)
- `pnpm build` — bundle with `tsdown` (two entry points: `src/index.ts`→`dist/index.js`, `src/cli.ts`→`dist/cli.js`; ESM, Node 20, emits `.d.ts`)
- `pnpm test` — run all tests once (`vitest run`)
- `pnpm test:watch` — tests in watch mode (`vitest`)
- `pnpm typecheck` — static type check (`tsc --noEmit`)
- `pnpm lint` — lint with **oxlint** (`.oxlintrc.json`); `pnpm lint:fix` auto-fixes
- `pnpm format` — check formatting with **oxfmt** (`.oxfmtrc.json`, import sorting on); `pnpm format:fix` writes

Run a single test file: `pnpm vitest run test/query.test.ts`
Filter by test name: `pnpm vitest run -t "parses qualifiers"`

Static-analysis gates (all run in CI): `pnpm lint` (oxlint, fails on errors), `pnpm format` (oxfmt `--check`), and `pnpm typecheck`. TypeScript is strict (ES2022 target, ESNext modules, `noUnusedLocals`/`noUnusedParameters`).

## Releasing

Releases run through **Changesets** — never `npm publish` manually. (`0.1.0` was published by hand, which is why it has no GitHub Release; every release from here on goes through the pipeline below so npm publish, the git tag, and the GitHub Release all happen together.)

**Authoring a changeset** — every user-facing PR needs one (skip pure chore/docs/test PRs):

- Run `pnpm changeset`, choose the bump level, and write a user-facing summary. This creates a markdown file under `.changeset/`.
- Required frontmatter shape:

  ```md
  ---
  "@sakana-y/siz": minor
  ---

  Human-readable, user-facing summary of the change.
  ```

  - The package name must be exactly `@sakana-y/siz`.
  - Bump levels while `0.x`: `patch` = fixes/internal, `minor` = features **and** breaking changes (pre-1.0 convention), `major` is reserved for the 1.0 stabilization.
  - One changeset per logical change; multiple are allowed per PR. The body is Markdown and becomes the `CHANGELOG.md` entry **and** the GitHub Release notes.

**Release flow (end to end):** author changeset → merge PR to `main` → the Changesets bot opens/updates a **"Version Packages"** PR (bumps `package.json`, writes `CHANGELOG.md`) → review & merge that PR → `release.yml` runs `changeset publish` → npm publish (with provenance) + git tag + GitHub Release are created automatically. The first release after `0.1.0` (`0.1.1`/`0.2.0`) is the first to produce a real GitHub Release.

**Rules:** never hand-edit `CHANGELOG.md` or bump `version` manually; don't merge the Version PR until you're ready to publish; `pnpm version-packages` runs `changeset version && pnpm format:fix` so the auto-generated Version PR stays green against the `pnpm format` gate.

For contrast: this is the **Changesets** model (explicit, PR-driven, also used by `vue-grab`). `vitejs/devtools` uses **changelogithub** instead — tag-driven, generating releases from conventional commits.

## Architecture

Three layers, top to bottom: **Commands** orchestrate flow → **Core** holds logic and data → **UI** renders and prompts.

**Entry / routing** — `src/cli.ts` uses `cac` to register subcommands and dispatch to `src/commands/*`:

- bare `siz [query]` → `commands/interactive.ts` (name search; or `commands/search.ts` for `--list` / `--json`); `search [query]` is the same flow over descriptions (full-text)
- `add <package…>` → `commands/add.ts`; `-b/--bundle <name>` also records into a bundle, `-D/--dev` marks bundle entries as devDependencies, `-s/--strategy <latest|exact|caret|tilde>` (validated in `cli.ts`, default `caret`) sets the recorded version strategy
- `bundle <action> [arg1] [arg2]` → `commands/bundle.ts`; cac matches on the leading token, so one command dispatches on `action`: `list`/`ls`, `install <name>`, `show <name>`, `rm <name>`, `rename <old> <new>`
- `list`/`ls`, `fav`/`unfav`, `tag`/`untag`, `rm`
- `upgrade [level]` / `up` (alias) → `commands/upgrade.ts`; `level` is `major | minor | patch | latest` (validated in `cli.ts`, defaults to `latest`); `--dry-run` previews without writing or installing
- `help`, `version` — thin subcommands that reuse cac's built-in `outputHelp()` / `outputVersion()`; the version is sourced from `package.json` (imported), which also backs the `--version` flag

**Main data flow** (interactive search): `interactive.ts` calls `core/registry.searchPackages()`, which hits the npm registry, parses GitHub-style qualifiers via `core/query.ts`, and fuzzy-filters with `fzf`. Results render through `ui/search-prompt.ts` (live multiselect) + `ui/render.ts`. Selected packages flow into local state via `core/store.ts` mutators, and install commands are built by `core/pm.ts`.

**Upgrade flow** (`siz upgrade`): `commands/upgrade.ts` loads the nearest `package.json` via `core/project.loadProjectManifest()`, batch-fetches registry versions through `core/upgrade.fetchVersionInfo()` (`fast-npm-meta`), and partitions deps with `buildUpgradePlan()` under **ceiling** semantics (`patch`→newest within `major.minor`/`~`, `minor`→newest within `major`/`^`, `major`/`latest`→newest overall; `0.x` is treated as breaking, so `minor`/`patch` never cross a `0.x` boundary). The user multiselects in a `@clack/prompts` flow, then ranges are rewritten **format-preservingly** via `core/project.applyRangeEdits()` + atomic `writeManifest()`, and `core/pm.buildSyncCommand()` / `runInstall()` apply them. Non-registry specifiers (`workspace:`, `catalog:`, npm aliases, git/file/link, URLs) and unparseable ranges are skipped, not touched.

**Core modules** (`src/core/`):

- `registry.ts` — npm registry search + name/description filtering (fzf) + qualifier handling
- `query.ts` — parses qualifiers: `keyword:`, `author:`, `scope:`, `category:`, `tag:`
- `store.ts` — JSON persistence in the user config dir, non-destructive migrations, and tracking/favorite/tag mutators
- `categories.ts` — heuristic categorization (Frontend, Backend, Testing, …) from name/description/keywords
- `pm.ts` — detect npm/pnpm/yarn/bun/deno and build install commands (incl. dev deps) and the sync/install command (`buildSyncCommand`, `runInstall`) used by upgrade; uses `package-manager-detector`
- `meta.ts` — fast version resolution via `fast-npm-meta`
- `project.ts` — locate the nearest `package.json`, collect deps from `dependencies`/`devDependencies`, and rewrite version ranges in-place without reformatting (brace-matched block edits, atomic writes); `isUpgradableSpecifier()` filters out non-registry protocols
- `upgrade.ts` — analyze each dep against registry versions and build an upgrade plan with ceiling semantics (`UpgradeMode`); types `DepAnalysis`, `UpgradePlan`, `VersionInfo`
- `paths.ts` — config dir resolution (Windows `%APPDATA%\siz`, Unix `~/.config/siz`)
- `types.ts` — shared interfaces: `TrackedPackage`, `SizData`, `SearchResult`

**UI** (`src/ui/`): `render.ts` (score bars, category labels, result/tracked cards), `search-prompt.ts` (type-as-you-search multiselect), `prompts.ts` (`@clack/prompts` confirm/action menus, package-manager picker), `upgrade-render.ts` (upgrade summary line, version deltas, option labels), `highlight.ts` (keyword highlighting). Color via `ansis`.

**Library surface** — `src/index.ts` re-exports core functions (`searchPackages`, `trackPackage`, `detectPM`, `buildInstallCommand`, `listPackages`, the `project.ts`/`upgrade.ts` upgrade functions and types, …). Keep it in sync when core signatures change.

**Data store** — persisted to `data.json` in the config dir (`%APPDATA%\siz\data.json` on Windows, `~/.config/siz/data.json` on Unix). Tests under `test/*.test.ts` mirror the core modules.
