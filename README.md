# Siz

> **Si**mpler package **z**earch — a smarter npm package search and management CLI.

Siz is a command-line tool for discovering, installing, and organizing npm packages. Open a live search box, multi-select what you need, then install it with your package manager of choice — or favorite and track packages for later. Everything you organize is stored locally and stays safe across upgrades.

Inspired by [`@rizumu/nai`](https://github.com/LittleSound/nai): Siz keeps nai's interactive search-and-install flow, and adds a discovery and organization layer (favorites, categories, a tracked list) around it. It also borrows ideas from antfu's [`ni`](https://github.com/antfu-collective/ni) (package-manager detection and a unified install experience) and [`taze`](https://github.com/antfu-collective/taze) (ceiling-based dependency upgrades).

## Features

A check mark means the feature ships today; an empty box means it is planned.

- [x] Live interactive npm search with type-as-you-go multi-select
- [x] Full-text search across name and description (`siz search`)
- [x] GitHub-style qualifiers in queries (`keyword:` `author:` `scope:` `category:` `tag:`)
- [x] Install via your package manager (npm / pnpm / yarn / bun / deno) — pick it at install time, with a per-package dependency vs devDependency toggle
- [x] Favorite, categorize, and track packages in a local list
- [x] Heuristic auto-categorization when you add a package
- [x] Upgrade project dependencies with ceiling semantics and `--dry-run`
- [x] Safe local data store (user config dir, non-destructive migrations, atomic writes)
- [x] Preset bundles — named groups of packages you can install together in one step
- [x] Library API for programmatic use
- [ ] Dependency rules — project-local, committable allow/restrict config
- [ ] Catalog support — pnpm/yarn catalog management during install
- [ ] AI-assisted search — opt-in LLM query expansion and result reranking
- [ ] Team-shared presets
- [ ] Monorepo support — workspace-aware tracking, install, and recursive upgrades
- [ ] Package analytics and usage statistics
- [ ] Dependency health checks (outdated / deprecated / vulnerable)
- [ ] Smart replacement suggestions for lighter or better-maintained alternatives
- [ ] Local search and install history

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

# Track packages you already use
siz add lodash zod vitest

# Group packages into a reusable bundle, then install it anywhere
siz add react vue --bundle my-stack
siz bundle install my-stack

# Organize them
siz fav zod
siz list --fav

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

- **Install** — detects your package manager (npm / pnpm / yarn / bun / deno via [`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector), part of the [`ni`](https://github.com/antfu-collective/ni) project) and lets you confirm or switch it at install time. Each package carries a `[dep]` / `[dev]` badge you flip with `Ctrl+T` in the search box; mixed selections run as separate `add` / `add -D` commands. Siz shows the exact command(s) for confirmation, then runs them, and offers to track the packages afterwards. In a monorepo — when more than one `package.json` is found under the current directory (skipping `node_modules`, `dist`, and `.git`) — Siz first asks **which package to install into** and runs the package manager in that package's directory, so the dependency lands in the right workspace. With a single `package.json`, there's no extra prompt.
- **Favorite**, **Track** — add the packages to your local list.
- **Add to bundle** — save the selection to a reusable bundle.

Pressing **Enter** on an empty box (nothing typed) opens your tracked list instead, so your curated packages are the front door — select any and run the same action menu.

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

In a monorepo, `-r` / `--recursive` discovers every `package.json` under the current directory (skipping `node_modules`, `dist`, and `.git`) and offers all of their updates in one list, each row tagged with its package. Each dependency is resolved independently per package, the manifests are rewritten in place, and a single install runs at the root. Without `-r`, `siz upgrade` only touches the nearest `package.json`.

Specifiers that aren't plain registry ranges — `workspace:`, `catalog:`, npm aliases, git/file/link sources — and packages not found on the registry are skipped and left untouched.

## Bundles

A **bundle** is a reusable, named collection of packages you can install in one step — handy for the stack you reach for on every new project.

Record packages into a bundle as you track them:

```bash
# Add packages straight into a bundle (created if it doesn't exist)
siz add react react-dom --bundle my-stack
siz add vitest --bundle my-stack -D     # -D / --dev records it as a devDependency
```

Without `--bundle`, `siz add` offers an interactive "Add to a bundle?" picker on a TTY, so you can skip, create a new bundle, or pick an existing one.

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
| `siz add <pkg...>`                                    | Track package(s) manually; resolves version and suggests a category        |
| `siz add <pkg...> --bundle <name>`                    | Track and record packages into a bundle (`-D` / `--dev` for devDependencies) |
| `siz bundle <list \| install \| show \| rm \| rename>` | Manage preset bundles (e.g. `siz bundle install my-stack`)                 |
| `siz upgrade [level]` / `siz up`                      | Upgrade this project's dependencies (`major` \| `minor` \| `patch` \| `latest`) |
| `siz list` / `siz ls`                                 | List tracked packages                                                      |
| `siz fav <pkg>` / `siz unfav <pkg>`                   | Toggle favorite                                                            |
| `siz rm <pkg>`                                        | Untrack a package                                                          |
| `siz help` / `siz --help`                             | Show help                                                                  |
| `siz version` / `siz --version`                       | Show the installed version                                                 |

`siz list` filters:

```bash
siz list --fav                 # favorites only
siz list --category Testing    # by category
```

### Categories

Siz ships with a starter set of categories and auto-suggests one when you add a package, based on its name, description, and keywords:

`Frontend` · `Backend` · `Build Tools` · `Testing` · `Database` · `State Management` · `UI` · `DevTools` · `CLI Tools`

### Favorites

Mark packages you reach for often with `siz fav`. Favorites are surfaced first in `siz list` and marked accordingly.

## Data storage

All of your favorites and tracked packages are stored in a single JSON file in your user config directory — outside the installed package:

- **Linux / macOS:** `$XDG_CONFIG_HOME/siz/data.json` (defaults to `~/.config/siz/data.json`)
- **Windows:** `%APPDATA%\siz\data.json`

Because this file lives in your home directory, updating or reinstalling Siz never touches it. The file also carries a schema `version`, and Siz applies non-destructive migrations on load: new versions only add fields and never drop your packages, favorites, or any unknown keys. Writes are atomic (temp file plus rename) to avoid corruption.

You can safely run `npm i -g @sakana-y/siz@latest` — your data stays put.

## Library usage

Siz also exposes its core as a library:

```ts
import {
  searchPackages,
  listPackages,
  trackPackage,
  suggestCategory,
  detectPM,
  buildInstallCommand,
  formatCommand,
} from '@sakana-y/siz'

const results = await searchPackages('graphql client')
trackPackage({ name: 'urql', category: suggestCategory({ name: 'urql' }) })

// Build the right install command for the current project's package manager.
const agent = await detectPM()
console.log(formatCommand(buildInstallCommand(agent, ['urql'], { dev: false })))
```

## Future plans

Monorepo support is being built out incrementally. `siz upgrade -r` already upgrades every `package.json` in a workspace; still on the roadmap:

- **pnpm catalogs** — upgrade versions declared once under `catalog:` / `catalogs:` in `pnpm-workspace.yaml`, with format-preserving edits, and resolve `catalog:` references accordingly. (Yarn and Bun catalogs to follow.)
- **Fuller workspace awareness** — honor declared workspace globs, guard against clobbering nested independent workspaces (Taze's `--ignore-other-workspaces`), and reach `pnpm.overrides` / `resolutions`.

## License

[MIT](./LICENSE)
