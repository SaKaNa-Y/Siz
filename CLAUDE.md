
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`siz` is a CLI for searching, favoriting, tagging and tracking npm packages. It ships both as a binary (`siz`) and as a library (importable from the package root). Package manager is **pnpm** (`pnpm@10.24.0`), Node `>=20.19.0`, ESM-only TypeScript.

## Commands

- `pnpm dev` — run the CLI in dev (`tsx src/cli.ts`)
- `pnpm build` — bundle with `tsdown` (two entry points: `src/index.ts`→`dist/index.js`, `src/cli.ts`→`dist/cli.js`; ESM, Node 20, emits `.d.ts`)
- `pnpm test` — run all tests once (`vitest run`)
- `pnpm test:watch` — tests in watch mode (`vitest`)
- `pnpm typecheck` — static type check (`tsc --noEmit`)

Run a single test file: `pnpm vitest run test/query.test.ts`
Filter by test name: `pnpm vitest run -t "parses qualifiers"`

There is no lint script or eslint config — `pnpm typecheck` is the static-analysis gate. TypeScript is strict (ES2022 target, ESNext modules, `noUnusedLocals`/`noUnusedParameters`).

## Architecture

Three layers, top to bottom: **Commands** orchestrate flow → **Core** holds logic and data → **UI** renders and prompts.

**Entry / routing** — `src/cli.ts` uses `cac` to register subcommands and dispatch to `src/commands/*`:
- bare `siz [query]` → `commands/interactive.ts` (or `commands/search.ts` for `--list` / `--json`)
- `add`, `list`/`ls`, `fav`/`unfav`, `tag`/`untag`, `rm`

**Main data flow** (interactive search): `interactive.ts` calls `core/registry.searchPackages()`, which hits the npm registry, parses GitHub-style qualifiers via `core/query.ts`, and fuzzy-filters with `fzf`. Results render through `ui/search-prompt.ts` (live multiselect) + `ui/render.ts`. Selected packages flow into local state via `core/store.ts` mutators, and install commands are built by `core/pm.ts`.

**Core modules** (`src/core/`):
- `registry.ts` — npm registry search + name/description filtering (fzf) + qualifier handling
- `query.ts` — parses qualifiers: `keyword:`, `author:`, `scope:`, `category:`, `tag:`
- `store.ts` — JSON persistence in the user config dir, non-destructive migrations, and tracking/favorite/tag mutators
- `categories.ts` — heuristic categorization (Frontend, Backend, Testing, …) from name/description/keywords
- `pm.ts` — detect npm/pnpm/yarn/bun/deno and build install commands (incl. dev deps); uses `package-manager-detector`
- `meta.ts` — fast version resolution via `fast-npm-meta`
- `paths.ts` — config dir resolution (Windows `%APPDATA%\siz`, Unix `~/.config/siz`)
- `types.ts` — shared interfaces: `TrackedPackage`, `SizData`, `SearchResult`

**UI** (`src/ui/`): `render.ts` (score bars, category labels, result/tracked cards), `search-prompt.ts` (type-as-you-search multiselect), `prompts.ts` (`@clack/prompts` confirm/action menus), `highlight.ts` (keyword highlighting). Color via `ansis`.

**Library surface** — `src/index.ts` re-exports core functions (`searchPackages`, `trackPackage`, `detectPM`, `buildInstallCommand`, `listPackages`, …). Keep it in sync when core signatures change.

**Data store** — persisted to `data.json` in the config dir (`%APPDATA%\siz\data.json` on Windows, `~/.config/siz/data.json` on Unix). Tests under `test/*.test.ts` mirror the core modules.
