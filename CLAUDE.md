This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`siz` is a CLI for searching, favoriting and installing npm packages. It ships both as a binary (`siz`) and as a library (importable from the package root). Package manager is **pnpm** (`pnpm@10.24.0`), Node `>=20.19.0`, ESM-only TypeScript.

## CLI (`siz -h`)

The command surface is defined entirely by the `cac` registrations in `src/cli.ts` — that file is the single source of truth. The top-level help (`siz -h`) currently renders as below; the `siz/<version>` line is dynamic (sourced from `package.json`), and per-command options (e.g. `siz add --help`) are listed only under that command's own help.

```
siz/0.2.1
Smarter npm package search & management CLI — search, favorite and install packages.

Usage:
  $ siz [...query]

Commands:
  [...query]                     Search npm packages by name (use qualifiers like keyword:cli)
  search [...query]              Full-text search including package descriptions
  add <package> [...packages]    Favorite package(s) (use --bundle to add to a bundle instead)
  bundle <action> [arg1] [arg2]  Manage preset bundles
  upgrade [level]                Upgrade project dependencies (level: major | minor | patch | latest)
  list                           List favorited packages
  rm <package>                   Remove a favorite
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
  $ siz list --category Testing
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
- `add <package…>` → `commands/add.ts`; favorites the package(s) by default. With `-b/--bundle <name>` it instead records them into that bundle (and does **not** favorite), `-D/--dev` marks bundle entries as devDependencies, `-s/--strategy <latest|exact|caret|tilde>` (validated in `cli.ts`, default `caret`) sets the recorded version strategy
- `bundle <action> [arg1] [arg2]` → `commands/bundle.ts`; cac matches on the leading token, so one command dispatches on `action`: `list`/`ls`, `install <name>`, `show <name>`, `rm <name>`, `rename <old> <new>`
- `list`/`ls` (favorites; `-c/--category` filter), `rm` (remove a favorite)
- `upgrade [level]` / `up` (alias) → `commands/upgrade.ts`; `level` is `major | minor | patch | latest` (validated in `cli.ts`, defaults to `latest`); `-r/--recursive` discovers every `package.json` under cwd (monorepo mode); `--dry-run` previews without writing or installing
- `help`, `version` — thin subcommands that reuse cac's built-in `outputHelp()` / `outputVersion()`; the version is sourced from `package.json` (imported), which also backs the `--version` flag

**Main data flow** (interactive search): `interactive.ts` calls `core/registry.searchPackages()`, which hits the npm registry, parses GitHub-style qualifiers via `core/query.ts`, and fuzzy-filters with `fzf`. Results render through `ui/search-prompt.ts` (live multiselect) + `ui/render.ts`. Selected packages flow into local state via `core/store.ts` mutators, and install commands are built by `core/pm.ts`. On **Install**, `interactive.ts` calls `core/project.discoverManifests(cwd, { recursive: true })`; when more than one `package.json` is found it prompts via `ui/prompts.pickInstallTarget()` (label/order built by the pure `buildInstallTargetOptions()`) and runs `detectPM`/`runInstall` with `cwd` set to the chosen workspace directory (the cwd-into-dir approach — uniform across all PMs, including Bun). A single manifest installs in `process.cwd()` as before.

**Upgrade flow** (`siz upgrade`): `commands/upgrade.ts` discovers manifests via `core/project.discoverManifests()` — the nearest `package.json` by default, or (with `-r`) workspace-aware: when a workspace is declared (`loadWorkspaceGlobs()` reads pnpm's `packages:` or an npm/yarn `workspaces` field) only the declared members plus the root are scanned, otherwise it falls back to a Taze-style glob of every `package.json` under cwd (ignoring `node_modules`/`dist`/`.git`). It batch-fetches registry versions for the union of dep names (`collectQueryNames()` → `core/upgrade.fetchVersionInfo()`, `fast-npm-meta`), then `planManifests()` partitions each manifest's deps with `buildUpgradePlan()` under **ceiling** semantics (`patch`→newest within `major.minor`/`~`, `minor`→newest within `major`/`^`, `major`/`latest`→newest overall; `0.x` is treated as breaking, so `minor`/`patch` never cross a `0.x` boundary). Resolution is **independent per package** (Taze-style; no cross-package consensus). It also discovers the nearest `pnpm-workspace.yaml` (walking up, regardless of `-r`) via `core/catalog.discoverCatalog()` and plans each `catalog:` / `catalogs:` entry with `core/upgrade.planCatalog()` (reusing `analyzeDep`). The user multiselects from one flat list (package.json rows tagged with their dir when recursive; catalog rows tagged `catalog` / `catalog:<name>`) in a `@clack/prompts` flow; selections are grouped back by file — package.json rewritten via `core/project.applyRangeEdits()`, catalog entries via `core/catalog.applyCatalogEdits()` (format-preserving YAML edits, scoped by indentation) — each written atomically with `writeManifest()`, then a single `core/pm.buildSyncCommand()` / `runInstall()` runs at the root. Non-registry specifiers (`workspace:`, `catalog:`, npm aliases, git/file/link, URLs) and unparseable ranges are skipped, not touched — the `package.json` `catalog:` refs are left alone because the version is bumped in the catalog itself. Yarn/Bun catalogs and `pnpm.overrides` are not yet handled (see the README's **Features** roadmap).

**Core modules** (`src/core/`):

- `registry.ts` — npm registry search + name/description filtering (fzf) + qualifier handling
- `query.ts` — parses qualifiers: `keyword:`, `author:`, `scope:`, `category:`, `tag:` (`tag:`/`tags:` is an alias of `keyword:` — folded into npm's native `keywords:` search)
- `store.ts` — JSON persistence in the user config dir, non-destructive migrations (schema v3: a single `favorites` map, no two-tier track/favorite), and favorite mutators (`addFavorite`, `removeFavorite`, `listFavorites`, `setCategory`)
- `categories.ts` — heuristic categorization (Frontend, Backend, Testing, …) from name/description/keywords
- `pm.ts` — detect npm/pnpm/yarn/bun/deno and build install commands (incl. dev deps) and the sync/install command (`buildSyncCommand`, `runInstall`) used by upgrade; uses `package-manager-detector`
- `meta.ts` — fast version resolution via `fast-npm-meta`
- `project.ts` — locate the nearest `package.json` (`loadProjectManifest`) or discover workspace members (`discoverManifests`, via `tinyglobby`): workspace-aware when a definition exists (`loadWorkspaceGlobs()` reads pnpm `packages:` / npm-yarn `workspaces`), else a brute-force glob. Collects deps from `dependencies`/`devDependencies` and rewrites version ranges in-place without reformatting (brace-matched block edits, atomic writes); `isUpgradableSpecifier()` filters out non-registry protocols
- `upgrade.ts` — analyze each dep against registry versions and build an upgrade plan with ceiling semantics (`UpgradeMode`); `collectQueryNames()`/`planManifests()` extend this across multiple manifests (`ManifestPlan`); `planCatalog()`/`collectCatalogNames()` do the same for pnpm catalog entries (`CatalogPlanItem`); types `DepAnalysis`, `UpgradePlan`, `VersionInfo`
- `catalog.ts` — locate the nearest `pnpm-workspace.yaml` (`discoverCatalog`), parse its `catalog:` / `catalogs:` blocks into `CatalogEntry[]` (via the `yaml` parser), and rewrite catalog versions in place with indentation-scoped, format-preserving string edits (`applyCatalogEdits`); `readWorkspacePackages()` exposes the file's `packages:` globs for manifest discovery
- `paths.ts` — config dir resolution (Windows `%APPDATA%\siz`, Unix `~/.config/siz`)
- `types.ts` — shared interfaces: `FavoritePackage`, `SizData`, `SearchResult`

**UI** (`src/ui/`): `render.ts` (score bars, category labels, result/favorite cards), `search-prompt.ts` (type-as-you-search multiselect), `prompts.ts` (`@clack/prompts` confirm/action menus, package-manager picker), `upgrade-render.ts` (upgrade summary line, version deltas, option labels), `highlight.ts` (keyword highlighting). Color via `ansis`.

**Library surface** — `src/index.ts` re-exports core functions (`searchPackages`, `addFavorite`, `detectPM`, `buildInstallCommand`, `listFavorites`, the `project.ts`/`upgrade.ts`/`catalog.ts` upgrade functions and types, …). Keep it in sync when core signatures change.

**Data store** — persisted to `data.json` in the config dir (`%APPDATA%\siz\data.json` on Windows, `~/.config/siz/data.json` on Unix). Tests under `test/*.test.ts` mirror the core modules.
