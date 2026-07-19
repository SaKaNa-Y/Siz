# Siz

> **Si**mpler package **z**earch — a smarter npm package search and management CLI.

> [!IMPORTANT] 
> Refactoring may be performed from time to time.

Siz is a command-line tool for discovering, installing, and organizing npm packages. Open a live search box, multi-select what you need, then install it with your package manager of choice — or favorite packages for later. Everything you organize is stored locally and stays safe across upgrades.

Inspired by [`@rizumu/nai`](https://github.com/LittleSound/nai): Siz keeps nai's interactive search-and-install flow, and adds a discovery and organization layer (favorites and categories) around it. It also borrows ideas from antfu's [`ni`](https://github.com/antfu-collective/ni) (package-manager detection and a unified install experience) and [`taze`](https://github.com/antfu-collective/taze) (ceiling-based dependency upgrades).

## Features

A check mark means the feature ships today; an empty box is planned, tagged **Next** (actively planned), **Later** (committed, unscheduled), or **Maybe** (exploratory).

Siz is a unified package-management workflow layer: an interactive interface over your package manager (in the spirit of [`ni`](https://github.com/antfu-collective/ni)) plus [`taze`](https://github.com/antfu-collective/taze)-style dependency upgrades. It spans three complementary layers of one experience — **Discover** what to use, **Organize** what you keep, **Manage** what's installed — and is **interactive by default and scriptable today** (via `--json` / `--list` and direct `add` / `rm`), with full `--yes` coverage of every mutating command on the way. It builds on antfu's [`package-manager-detector`](https://github.com/antfu-collective/package-manager-detector) (part of the `ni` project) and borrows `taze`'s ceiling-based upgrade semantics.

### Discover

- [x] Live interactive npm search with type-as-you-go multi-select
- [x] Full-text search across name and description (`siz search`)
- [x] GitHub-style qualifiers in queries (`keyword:` `author:` `scope:` `category:` `tag:`)
- [x] Trust-aware discovery: deprecation, publish age, and provenance shown inline on each result, before install
- [x] Download-trend signal — `↑`/`↓` download-count momentum inline on each result (scoped packages excepted)
- [x] Replacement suggestions for deprecated packages — `→ replaced by …`, parsed from the deprecation message (the successor the maintainer named)
- [x] Package-size signal — install size shown inline on every result (and bundle size on the focused row), before install
- [ ] **Later** — License signal — the package's license shown inline (a legal/compatibility fact, distinct from the health-oriented trust signals)
- [ ] **Later** — Ships-types signal — flag whether a package bundles its own TypeScript types or needs a separate `@types/*`
- [ ] **Later** — Lighter-alternative suggestions for heavy packages — a curated map of leaner swaps (e.g. `moment` → `dayjs`), leaning on the package-size signal
- [ ] **Later** — AI-assisted search: opt-in LLM query expansion and result reranking
- [ ] **Maybe** — Comparison view — mark 2–3 packages in interactive search and compare them side by side (downloads, size, last publish, license)

### Organize

- [x] Favorites — a lightweight curated shortlist of packages you reach for, and the empty-box front door
- [x] Heuristic auto-categorization when you favorite a package
- [x] Bundles — named recipes that record versions, dep types, and preferred PM, installable together in one step
- [x] Peer/optional bundle install — a bundle's peer/optional deps install as their true type via the manager's save flag (npm / pnpm / yarn / bun; deno falls back to a regular dependency)
- [ ] **Later** — Export / import favorites & bundles — shareable JSON, the concrete basis for team-shared presets
- [ ] **Later** — Local search and install history
- [ ] **Maybe** — Seed a bundle from the current project — snapshot the current `package.json` deps into a named bundle
- [ ] **Maybe** — Team-shared presets — built on export / import

### Manage

**Install & run**

- [x] Install via your package manager (npm / pnpm / yarn / bun / deno) — pick it at install time, with a per-package dependency vs devDependency toggle
- [x] Direct project install / uninstall by name — `siz add <pkg>` installs, `siz rm <pkg>` uninstalls; favoriting moves to `--fav`
- [ ] **Next** — Non-interactive mode — `--yes` on every mutating command, for CI and scripts
- [ ] **Later** — Interactive uninstall picker — `siz rm` with no args opens a picker over installed deps, making removal as interactive as install
- [ ] **Later** — Run scripts — `siz run <script>` through the detected package manager
- [ ] **Later** — Execute without installing — `siz x <pkg>` (npx / pnpm dlx / bunx)
- [ ] **Later** — Clean / frozen install — lockfile-exact, reproducible installs (npm-ci style)

**Upgrade & maintain**

- [x] Upgrade project dependencies with ceiling semantics and `--dry-run`
- [x] pnpm catalog upgrades — bump `catalog:` / `catalogs:` versions in `pnpm-workspace.yaml`
- [x] Monorepo install & recursive upgrades — workspace picker on install, `siz upgrade -r`
- [x] Workspace-aware discovery — honor declared `packages:` / `workspaces` globs, skip stray manifests
- [x] Outdated report — `siz outdated`, read-only and non-interactive (`--json` for CI, `--exit-code` to gate); shares the version-fetch and comparison core with `siz upgrade`
- [ ] **Next** — Upgrade filters — `--include` / `--exclude` name globs to scope which dependencies are considered before the list renders (`taze` parity)
- [ ] **Later** — Per-package upgrade modes — pin a package to a fixed level (e.g. always minor) regardless of the global level
- [ ] **Later** — Trust signals in the outdated report — surface deprecated/stale flags alongside version drift
- [ ] **Later** — `siz why <pkg>` — explain why a dependency is present / who pulled it in

**Govern**

- [x] Dependency rules — project-local, committable allow/deny config that gates installs
- [ ] **Later** — `siz check` audit — report dependency-rule violations across existing `package.json`(s); CI-enforceable, reuses the rules engine
- [ ] **Later** — Catalog management during install — `ni`-style `catalog:` writing
- [ ] **Later** — Yarn & Bun catalog upgrades — extend catalog upgrades beyond pnpm
- [ ] **Later** — Nested-workspace guard & root pins — `--ignore-other-workspaces`, `pnpm.overrides` / `resolutions`
- [ ] **Maybe** — License policy rules — allow/deny by license, extending the dependency-rules engine (makes the guardrail metadata-fetch dependent — today it is pure name-matching)
- [ ] **Maybe** — Vulnerability scan — npm-audit parity; exits non-zero in CI

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

# Install packages into the current project (delegates to your package manager)
siz add lodash zod
siz add vitest -D          # as a devDependency
siz add react@18          # a specific version

# Uninstall
siz rm lodash

# Favorite packages you reach for (--fav), then browse them
siz add zod vitest --fav
siz list
siz list --category Testing

# Group packages into a reusable bundle, then install it anywhere
siz add react vue --bundle my-stack
siz bundle install my-stack

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

The glyphs show on every row so you can compare at a glance; the focused row expands them to words (e.g. `deprecated: no longer maintained · published 4y ago`). When a deprecation message names a successor, that focused detail (and `--list`/`--json`) also surfaces it as `→ replaced by <pkg>` — parsed straight from the message, so it reflects what the maintainer pointed to, not a recommendation siz invents (a deprecated package whose message names no successor simply shows none). `--json` adds a `replacedBy` array per result. Signals are purely informational — they never block, filter, or reorder results. They load progressively (the list never waits on them) and degrade silently if the metadata service (`fast-npm-meta`, see [Data sources & network](#data-sources--network)) is unreachable. The `--list` and `--json` outputs include them too (`--json` adds `deprecated`, `publishedAt`, and `provenance` fields per result).

### Size signals

To help you weigh how *heavy* a package is before adding it, Siz also shows its size inline — a **size signal**, distinct from the health-oriented trust signals above (it's about weight, not maintenance). Two numbers, from two sources:

- **Install size** — the package's own unpacked-on-disk size (npm's `dist.unpackedSize`, excluding dependencies). Shown on **every** result row. A package past a "heavy" threshold (~1 MB) also gets a `■` glyph, so bulky packages stand out at a glance.
- **Bundle size** — the minified + gzipped browser-ship weight, **including** transitive dependencies, from [Bundlephobia](https://bundlephobia.com). Because it's slower and rate-limited, it's fetched **only for the focused row** and shown in that row's expanded detail (e.g. `1.4 MB install · 72 kB gz`).

Like trust signals, sizes load progressively, never block the list, and degrade silently if a source is unreachable. The `--list` and `--json` outputs include the install size (`--json` adds an `installSize` field, in bytes, per result); bundle size is interactive-only, so scripting and CI stay fast and off Bundlephobia's rate limit. See [ADR 0008](./docs/adr/0008-package-size-data-sources.md).

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

## Outdated report

`siz outdated` is the **read-only, non-interactive** counterpart to `siz upgrade`: it reports which dependencies are behind the registry and **never writes or installs anything**. Both commands specialize one shared registry-comparison core (and the same workspace- and catalog-aware discovery), so `outdated` covers exactly what `siz upgrade` could act on.

```bash
siz outdated              # Current / Wanted / Latest table for the nearest package.json
siz outdated -r           # recurse into every workspace member (and catalog entries)
siz outdated --json       # emit { outdated, skipped, summary } for CI/scripting
siz outdated --exit-code  # exit 1 when anything is outdated (a CI gate)
```

Each row shows three versions: **Current** — the floor of your declared range (the lowest version it allows, *not* the installed version, so the report works on a fresh checkout before `install`); **Wanted** — the highest version still satisfying that range; and **Latest** — the registry's `latest` dist-tag, tinted by how big the jump is (major/minor/patch). A dependency is "outdated" whenever Latest is ahead of Current.

`--json` prints a single object — `{ outdated: [...], skipped: [...], summary: { total, upToDate, skipped } }` — to stdout only, so `siz outdated --json | jq '.summary.total'` is a clean gate. Non-registry, unparseable, and not-found specifiers don't appear in the table but are counted in the summary and listed under `skipped`. Exit status is `0` by default (even when deps are outdated); pass `--exit-code` to make a stale tree fail the build.

## Dependency rules

Drop a committable `siz.config.json` at your repo root to declare which packages may be installed. Siz reads it and **blocks disallowed packages at install time** — both the interactive **Install** action and `siz bundle install`.

```jsonc
{
  "$schema": "https://json.schemastore.org/...", // optional, ignored by siz
  "rules": {
    "allow": ["@ourorg/*", "react", "react-dom"],
    "deny": ["lodash", "*-deprecated", "@ourorg/legacy-*"]
  }
}
```

Both lists are **glob patterns matched against the package name**: `*` matches any run of characters (slash-agnostic), so `lodash` is an exact match, `@ourorg/*` covers a whole scope, and `*-deprecated` is a suffix match.

- **`allow` empty/omitted** → *denylist mode*: everything is permitted except what matches `deny`.
- **`allow` non-empty** → *allowlist mode*: a package is permitted only if it matches `allow`.
- **`deny` always wins.** A package matching both is blocked — so `allow: ["@ourorg/*"]` with `deny: ["@ourorg/legacy-*"]` admits your scope but still blocks the legacy packages.

Formally: `permitted = (allow empty OR name matches allow) AND NOT (name matches deny)`.

When you install a selection, denied packages are dropped with a notice naming each one and the rule that blocked it; the allowed remainder proceeds. If **every** selected package is blocked, the action aborts with a non-zero exit. The config is loaded from the nearest `siz.config.json` walking up from the current directory — a single root file governs the whole repo, including every workspace.

```bash
siz --no-rules                    # bypass rules for a deliberate one-off (prints a loud notice)
siz bundle install my-stack --no-rules
```

Behavior at the edges: **no `siz.config.json` → no restrictions** (rules are opt-in); a **malformed `siz.config.json` → siz aborts with a parse error** rather than silently letting everything through (a broken policy must fail closed). Rules gate what you *add* through siz; reporting violations in dependencies you *already have* is the job of the planned `siz check` audit.

## Install & uninstall

`siz add <pkg>` installs packages into the current project, and `siz rm <pkg>` uninstalls them — both delegate to your detected package manager (npm / pnpm / yarn / bun / deno). They run directly, in the spirit of [`ni`](https://github.com/antfu-collective/ni): siz detects the manager and runs, echoing the exact command — no extra prompts unless a monorepo makes the target ambiguous.

```bash
siz add zod                 # <pm> add zod
siz add vitest -D           # as a devDependency
siz add react@18            # a version, dist-tag, or scoped spec flows through to the PM
siz add react vue           # multiple at once
siz rm lodash left-pad      # uninstall (multiple at once)
```

In a **monorepo** — when more than one `package.json` is found under the current directory — siz first asks **which package to install into** (or remove from) and runs the manager in that workspace's directory. With a single `package.json`, there's no extra prompt; with none, the manager runs in the current directory (creating one as it normally would).

Installs honor the [dependency rules](#dependency-rules) guardrail: a denied package is dropped with a notice, and if every package is blocked the command aborts non-zero. Pass `--no-rules` to bypass. Uninstall is never gated — removing a package can't violate a policy about what may enter the project — and it's orthogonal to favorites: `siz rm react` uninstalls but leaves the favorite; `siz rm react --fav` removes the favorite without uninstalling.

`siz add` has three mutually exclusive modes — plain (install), `--fav` (favorite, see [Favorites](#favorites)), and `--bundle <name>` (record into a bundle, see [Bundles](#bundles)).

## Bundles

A **bundle** is a reusable, named collection of packages you can install in one step — handy for the stack you reach for on every new project.

Record packages straight into a bundle with `--bundle` (this records into the bundle rather than installing):

```bash
# Add packages straight into a bundle (created if it doesn't exist)
siz add react react-dom --bundle my-stack
siz add vitest --bundle my-stack -D     # -D / --dev records it as a devDependency
```

Without `--bundle` or `--fav`, `siz add` installs the packages into the current project instead (see [Install & uninstall](#install--uninstall)).

Then manage and install bundles:

```bash
siz bundle list                 # saved bundles, most-recently-used first
siz bundle show my-stack        # the bundle's full contents
siz bundle install my-stack     # resolve fresh versions and install
siz bundle rename my-stack web  # rename
siz bundle rm my-stack          # delete (after confirmation)
```

`siz bundle install` resolves each package's **latest** version fresh from npm (never snapshotted), applies its recorded version strategy (caret `^` / tilde `~` / exact / `latest`), lets you multi-select which to install, and prompts for a package manager. Each dependency type installs as its own command with the manager's save flag — regular, dev (`-D`), peer (`--save-peer` / `--peer`), and optional (`--save-optional` / `--optional`) — so packages land in the right `package.json` bucket. Deno, which has no peer/optional concept, installs those as regular dependencies (with a notice). Bundles are saved in the local data store and migrate non-destructively (schema v2).

## Commands

| Command                                               | Description                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `siz` / `siz <query>`                                 | Open the live search box, searching by name                                |
| `siz search <query>`                                  | Full-text search, including package descriptions                           |
| `siz add <pkg...>`                                    | Install package(s) into the project (`-D` / `--dev` for devDependencies, `--no-rules` to bypass rules) |
| `siz add <pkg...> --fav`                              | Favorite package(s) instead of installing; resolves version, suggests a category |
| `siz add <pkg...> --bundle <name>`                    | Record packages into a bundle instead of installing (`-D` / `--dev` for devDependencies) |
| `siz rm <pkg...>`                                     | Uninstall package(s) from the project (`--fav` to remove a favorite instead) |
| `siz bundle <list \| install \| show \| rm \| rename>` | Manage preset bundles (e.g. `siz bundle install my-stack`)                 |
| `siz upgrade [level]` / `siz up`                      | Upgrade this project's dependencies (`major` \| `minor` \| `patch` \| `latest`) |
| `siz outdated`                                        | Read-only report of outdated dependencies (`--json` for CI, `--exit-code` to gate) |
| `siz list` / `siz ls`                                 | List favorited packages                                                    |
| `siz help` / `siz --help`                             | Show help                                                                  |
| `siz version` / `siz --version`                       | Show the installed version                                                 |

`siz list` filters:

```bash
siz list --category Testing    # by category
```

### Categories

Siz ships with a starter set of categories and auto-suggests one when you favorite a package, based on its name, description, and keywords:

`Frontend` · `Backend` · `Build Tools` · `Testing` · `Database` · `State Management` · `UI` · `DevTools` · `CLI Tools`

### Favorites

Favorite the packages you reach for often with `siz add <pkg> --fav`, or with the **Favorite** action after a search. They show up in `siz list` (alphabetically), and pressing **Enter** on an empty search box opens them as the front door. Remove one with `siz rm <pkg> --fav`. Favorites are name-only, so a version in the spec (`siz add react@18 --fav`) is ignored.

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

## Data sources & network

Siz talks to a few different services depending on what you're doing:

| Feature | Endpoint | Provider |
| ------- | -------- | -------- |
| Package search (interactive, `search`, `--list`, `--json`) | `registry.npmjs.org/-/v1/search` | Official npm registry |
| Trust signals (deprecation, publish age, provenance) | `npm.antfu.dev` (via [`fast-npm-meta`](https://github.com/antfu/fast-npm-meta)) | Third-party hosted aggregator |
| Upgrade version resolution (`siz upgrade`) | `npm.antfu.dev` (via `fast-npm-meta`) | Third-party hosted aggregator |
| Outdated report (`siz outdated`) | `npm.antfu.dev` (via `fast-npm-meta`) | Third-party hosted aggregator |
| Bundle latest-version resolution (`bundle install`) | `npm.antfu.dev` (via `fast-npm-meta`) | Third-party hosted aggregator |
| Download-trend momentum (`↑`/`↓`) | `api.npmjs.org/downloads` | Official npm download-counts API |
| Install size (size signal, every result) | `registry.npmjs.org/<pkg>` (packument) | Official npm registry |
| Bundle size (size signal, focused row only) | `bundlephobia.com/api/size` | Third-party hosted service |

Trust signals, upgrades, and bundle resolution go through **`fast-npm-meta`**, whose default API endpoint is **`https://npm.antfu.dev/`** — a third-party service (maintained by [antfu](https://github.com/antfu)) that mirrors and aggregates the npm registry so this data can be fetched in a single batched request. These calls **degrade silently** if the service is unreachable (trust glyphs simply don't appear; upgrades/bundles surface the failure). Note that `fast-npm-meta` cannot be pointed at the raw `registry.npmjs.org` — it speaks its own aggregation protocol — so removing this dependency would require self-hosting that API or reimplementing the fetches. Package search, download-trend momentum, and **install size** (the packument's `dist.unpackedSize`) use **official npm endpoints** directly. **Bundle size** is the one signal from another third party, [Bundlephobia](https://bundlephobia.com) — fetched only for the focused search row and degrading silently like the rest. See [ADR 0003](./docs/adr/0003-fast-npm-meta-hosted-endpoint.md) and [ADR 0008](./docs/adr/0008-package-size-data-sources.md) for the rationale.

## License

[MIT](./LICENSE)
