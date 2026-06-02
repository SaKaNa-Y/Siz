# Siz

> **Si**mpler package **z**earch — a smarter npm package search and management CLI.

Siz is a command-line tool for discovering, installing, and organizing npm packages. Open a live search box, multi-select what you need, then install it with your detected package manager — or favorite, tag, and track packages for later. Everything you organize is stored locally and stays safe across upgrades.

Inspired by [`@rizumu/nai`](https://github.com/LittleSound/nai): Siz keeps nai's interactive search-and-install flow, and adds a discovery and organization layer (favorites, tags, categories, a tracked list) around it.

## Features

A check mark means the feature ships today; an empty box means it is planned.

- [x] Live interactive npm search with type-as-you-go multi-select
- [x] Full-text search across name and description (`siz search`)
- [x] GitHub-style qualifiers in queries (`keyword:` `author:` `scope:` `category:` `tag:`)
- [x] Install via auto-detected package manager (npm / pnpm / yarn / bun), with dependencies vs devDependencies prompt
- [x] Favorite, tag, categorize, and track packages in a local list
- [x] Heuristic auto-categorization when you add a package
- [x] Upgrade project dependencies with ceiling semantics and `--dry-run`
- [x] Safe local data store (user config dir, non-destructive migrations, atomic writes)
- [x] Library API for programmatic use
- [ ] Preset bundles — named groups of packages to install together
- [ ] Dependency rules — project-local, committable allow/restrict config
- [ ] Catalog support — pnpm/yarn catalog management during install
- [ ] AI-assisted search — opt-in LLM query expansion and result reranking
- [ ] Team-shared presets
- [ ] Monorepo support — workspace-aware tracking, install, and recursive upgrades
- [ ] VSCode extension and web dashboard
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

# Seed the search box with a query
siz react form validation

# Full-text search, including package descriptions
siz search state management

# Track packages you already use
siz add lodash zod vitest

# Organize them
siz fav zod
siz tag zod lightweight production
siz list --fav

# Upgrade this project's dependencies
siz upgrade minor
```

## Search and act

Run `siz` with no arguments to open a live search box. As you type, Siz queries the official npm registry (`registry.npmjs.org`) — no API key required:

- `siz` and `siz <query>` search by package **name**.
- `siz search <query>` runs a **full-text** search that also matches package **descriptions**.

```bash
siz                          # empty box, name search
siz fast node logger         # box seeded with "fast node logger"
siz search "state management"  # full-text search
```

Inside the box:

| Key       | Action                                     |
| --------- | ------------------------------------------ |
| _type_    | Search npm live (debounced)                |
| `↑` / `↓` | Move between results                       |
| `Tab`     | Select / deselect a package (multi-select) |
| `Enter`   | Confirm your selection                     |
| `Ctrl+O`  | Open the focused package on npmjs.com      |

After you confirm a selection, Siz shows an action menu for the chosen packages:

- **Install** — detects your package manager (npm / pnpm / yarn / bun via [`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector)), asks dependencies vs devDependencies, shows the exact command for confirmation, then runs it. Offers to track the packages afterwards.
- **Favorite**, **Track**, **Add tags** — add the packages to your local list.
- **Show install command** — print the command without running anything.

Pressing **Enter** on an empty box (nothing typed) opens your tracked list instead, so your curated packages are the front door — select any and run the same action menu.

### Non-interactive output

For scripting or piping, pass a query with a flag:

| Flag             | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `--list`         | Print matching results as text and exit (requires a query) |
| `--json`         | Print raw JSON results and exit (requires a query)         |
| `-n, --size <n>` | Number of results to fetch (default 20)                    |

```bash
siz fast node logger --list
siz zod --json
siz search "state management" --list
```

## Upgrade dependencies

`siz upgrade` reads the current project's `package.json`, checks the npm registry for newer versions, and walks you through bumping them — pick which packages to update, choose your package manager, and Siz rewrites the version ranges in place (preserving your `^`/`~`/exact style and the file's formatting), then runs the install.

```bash
siz upgrade            # offer the latest of everything
siz upgrade minor      # cap upgrades at the same major
siz upgrade patch      # cap at the same major.minor
siz upgrade --dry-run  # preview the changes without writing or installing
```

Levels use **ceiling** semantics (like [`taze`](https://github.com/antfu-collective/taze)): `minor` lifts each package to the newest version within its current major, `patch` to the newest within its current major.minor, and bare `upgrade` / `major` / `latest` to the absolute newest. Pre-1.0 `0.x` versions are treated as breaking, so `minor`/`patch` never cross a `0.x` boundary.

Specifiers that aren't plain registry ranges — `workspace:`, `catalog:`, npm aliases, git/file/link sources — and packages not found on the registry are skipped and left untouched.

## Commands

| Command                                               | Description                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `siz` / `siz <query>`                                 | Open the live search box, searching by name                                |
| `siz search <query>`                                  | Full-text search, including package descriptions                           |
| `siz add <pkg...>`                                    | Track package(s) manually; resolves version and suggests a category        |
| `siz upgrade [level]` / `siz up`                      | Upgrade this project's dependencies (`major` \| `minor` \| `patch` \| `latest`) |
| `siz list` / `siz ls`                                 | List tracked packages                                                      |
| `siz fav <pkg>` / `siz unfav <pkg>`                   | Toggle favorite                                                            |
| `siz tag <pkg> <tag...>` / `siz untag <pkg> <tag...>` | Manage custom tags                                                         |
| `siz rm <pkg>`                                        | Untrack a package                                                          |
| `siz help` / `siz --help`                             | Show help                                                                  |
| `siz version` / `siz --version`                       | Show the installed version                                                 |

`siz list` filters:

```bash
siz list --fav                 # favorites only
siz list --tag lightweight     # by tag
siz list --category Testing    # by category
```

### Categories

Siz ships with a starter set of categories and auto-suggests one when you add a package, based on its name, description, and keywords:

`Frontend` · `Backend` · `Build Tools` · `Testing` · `Database` · `State Management` · `UI` · `DevTools` · `CLI Tools`

### Tags and favorites

Tags are free-form — define whatever you like (`favorite`, `frequently-used`, `lightweight`, `production`, `experimental`, and so on). Favorites are surfaced first in `siz list` and marked accordingly.

## Data storage

All of your favorites, tags, and tracked packages are stored in a single JSON file in your user config directory — outside the installed package:

- **Linux / macOS:** `$XDG_CONFIG_HOME/siz/data.json` (defaults to `~/.config/siz/data.json`)
- **Windows:** `%APPDATA%\siz\data.json`

Because this file lives in your home directory, updating or reinstalling Siz never touches it. The file also carries a schema `version`, and Siz applies non-destructive migrations on load: new versions only add fields and never drop your packages, favorites, tags, or any unknown keys. Writes are atomic (temp file plus rename) to avoid corruption.

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

## License

[MIT](./LICENSE)
