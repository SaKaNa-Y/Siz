# Siz

> **Si**mpler package **z**earch — a smarter npm package search and management CLI.

Siz is a command-line tool for discovering, installing, and organizing npm packages. Open a live search box, multi-select what you need, then install it with your package manager of choice — or favorite packages for later. Everything you organize is stored locally and stays safe across upgrades.

Inspired by [`@rizumu/nai`](https://github.com/LittleSound/nai): Siz keeps nai's interactive search-and-install flow, and adds a discovery and organization layer (favorites and categories) around it. It also borrows ideas from antfu's [`ni`](https://github.com/antfu-collective/ni) (package-manager detection and a unified install experience) and [`taze`](https://github.com/antfu-collective/taze) (ceiling-based dependency upgrades).

## Features

A check mark means the feature ships today; an empty box is planned, tagged **Next** (actively planned), **Later** (committed, unscheduled), or **Maybe** (exploratory).

Siz is organized into three tracks — **Discover**, **Organize**, **Manage** — developed in parallel under one CLI. The Manage track aims to interoperate with the `ni` · `taze` ecosystem rather than compete with it.

### Discover

- [x] Live interactive npm search with type-as-you-go multi-select
- [x] Full-text search across name and description (`siz search`)
- [x] GitHub-style qualifiers in queries (`keyword:` `author:` `scope:` `category:` `tag:`)
- [x] Trust-aware discovery: deprecation, publish age, and provenance shown inline on each result, before install
- [ ] **Later** — Download-trend signal — extend trust-aware discovery with download-count momentum
- [ ] **Later** — Smart replacement suggestions for deprecated or heavier packages
- [ ] **Later** — AI-assisted search: opt-in LLM query expansion and result reranking

### Organize

- [x] Favorite and categorize packages in a local list
- [x] Heuristic auto-categorization when you add a package
- [x] Preset bundles — named groups of packages you can install together in one step
- [ ] **Later** — Local search and install history
- [ ] **Maybe** — Team-shared presets

### Manage

_Interoperates with the `ni` · `taze` ecosystem._

- [x] Install via your package manager (npm / pnpm / yarn / bun / deno) — pick it at install time, with a per-package dependency vs devDependency toggle
- [x] Upgrade project dependencies with ceiling semantics and `--dry-run`
- [x] pnpm catalog upgrades — bump `catalog:` / `catalogs:` versions in `pnpm-workspace.yaml`
- [x] Monorepo install & recursive upgrades — workspace picker on install, `siz upgrade -r`
- [x] Workspace-aware discovery — honor declared `packages:` / `workspaces` globs, skip stray manifests
- [ ] **Next** — Dependency rules — project-local, committable allow/restrict config
- [ ] **Later** — Catalog management during install — `ni`-style `catalog:` writing
- [ ] **Later** — Yarn & Bun catalog upgrades — extend catalog upgrades beyond pnpm
- [ ] **Later** — Nested-workspace guard & root pins — `--ignore-other-workspaces`, `pnpm.overrides` / `resolutions`
- [ ] **Maybe** — Dependency health audit (outdated / deprecated / vulnerable) — standalone report; most of its value is delivered by trust-aware discovery above

### Foundations

- [x] Safe local data store (user config dir, non-destructive migrations, atomic writes)
- [x] Library API for programmatic use

## Install

```bash
npm i -g @sakana-y/siz
# or
pnpm add -g @sakana-y/siz
```

Requires Node.js >= 20.19.

## Quick start

```bash
# Open the live search box (type to search, multi-select, then act)
siz

# Seed the search box with a query (name search — matches package names)
siz vite

# Full-text search, including package descriptions
siz search vite

# Favorite packages you already use
siz add lodash zod vitest

# Group packages into a reusable bundle, then install it anywhere
siz add react vue --bundle my-stack
siz bundle install my-stack

# Browse your favorites, filter by category
siz list
siz list --category Testing

# Upgrade this project's dependencies
siz upgrade minor
```

## Search and act

Run `siz` with no arguments to open a live search box. As you type, Siz queries the official npm registry (`registry.npmjs.org`) — no API key required:

- `siz` and `siz <query>` search by package **name**.
- `siz search <query>` runs a **full-text** search that also matches package **descriptions**.

```bash
siz                            # empty box, name search
siz pino                       # box seeded with "pino" (matches package names)
siz search "fast node logger"  # full-text search, also matches descriptions
```

Name search matches package **names** (fuzzy-ranked), so seed it with a name or name
fragment; reach for `siz search` when you want to describe what a package *does*.

Inside the box:

| Key       | Action                                     |
| --------- | ------------------------------------------ |
| _type_    | Search npm live (debounced)                |
| `↑` / `↓` | Move between results                       |
| `Tab`     | Select / deselect a package (multi-select) |
| `Ctrl+T`  | Toggle the focused package between dependency and devDependency (`[dep]` / `[dev]` badge) |
| `Enter`   | Confirm your selection                     |
| `Ctrl+O`  | Open the focused package on npmjs.com      |

After you confirm a selection, Siz shows an action menu for the chosen packages:

- **Install** — detects your package manager (npm / pnpm / yarn / bun / deno via [`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector), part of the [`ni`](https://github.com/antfu-collective/ni) project) and lets you confirm or switch it at install time. Each package carries a `[dep]` / `[dev]` badge you flip with `Ctrl+T` in the search box; mixed selections run as separate `add` / `add -D` commands. Siz shows the exact command(s) for confirmation, then runs them. In a monorepo — when more than one `package.json` is found under the current directory (skipping `node_modules`, `dist`, and `.git`) — Siz first asks **which package to install into** and runs the package manager in that package's directory, so the dependency lands in the right workspace. With a single `package.json`, there's no extra prompt.
- **Favorite** — add the packages to your favorites list.
- **Add to bundle** — save the selection to a reusable bundle.

Pressing **Enter** on an empty box (nothing typed) opens your favorites instead, so your curated packages are the front door — select any and run the same action menu.

### Trust signals

To help you judge a package _before_ installing, Siz annotates each result with inline **trust signals** — health facts fetched alongside the search:

| Glyph | Meaning                                                              |
| ----- | ------------------------------------------------------------------- |
| `⚠`   | **Deprecated** — the package carries a deprecation message          |
| `⚑`   | **Stale** — its latest version was published more than 2 years ago  |
| `✓`   | **Provenance** — the package has npm provenance or a trusted publisher |

The glyphs show on every row so you can compare at a glance; the focused row expands them to words (e.g. `deprecated: no longer maintained · published 4y ago`). Signals are purely informational — they never block, filter, or reorder results. They load progressively (the list never waits on them) and degrade silently if the metadata service is unreachable. The `--list` and `--json` outputs include them too (`--json` adds `deprecated`, `publishedAt`, and `provenance` fields per result).

### Non-interactive output

For scripting or piping, pass a query with a flag:

| Flag             | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `--list`         | Print matching results as text and exit (requires a query) |
| `--json`         | Print raw JSON results and exit (requires a query)         |
| `-n, --size <n>` | Number of results to fetch (default 20)                    |

```bash
siz pino --list
siz zod --json
siz search "fast node logger" --list
```

## Upgrade dependencies

`siz upgrade` reads the current project's `package.json`, checks the npm registry for newer versions, and walks you through bumping them — pick which packages to update, choose your package manager, and Siz rewrites the version ranges in place (preserving your `^`/`~`/exact style and the file's formatting), then runs the install.

```bash
siz upgrade            # offer the latest of everything
siz upgrade minor      # cap upgrades at the same major
siz upgrade patch      # cap at the same major.minor
siz upgrade -r         # recurse into every package.json under the current dir
siz upgrade --dry-run  # preview the changes without writing or installing
```

Levels use **ceiling** semantics (like [`taze`](https://github.com/antfu-collective/taze)): `minor` lifts each package to the newest version within its current major, `patch` to the newest within its current major.minor, and bare `upgrade` / `major` / `latest` to the absolute newest. Pre-1.0 `0.x` versions are treated as breaking, so `minor`/`patch` never cross a `0.x` boundary.

In a monorepo, `-r` / `--recursive` discovers the workspace's member `package.json` files and offers all of their updates in one list, each row tagged with its package. Discovery is **workspace-aware**: when a workspace is declared — pnpm's `packages:` in `pnpm-workspace.yaml`, or an npm/yarn `workspaces` field — only the declared members (plus the root) are scanned, so a stray `package.json` in `examples/`, `fixtures/`, or `docs/` is left alone. With no workspace definition, `-r` falls back to globbing every `package.json` under the current directory (skipping `node_modules`, `dist`, and `.git`). Each dependency is resolved independently per package, the manifests are rewritten in place, and a single install runs at the root. Without `-r`, `siz upgrade` only touches the nearest `package.json`.

**pnpm catalogs.** If a `pnpm-workspace.yaml` is found (walking up from the current directory), Siz reads its `catalog:` and `catalogs:` blocks and offers each entry as its own upgrade row, tagged `catalog` (or `catalog:<name>`). Selected entries are rewritten **in `pnpm-workspace.yaml`** — format- and comment-preservingly — so a version is bumped once for the whole workspace. The `catalog:` references inside each `package.json` are deliberately left untouched, since they point at the catalog that just changed. (Yarn and Bun catalogs are not handled yet.)

Specifiers that aren't plain registry ranges — `workspace:`, `catalog:`, npm aliases, git/file/link sources — and packages not found on the registry are skipped and left untouched (the package.json `catalog:` refs are managed via the catalog itself, as described above).

## Bundles

A **bundle** is a reusable, named collection of packages you can install in one step — handy for the stack you reach for on every new project.

Record packages straight into a bundle with `--bundle` (this records into the bundle rather than favoriting):

```bash
# Add packages straight into a bundle (created if it doesn't exist)
siz add react react-dom --bundle my-stack
siz add vitest --bundle my-stack -D     # -D / --dev records it as a devDependency
```

Without `--bundle`, `siz add` favorites the packages instead (see [Favorites](#favorites)).

Then manage and install bundles:

```bash
siz bundle list                 # saved bundles, most-recently-used first
siz bundle show my-stack        # the bundle's full contents
siz bundle install my-stack     # resolve fresh versions and install
siz bundle rename my-stack web  # rename
siz bundle rm my-stack          # delete (after confirmation)
```

`siz bundle install` resolves each package's **latest** version fresh from npm (never snapshotted), applies its recorded version strategy (caret `^` / tilde `~` / exact / `latest`), lets you multi-select which to install, and prompts for a package manager. Mixed dependency types install as separate commands; peer and optional dependencies install as regular dependencies. Bundles are saved in the local data store and migrate non-destructively (schema v2).

## Commands

| Command                                               | Description                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `siz` / `siz <query>`                                 | Open the live search box, searching by name                                |
| `siz search <query>`                                  | Full-text search, including package descriptions                           |
| `siz add <pkg...>`                                    | Favorite package(s); resolves version and suggests a category              |
| `siz add <pkg...> --bundle <name>`                    | Record packages into a bundle instead of favoriting (`-D` / `--dev` for devDependencies) |
| `siz bundle <list \| install \| show \| rm \| rename>` | Manage preset bundles (e.g. `siz bundle install my-stack`)                 |
| `siz upgrade [level]` / `siz up`                      | Upgrade this project's dependencies (`major` \| `minor` \| `patch` \| `latest`) |
| `siz list` / `siz ls`                                 | List favorited packages                                                    |
| `siz rm <pkg>`                                        | Remove a favorite                                                          |
| `siz help` / `siz --help`                             | Show help                                                                  |
| `siz version` / `siz --version`                       | Show the installed version                                                 |

`siz list` filters:

```bash
siz list --category Testing    # by category
```

### Categories

Siz ships with a starter set of categories and auto-suggests one when you add a package, based on its name, description, and keywords:

`Frontend` · `Backend` · `Build Tools` · `Testing` · `Database` · `State Management` · `UI` · `DevTools` · `CLI Tools`

### Favorites

Favorite the packages you reach for often with `siz add <pkg>`, or with the **Favorite** action after a search. They show up in `siz list` (alphabetically), and pressing **Enter** on an empty search box opens them as the front door. Remove one with `siz rm <pkg>`.

## Library usage

Siz also exposes its core as a library:

```ts
import {
  searchPackages,
  listFavorites,
  addFavorite,
  suggestCategory,
  detectPM,
  buildInstallCommand,
  formatCommand,
} from '@sakana-y/siz'

const results = await searchPackages('graphql client')
addFavorite({ name: 'urql', category: suggestCategory({ name: 'urql' }) })

// Build the right install command for the current project's package manager.
const agent = await detectPM()
console.log(formatCommand(buildInstallCommand(agent, ['urql'], { dev: false })))
```

## License

[MIT](./LICENSE)
