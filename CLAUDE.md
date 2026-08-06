This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`siz` is a CLI for searching, saving and installing npm packages. It ships both as a binary (`siz`) and as a library (importable from the package root). Package manager is **pnpm** (`pnpm@10.24.0`), Node `>=20.19.0`, ESM-only TypeScript.

## CLI (`siz -h`)

The command surface is defined entirely by the `cac` registrations in `src/cli.ts` — that file is the single source of truth. The top-level help (`siz -h`) currently renders as below; the `siz/<version>` line is dynamic (sourced from `package.json`), and per-command options (e.g. `siz add --help`) are listed only under that command's own help.

```
siz/0.3.0
Smarter npm package search & management CLI — search, save and install packages.

Usage:
  $ siz [...query]

Commands:
  [...query]                        Search npm packages (use qualifiers like keyword:cli)
  add <package> [...packages]       Install package(s) into the project (--bundle to record instead)
  bundle <action> [arg1] [...args]  Manage preset bundles
  upgrade [level]                   Upgrade project dependencies (level: major | minor | patch | latest)
  outdated                          Report outdated dependencies (read-only)
  list                              List saved packages across all bundles
  rm <package> [...packages]        Uninstall package(s) from the project
  help                              Show this help message
  version                           Show the installed version

Options:
  -n, --size <n>  Number of results to fetch (default: 20)
  --json          Output raw JSON results (requires a query)
  --list          Print results without the interactive box (requires a query)
  --no-rules      Bypass dependency rules in siz.config.json when installing (default: true)
  -h, --help      Display this message
  -v, --version   Display version number

Examples:
  $ siz react form validation
  $ siz "state management" --list
  $ siz add zod
  $ siz add vitest -D
  $ siz add react@18
  $ siz rm lodash
  $ siz add react vue --bundle my-stack
  $ siz bundle install my-stack
  $ siz upgrade minor
```

Per-command help lists the mode flags: `siz add --help` shows `-b/--bundle`, `-D/--dev`, `-s/--strategy`, `--no-rules`; `siz rm --help` has no mode flag; `siz list --help` shows `-b/--bundle`.

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

- bare `siz [query]` → `commands/interactive.ts` (or `commands/search.ts` for `--list` / `--json`, which now **require** a query — passing either without one throws instead of falling through to the box). There is one search: the registry's full-text results (name *and* description) re-ranked by name affinity. `search [query]` remains registered as a **hidden alias** of the same action for one minor release — filtered out of the top-level help by `HIDDEN_COMMANDS` in `cli.ts`, not advertised, and printing a deprecation notice on **stderr** so `--json` output stays pipeable
- `add <package…>` → `commands/add.ts`; a two-way, mutually-exclusive multiplexer. **Default: installs** the package(s) into the project via the shared `commands/install-runner.ts`. `-b/--bundle <name>` records into that bundle instead (an explicit `@version` pins the entry `exact`, else `-s/--strategy <latest|exact|caret|tilde>`, default `caret`; `-D/--dev` → devDependencies). `-D/--dev` also marks install-mode deps as dev; `--no-rules` bypasses the guardrail on install. Specs (`react@18`, `@scope/pkg@1.2.3`) are split by `core/pm.parseSpec()` so name-keyed logic uses the bare name while the version flows to the PM. Removed flags (currently just `--fav`) are caught in `commands/removed-flags.ts` before cac parses argv, so they error with the replacement flow rather than a bare "Unknown option"
- `bundle <action> [arg1] [...args]` → `commands/bundle.ts`; cac matches on the leading token, so one command dispatches on `action`: `list`/`ls`, `install <name>`, `show <name>`, `rm <name> [...packages]` (with package names it removes exactly those entries via `core/store.removeFromBundle()` — reporting names that weren't there and leaving an empty bundle behind rather than deleting it; with none it deletes the whole bundle behind the existing confirm), `rename <old> <new>`
- `list`/`ls` → `commands/list.ts`; prints the flat saved-entry list (`core/store.listSavedEntries()`, rendered by `ui/bundle-render.renderSavedEntryLine()`), with `-b/--bundle <name>` narrowing it to one bundle — the same data the empty-box front door opens; `rm <package…>` → `commands/remove.ts`; **uninstalls** the package(s) from the project (PM `remove`/`uninstall` via `core/pm.buildRemoveCommand()` — no rules, no confirm, monorepo target picker when ambiguous). There is no mode flag: curating saved packages is `siz bundle rm`
- `upgrade [level]` / `up` (alias) → `commands/upgrade.ts`; `level` is `major | minor | patch | latest` (validated in `cli.ts`, defaults to `latest`); `-r/--recursive` discovers every `package.json` under cwd (monorepo mode); `--dry-run` previews without writing or installing
- `outdated` → `commands/outdated.ts`; the read-only, non-interactive sibling of `upgrade` — reports Current/Wanted/Latest and **never writes or installs**. `-r/--recursive` (workspace-aware) and pnpm catalogs (always on) mirror `upgrade`'s scope; `--json` emits `{ outdated, skipped, summary }` to stdout for CI; `--exit-code` exits non-zero when anything is outdated (default exit `0`). `runOutdated()` returns the exit code, which `cli.ts` assigns to `process.exitCode`
- `help`, `version` — thin subcommands that reuse cac's built-in `outputHelp()` / `outputVersion()`; the version is sourced from `package.json` (imported), which also backs the `--version` flag

**Main data flow** (interactive search): `interactive.ts` calls `core/registry.searchPackages()`, which hits the npm registry, parses GitHub-style qualifiers via `core/query.ts`, and re-ranks (never filters) the results by name affinity (`rankByName`: term coverage first, then per-term exact → prefix → substring tiers, then an `fzf` subsequence tier, then the registry's own score, then its order). Results render through `ui/search-prompt.ts` (live multiselect) + `ui/render.ts`. After each result set settles, `interactive.ts` fires `core/trust.fetchTrustSignals()` in the background (progressive, non-blocking) and re-renders rows with inline **trust signals** — `⚠` deprecated · `⚑` stale (>2y) · `✓` provenance — glyphs on every row (`ui/render.trustGlyphs`) and expanded detail on the focused row (`trustDetail`); the same signals enrich `--list`/`--json` output. Two further **result-signal** families ride along the same progressive pattern: **size signals** (`core/size.fetchInstallSizes` eager for the windowed rows, `fetchBundleSize` lazy per focused row; `sizeInline`/`sizeDetail`) and the **license signal** (`core/license.fetchLicenses`; `licenseInline`/`licenseDetail`, `⚖` when the license can't be resolved from metadata). Install size, license, deprecation and provenance all derive from one memoized `core/packument.fetchManifests()` request per package, so among the trust signals only the publish age costs a separate (third-party) call. In the interactive box these eager fetches are **windowed**: `core/window.signalWindow()`/`windowNames()` (pure) pick the on-screen rows plus a prefetch margin, `interactive.ts` fires the fetches for those names only and widens the window from `onFocus` as the user scrolls, skipping names already requested (the packument/trust memos make a repeat free anyway). `--list`/`--json` print every result, so `commands/search.ts` does not window. `ui/render.signalLegend()` (not `trustLegend` — it covers all three families) renders the footer glyph legend. Selected packages flow into local state via `core/store.ts` mutators, and install commands are built by `core/pm.ts`. The **Install** action and the direct `siz add` command share `commands/install-runner.runInstallSelections()`, which applies the dependency guardrail via `commands/install-rules.applyInstallRules()` (→ `core/rules.loadRules()`/`partitionByRules()`; denied packages dropped with a `ui/render.formatBlockedNotice()`; all-blocked aborts non-zero; `--no-rules` bypasses), then calls `core/project.discoverManifests(cwd, { recursive: true })`; when more than one `package.json` is found it prompts via `ui/prompts.pickInstallTarget()` (label/order built by the pure `buildInstallTargetOptions()`) and runs `detectPM`/`runInstall` with `cwd` set to the chosen workspace directory (the cwd-into-dir approach — uniform across all PMs, including Bun). A single manifest installs in `process.cwd()`. The interactive path opts into a PM picker + confirm (`pickPM`/`confirm`); the direct `siz add` path runs ni-style (detect and run). `commands/bundle.runBundleInstall()` applies the same guardrail before building its install commands.

**Upgrade flow** (`siz upgrade`): `commands/upgrade.ts` discovers manifests via `core/project.discoverManifests()` — the nearest `package.json` by default, or (with `-r`) workspace-aware: when a workspace is declared (`loadWorkspaceGlobs()` reads pnpm's `packages:` or an npm/yarn `workspaces` field) only the declared members plus the root are scanned, otherwise it falls back to a Taze-style glob of every `package.json` under cwd (ignoring `node_modules`/`dist`/`.git`). It batch-fetches registry versions for the union of dep names (`collectQueryNames()` → `core/upgrade.fetchVersionInfo()`, `fast-npm-meta`), then `planManifests()` partitions each manifest's deps with `buildUpgradePlan()` under **ceiling** semantics (`patch`→newest within `major.minor`/`~`, `minor`→newest within `major`/`^`, `major`/`latest`→newest overall; `0.x` is treated as breaking, so `minor`/`patch` never cross a `0.x` boundary). Resolution is **independent per package** (Taze-style; no cross-package consensus). It also discovers the nearest `pnpm-workspace.yaml` (walking up, regardless of `-r`) via `core/catalog.discoverCatalog()` and plans each `catalog:` / `catalogs:` entry with `core/upgrade.planCatalog()` (reusing `analyzeDep`). The user multiselects from one flat list (package.json rows tagged with their dir when recursive; catalog rows tagged `catalog` / `catalog:<name>`) in a `@clack/prompts` flow; selections are grouped back by file — package.json rewritten via `core/project.applyRangeEdits()`, catalog entries via `core/catalog.applyCatalogEdits()` (format-preserving YAML edits, scoped by indentation) — each written atomically with `writeManifest()`, then a single `core/pm.buildSyncCommand()` / `runInstall()` runs at the root. Non-registry specifiers (`workspace:`, `catalog:`, npm aliases, git/file/link, URLs) and unparseable ranges are skipped, not touched — the `package.json` `catalog:` refs are left alone because the version is bumped in the catalog itself. Yarn/Bun catalogs and `pnpm.overrides` are not yet handled (see the README's **Features** roadmap).

**Outdated flow** (`siz outdated`): the read-only counterpart to upgrade. `commands/outdated.ts` reuses the same discovery (`discoverManifests` + `discoverCatalog`) and the same batched fetch (`collectQueryNames`/`collectCatalogNames` → `fetchVersionInfo`), then partitions with `core/outdated.planManifestsOutdated()` / `planCatalogOutdated()` (built on the pure `analyzeOutdated()` / `buildOutdatedReport()`). Each dep is reported as **Current** (range floor via `currentVersionFromRange`, *not* the installed version — see ADR 0004), **Wanted** (highest version satisfying the literal range via `maxSatisfying`), and **Latest** (dist-tag). Outdated ⇔ `latest > current`; there is **no level argument** — Wanted is intrinsic to each range. Because it never rewrites, it reports **complex** ranges too (which `upgrade` skips). Output is either an aligned table + summary (`ui/outdated-render.ts`) or `--json` (`{ outdated, skipped, summary }`, stdout-only); `--exit-code` makes it exit `1` when anything is outdated. It writes/installs nothing.

**Core modules** (`src/core/`):

- `registry.ts` — npm registry search + qualifier handling + `rankByName()` name-affinity re-ranking. There is no search *mode* and no client-side filtering: `rankByName` only reorders, so the result count always equals what the registry returned (bounded by `-n/--size`)
- `query.ts` — parses qualifiers: `keyword:`, `author:`, `scope:`, `tag:` (`tag:`/`tags:` is an alias of `keyword:` — folded into npm's native `keywords:` search). Every qualifier maps onto npm's native search syntax; there is no client-side filtering qualifier
- `store.ts` — JSON persistence in the user config dir, non-destructive migrations (schema v4: bundles are the only saved-package store; the v3 `favorites` map migrates into the `FAVORITES_BUNDLE` bundle as `latest`-tracking dependencies, dropping the stale version snapshot and the guessed category), bundle mutators, and the flat saved-entry query `listSavedEntries({ bundle? })` — every bundle entry across all bundles tagged with the bundle it came from, ordered by bundle then package name; one query backs both `siz list` and the empty-box front door. `removeFromBundle()` reports `{ removed, missing }` and leaves an empty bundle rather than deleting it
- `pm.ts` — detect npm/pnpm/yarn/bun/deno and build install commands (incl. dev deps), the uninstall command (`buildRemoveCommand`, via `resolveCommand(agent, 'uninstall', …)`), and the sync/install command (`buildSyncCommand`, `runInstall`) used by upgrade; `parseSpec()` splits a `pkg@version` spec (scope-aware) into name + version; uses `package-manager-detector`
- `meta.ts` — fast version resolution via `fast-npm-meta`
- `trust.ts` — trust signals (deprecation, publish age, provenance) for search results, from **two independent sources in parallel** (`fetchTrustSignals`): the packument (`packument.fetchManifests`) supplies `deprecated` → the `⚠` glyph + `parseReplacement()` successors, and `dist.attestations` → the `✓` mark (`hasAttestation()`; attestation-only — npm's separate `trustedPublisher` flag is no longer folded in); `fast-npm-meta`'s `getLatestVersionBatch(..., { metadata: true })` supplies **only** `publishedAt` (`retry: false` + short timeout + session memo). Each degrades silently and independently, and a name appears iff at least one source resolved. Pure helpers `isStale` (>2y) / `formatPublishAge` take an injected `now` for testability. Also `fetchDownloadSignals`/`computeMomentum` (`↑`/`↓`) off npm's downloads API. **No license field** — `fast-npm-meta` doesn't expose one, which is why the license signal uses the packument instead (ADR 0009)
- `packument.ts` — the shared npm-packument layer: `fetchManifests(names)` GETs `registry.npmjs.org/<pkg>/latest` once per package (bounded concurrency, 4s timeout, silent degrade, and a process-scoped memo of the **in-flight promise** — the three families start in the same tick, so a value-only memo would let each fire its own request) and returns a narrow `PackageManifest` projection (`license`/`licenses`, `deprecated`, `dist.unpackedSize`, `dist.attestations`). `size.ts`, `license.ts` and `trust.ts` all derive from it, so those facts cost **one** request per package. **A name appears in the returned map iff its packument resolved** — that is what lets callers tell "resolved but empty" from "never found out"
- `window.ts` — the pure signal window: `signalWindow(count, focusIndex, { viewport, margin })` → `{ start, end }` and `windowNames(names, focusIndex, { exclude })`, plus `SIGNAL_VIEWPORT_ROWS` / `SIGNAL_PREFETCH_MARGIN`. Decides which result rows are worth an eager signal fetch; used by the interactive box only
- `size.ts` — size signals: `fetchInstallSizes` derives `dist.unpackedSize` from `packument.ts` (eager, windowed rows); `fetchBundleSize` hits Bundlephobia lazily for the focused row only. `formatBytes`/`isHeavy` + the editorial `HEAVY_INSTALL_BYTES` (~1MB → `■`). See ADR 0008
- `license.ts` — the license signal (legal family): `fetchLicenses` derives from `packument.ts`. Pure helpers `normalizeLicense` (collapses all four shapes npm has used — string, `{type}`, bare array, legacy `licenses` key), `isUnclearLicense` (none / `UNLICENSED` / `SEE LICENSE IN …`; exact-match so the SPDX id `Unlicense` is **not** caught), `formatLicense`, `truncateLicense`. Reports verbatim and grades nothing. `LicenseSignals.license` is `string | null`, and **map absence means "unknown" — render nothing, never `⚖`**. See ADR 0009
- `project.ts` — locate the nearest `package.json` (`loadProjectManifest`) or discover workspace members (`discoverManifests`, via `tinyglobby`): workspace-aware when a definition exists (`loadWorkspaceGlobs()` reads pnpm `packages:` / npm-yarn `workspaces`), else a brute-force glob. Collects deps from `dependencies`/`devDependencies` and rewrites version ranges in-place without reformatting (brace-matched block edits, atomic writes); `isUpgradableSpecifier()` filters out non-registry protocols
- `upgrade.ts` — analyze each dep against registry versions and build an upgrade plan with ceiling semantics (`UpgradeMode`); `collectQueryNames()`/`planManifests()` extend this across multiple manifests (`ManifestPlan`); `planCatalog()`/`collectCatalogNames()` do the same for pnpm catalog entries (`CatalogPlanItem`); types `DepAnalysis`, `UpgradePlan`, `VersionInfo`
- `outdated.ts` — read-only analysis for `siz outdated`: `analyzeOutdated()` classifies one dep as outdated / skipped / up-to-date (Current = range floor, Wanted = `maxSatisfying` over the literal range, Latest = dist-tag); `buildOutdatedReport()`, `planManifestsOutdated()` (`ManifestOutdated`), and `planCatalogOutdated()` (`CatalogOutdatedItem`) span manifests + catalog. Reuses `currentVersionFromRange`/`isUpgradableSpecifier`; reports complex ranges (unlike `upgrade.ts`, which must skip them to rewrite safely). Never writes
- `catalog.ts` — locate the nearest `pnpm-workspace.yaml` (`discoverCatalog`), parse its `catalog:` / `catalogs:` blocks into `CatalogEntry[]` (via the `yaml` parser), and rewrite catalog versions in place with indentation-scoped, format-preserving string edits (`applyCatalogEdits`); `readWorkspacePackages()` exposes the file's `packages:` globs for manifest discovery
- `rules.ts` — project-local dependency guardrail. Reads `siz.config.json` (nearest via `findUp`, JSON, `{ rules: { allow, deny } }`) with `loadRules()` (throws on malformed JSON — fail-closed; `undefined` when absent). Pure, reusable evaluation core (for a future `siz check` audit): `evaluateRule()` / `partitionByRules()` apply `permitted = (allow empty OR matches allow) AND NOT matches deny` (deny wins); `globToRegExp()`/`matchesPattern()` do flat-string name globbing (`*` = any chars, slash-agnostic). Enforced at the three install paths only (interactive **Install**, direct `siz add`, and `bundle install`); `--no-rules` bypasses. Uninstall (`siz rm`) is not gated
- `paths.ts` — config dir resolution (Windows `%APPDATA%\siz`, Unix `~/.config/siz`)
- `types.ts` — shared interfaces: `Bundle`, `BundlePackage`, `SavedEntry`, `SizData`, `SearchResult`

**UI** (`src/ui/`): `render.ts` (score bars, result cards, `formatBlockedNotice` for rule-blocked packages; one `*Inline`/`*Detail` formatter pair per result-signal family — `trustGlyphs`/`trustDetail`, `sizeInline`/`sizeDetail`, `licenseInline`/`licenseDetail` — plus `signalLegend()` covering all three families' glyphs), `search-prompt.ts` (type-as-you-search multiselect), `prompts.ts` (`@clack/prompts` confirm/action menus, package-manager picker), `upgrade-render.ts` (upgrade summary line, version deltas, option labels; exports `colorForDiff`), `outdated-render.ts` (aligned Current/Wanted/Latest table + summary line, reusing `colorForDiff`), `highlight.ts` (keyword highlighting). Color via `ansis`.

**Library surface** — `src/index.ts` re-exports core functions (`searchPackages`, `detectPM`, `buildInstallCommand`, `buildRemoveCommand`, `parseSpec`, `listSavedEntries`, the `project.ts`/`upgrade.ts`/`catalog.ts` upgrade functions and types, the `outdated.ts` report functions and types, the `size.ts`/`license.ts`/`packument.ts` result-signal functions, …). Keep it in sync when core signatures change.

**Data store** — persisted to `data.json` in the config dir (`%APPDATA%\siz\data.json` on Windows, `~/.config/siz/data.json` on Unix). Tests under `test/*.test.ts` mirror the core modules.

## Agent skills

### Issue tracker

Issues live as local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
