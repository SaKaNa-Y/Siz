# Siz

> **Si**mpler package **z**earch — a smarter npm package search & management CLI ✨

Siz is a command-line tool for **discovering, installing, and organizing** npm packages. Open a live search box, multi-select what you need, then install it with your detected package manager — or favorite, tag, and track packages for later. Everything you organize is stored locally and safe across upgrades.

Inspired by [`@rizumu/nai`](https://github.com/LittleSound/nai): Siz keeps nai's interactive search-and-install flow, and adds a discovery/organization layer (favorites, tags, categories, a tracked list) around it.

## 📦 Install

```bash
npm i -g @sakana-y/siz
# or
pnpm add -g @sakana-y/siz
```

Requires Node.js >= 20.19.

## 🚀 Quick start

```bash
# Open the live search box (type to search, multi-select, then act)
siz

# Seed the search box with a query
siz react form validation

# Track packages you already use
siz add lodash zod vitest

# Organize them
siz fav zod
siz tag zod lightweight production
siz list --fav
```

## 🔍 Search & act (the main flow)

Run **`siz`** with no arguments to open a **live search box**. As you type, Siz queries the official npm registry (`registry.npmjs.org`) — which ranks results across **name, description, and keywords**, so natural-language queries work well, no API key required:

```
siz                          # empty box
siz fast node logger         # box seeded with "fast node logger"
```

Inside the box:

| Key       | Action                                     |
| --------- | ------------------------------------------ |
| _type_    | Search npm live (debounced)                |
| `↑` / `↓` | Move between results                       |
| `Tab`     | Select / deselect a package (multi-select) |
| `Enter`   | Confirm your selection                     |
| `Ctrl+O`  | Open the focused package on npmjs.com      |

After you confirm a selection, Siz shows an **action menu** for the chosen packages:

- ⬇ **Install** — detects your package manager (npm / pnpm / yarn / bun via [`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector)), asks **dependencies vs devDependencies**, shows the exact command for confirmation, then runs it. Offers to track them afterwards.
- ❤ **Favorite** · ＋ **Track** · 🏷 **Add tags** — add them to your local list (Siz's organizer features).
- ⧉ **Show install command** — print the command without running anything.

**Empty `Enter`** (nothing typed) opens your **tracked list** instead, so your curated packages are the front door — select any and run the same action menu.

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
```

## Commands

| Command                                               | Description                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `siz` / `siz <query>`                                 | Open the live search box (multi-select → install / favorite / track / tag) |
| `siz add <pkg...>`                                    | Track package(s) manually; resolves version + suggests a category          |
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

Siz ships with a starter set of categories and auto-suggests one when you add a package, based on its name/description/keywords:

`Frontend` · `Backend` · `Build Tools` · `Testing` · `Database` · `State Management` · `UI` · `DevTools` · `CLI Tools`

### Tags & favorites

Tags are free-form — define whatever you like (`favorite`, `frequently-used`, `lightweight`, `production`, `experimental`, …). Favorites are surfaced first in `siz list` and marked with ❤.

## 💾 Where your data lives (and why upgrades are safe)

All of your favorites, tags, and tracked packages are stored in a single JSON file in your **user config directory** — _outside_ the installed package:

- **Linux / macOS:** `$XDG_CONFIG_HOME/siz/data.json` (defaults to `~/.config/siz/data.json`)
- **Windows:** `%APPDATA%\siz\data.json`

Because this file lives in your home directory, **updating or reinstalling Siz never touches it**. On top of that, the file carries a schema `version`, and Siz applies **non-destructive migrations** on load: new versions only _add_ fields and _never_ drop your packages, favorites, tags, or any unknown keys. Writes are atomic (temp file + rename) to avoid corruption.

You can safely run `npm i -g @sakana-y/siz@latest` — your data stays put.

## 🛠 Library usage

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

## Roadmap — not yet implemented

Siz ships a focused **search → multi-select → install / organize** core. The following features from the original vision are **planned but not yet implemented**:

- **Preset installation commands** — define named bundles of packages (`siz preset create frontend-stack`, `siz preset install frontend-stack`).
- **Dependency rules** — project-local, committable config to allow/restrict packages, enforce `dependencies` vs `devDependencies`, and standardize choices across a team.
- **Catalog support** — pnpm/yarn catalog management during install (NAI-style).
- **AI-powered / smarter search** — optional, opt-in LLM query expansion and result reranking on top of the registry search (requires a user-supplied API key).
- **Team-shared presets** — share presets across a team or repo.
- **Monorepo support** — workspace-aware tracking and install.
- **VSCode extension** and **web dashboard**.
- **Package analytics & usage statistics** — track what you install/use most.
- **Dependency health checks** — surface outdated, deprecated, or vulnerable packages.
- **Smart replacement suggestions** — recommend lighter/maintained alternatives.
- **Local package history** — remember what you've searched and installed.

Contributions and ideas welcome.

## 📄 License

[MIT](./LICENSE)
