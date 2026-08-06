# @sakana-y/siz

## 0.5.0

### Minor Changes

- [`0e22203`](https://github.com/SaKaNa-Y/Siz/commit/0e2220348a7fd667e56843254fe9a70a543e6c82) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Command-surface cleanups.

  - **`siz upgrade latest` is removed.** `major` is now the only name for "newest overall" — it belongs to the same semver vocabulary as `minor` and `patch`, and the two names always resolved through the same branch. Passing `latest` errors with the accepted levels; bare `siz upgrade` is unchanged and still means newest overall. Library consumers: the exported `UpgradeMode` type loses its `'latest'` member, and `parseUpgradeMode` / `UPGRADE_LEVELS` / `DEFAULT_UPGRADE_MODE` are now exported alongside it.
  - The interactive **version policy** prompt (Add to bundle) now offers all four strategies — caret, tilde, latest and exact — matching what `siz add --strategy` accepts.
  - Recording a bundle entry with an explicit `@version` while `--strategy` is set now prints a notice that the version pinned the entry, instead of silently overriding the strategy.
  - `--no-rules` no longer renders a misleading `(default: true)` in help, wherever the flag is registered.

- [`c3a202b`](https://github.com/SaKaNa-Y/Siz/commit/c3a202b14d83e9ba9f7a2a336b1d5bdfbb14467a) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Weekly download counts replace npm's retired score bars on every search result.

  npm now returns a constant `1.000` for `quality`, `popularity` and `maintenance` on every package, so the `quality ▰▰▰▰▰  popularity ▰▰▰▰▰` bars were structurally always full. They are gone from interactive rows, `--list` output and result cards, and in their place each row leads with the package's weekly download count (`250.1M/wk`, `1.5k/wk`) — a fact you can actually compare.

  Unscoped packages get the count from the download data siz already fetched for the `↑`/`↓` momentum arrow, at no extra request. Scoped packages (`@types/node`, `@tanstack/react-query`), which npm's bulk endpoint rejects and which previously showed nothing, now get a last-week count from its single-package endpoint with bounded concurrency — so they show a count, though still never an arrow. Counts load progressively and degrade silently like every other result signal, and a count siz couldn't fetch renders nothing rather than a misleading zero.

  Along the way this fixes a latent bug in the download fetch: npm picks its response shape by name count, so a request for exactly one package comes back as a bare object rather than a name-keyed map. A lone unscoped result — the last chunk of any odd-sized search — was silently losing its data, which is why the `↑`/`↓` arrow sometimes went missing. Both shapes are now normalized.

  **Breaking (`--json`):**

  - **Added** `downloads` per result — present when known, absent (never `0`) when not.
  - **Removed** the `score` object (`final`, `quality`, `popularity`, `maintenance`) and the `searchScore` field. The three score numbers are constants upstream; the registry's relevance number survives only inside siz, as the last tiebreaker in name-affinity ranking.

  Library consumers: `SearchResult.score` is removed from the type, and `fetchDownloadTrend()` is renamed `fetchDownloadSignals()` — it now returns a count as well as a trend. A pure `formatDownloads()` is exported alongside `formatPublishAge()`.

- [`215859b`](https://github.com/SaKaNa-Y/Siz/commit/215859b94ffb8a06eb18db37f100edc9d88d8505) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - **Heuristic category labels are gone.** Search results no longer carry a guessed `[Category]` prefix — in the interactive box, in `--list` output, or on result cards. The label was derived from a hardcoded substring table (`zod` read as `[DevTools]`, `zod-to-json-schema` as `[Backend]`) and sat in the same position as facts like `MIT` and `4.6 MB install`, which made a guess look like a signal. Bundles are categorization you chose, so a guessed taxonomy was redundant.

  - **Query grammar.** The `category:` / `cat:` qualifier is removed. It is no longer accepted-and-ignored: `siz category:frontend` now treats `category:frontend` as a plain search term, exactly like any other unknown `key:value` token. `keyword:`, `author:`, `scope:` and `tag:` are unchanged.
  - **Search.** The client-side category filter is gone from the search path; results come back as the registry ranked them.
  - **Library surface.** The `categories` module is removed — `suggestCategory`, `normalizeCategory`, `CATEGORIES` and the `Category` type no longer exist. `filterByCategory` is removed from `registry.ts`, and `categoryLabel` from the render surface.

- [`1bed8c0`](https://github.com/SaKaNa-Y/Siz/commit/1bed8c08449b08d17e2317522cb44e6be82090db) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - One search: name affinity now **ranks** results instead of filtering them.

  `siz <query>` runs a single full-text search over package names and descriptions, and re-ranks what the registry returned so the closest name matches come first (query coverage first, then exact → prefix → substring → fuzzy per term, with the registry's relevance as the tiebreaker). Ranking never removes a result, so multi-word queries that previously returned **zero** packages — `siz react form validation`, `siz "state management"` — now return useful ones, while `siz pino` still puts `pino` at row one. Descriptions are shown on results everywhere.

  `siz search <query>` keeps working as a deprecated, hidden alias of `siz <query>` for one minor release; it is no longer listed in `siz -h` and prints a deprecation notice on stderr.

  Also fixed: `siz --json` / `siz --list` with no query now exits non-zero with a message stating a query is required, instead of falling through into the interactive box — a CI script whose query variable came out empty can no longer get a TUI.

  Library: `filterByName` is replaced by `rankByName(results, terms)`; the `mode` option is gone from `searchPackages`, `SearchOptions` and `runSearchPrint` (the `SearchMode` type is removed); and `renderSearchResult()` no longer takes `showDescription` — descriptions and keywords always render.

- [`d52602e`](https://github.com/SaKaNa-Y/Siz/commit/d52602e2eae1eed05c26d23e094863aeb89c2139) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Favorites are gone — bundles are the only place packages are saved. Your favorites are not lost: on first run after upgrading they migrate into a bundle named `favorites`, so `siz list -b favorites` shows them.

  - **Removed flags.** `siz add --fav` and `siz rm --fav` now error with a message naming the replacement flow rather than being silently ignored: save with `siz add <pkg> --bundle <name>`, remove with `siz bundle rm <name> <pkg>`, list with `siz list`.
  - **`siz add` has exactly two modes** — install by default, record into a bundle with `--bundle <name>`. `siz rm <pkg>` means only "uninstall from this project", with no mode flag at all.
  - **The interactive action menu** offers **Install** and **Add to bundle**; the **Favorite** action is gone.
  - **Migration (store schema v4).** Every favorite becomes a bundle entry recorded as a regular dependency tracking latest. The version snapshot each favorite carried is dropped — it was captured whenever the package was favorited and never refreshed — and so is its guessed category. The migration never deletes a bundle, never overwrites an entry that already exists (so a `favorites` bundle you made yourself keeps its own entries), leaves every other bundle alone, and is safe to run twice.
  - **Library surface.** `addFavorite`, `removeFavorite`, `listFavorites`, `setCategory`, and the `FavoritePackage` type are removed; `SizData` no longer has a `favorites` map. New: `FAVORITES_BUNDLE`, the bundle name the migration writes into.

- [`891af01`](https://github.com/SaKaNa-Y/Siz/commit/891af01d19be150b1cbd1e7b5651dbe97bfd858a) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Deprecation and provenance now come from the npm packument siz already fetches for every search result, instead of being bought a second time from the third-party metadata service. That service is consulted only for publish age now — the one fact the manifest doesn't carry — so the `⚑` stale flag is unchanged.

  The `⚠` deprecated glyph, its message, the `→ replaced by …` successor suggestion, and the `✓` provenance mark all read the same way to you, and `--json` keeps the `deprecated`, `publishedAt`, `provenance` and `replacedBy` fields with unchanged names. Each source degrades on its own: a failing packument still leaves the age, a failing metadata batch still leaves deprecation and provenance.

  Search also makes fewer requests than before: the packument memo now dedupes in-flight requests, so install size, license, deprecation and provenance genuinely share **one** fetch per package instead of each starting its own.

  One deliberate narrowing: `✓` now means "the published version carries a provenance attestation" and no longer also covers npm's separate trusted-publisher flag, which the packument does not expose. A handful of packages that showed `✓` on the publisher flag alone will no longer show it. The mark stays positive-only — its absence never means "unsafe".

- [`60f041c`](https://github.com/SaKaNa-Y/Siz/commit/60f041c7a3e49543245751b3c4512b59ee872dd8) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Bundles now hold everything you've saved, and single entries can be removed.

  - Pressing **Enter** on an empty search box opens a flat list of every package saved across all your bundles, each row tagged with the bundle it came from — selections flow into the same action menu search selections use, and each entry installs as the dependency type it was saved with.
  - `siz list` prints that same flat list for scripting, showing each entry's version range, dependency type, and bundle. `-b/--bundle <name>` narrows it to one bundle; `-c/--category` is gone.
  - `siz bundle rm <bundle> <pkg...>` removes exactly those entries from a bundle. A name that isn't in the bundle is reported and the rest still go; removing the last entry leaves an empty bundle. `siz bundle rm <bundle>` with no package names still deletes the whole bundle behind the existing confirmation.
  - Library surface: new `listSavedEntries()` and `SavedEntry`; `removeFromBundle()` now returns `{ bundle, removed, missing }` instead of the bundle.

### Patch Changes

- [`7c0b394`](https://github.com/SaKaNa-Y/Siz/commit/7c0b394a250212d39d24d566a6bb1727d4910dcd) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Interactive search now fetches result signals (install size, license, deprecation, provenance, download counts) only for the rows your terminal actually shows, plus a small prefetch margin — instead of one packument request per result in the whole set. Rows further down fill in as you scroll, nothing is fetched twice, and signals still load progressively without blocking the list, so results settle faster on a short terminal. `--list` and `--json` are unchanged: they print every result, so they still fetch signals for every result.

## 0.4.1

### Patch Changes

- [`4182a06`](https://github.com/SaKaNa-Y/Siz/commit/4182a06ab97c73613e5bdfb87d86cc4f19b3b7a6) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add the **license signal** — each search result now shows its declared license inline, so you can judge legal compatibility before installing, not after.

  - Shown on **every** row (interactive, `--list`, and a `license` field in `--json`), with the full value on the focused row when a long SPDX expression is clipped.
  - Siz **grades nothing**: `MIT` and `GPL-3.0-only` render identically. Whether copyleft is a problem is a fact about your project, not the package.
  - A `⚖` glyph marks an **unclear license** — one that can't be resolved from registry metadata at all: none declared, `UNLICENSED`, or `SEE LICENSE IN <file>`. (The SPDX id `Unlicense`, a public-domain dedication, is not flagged.)
  - Reads the deprecated license shapes older packages use (`{ "type": "MIT" }`, bare arrays, the legacy top-level `licenses` key), so a plainly-licensed 2013 package isn't misreported as unlicensed.
  - **Costs no extra network requests** — the license comes from the same npm packument already fetched for install size, via a new shared packument layer.
  - In `--json`, `license` is three-valued and the distinction is deliberate: a **string** when declared, an explicit **`null`** when the package declares none, and **absent** when siz couldn't check. So CI can tell a real finding from a failed lookup — and a slow registry never renders as "no license".

## 0.4.0

### Minor Changes

- [#38](https://github.com/SaKaNa-Y/Siz/pull/38) [`c621d67`](https://github.com/SaKaNa-Y/Siz/commit/c621d6730acf1b5a335e75e331ab77db35a6cb5c) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Install **peer and optional dependencies** into their correct bucket when installing a bundle. `siz add --bundle` / `siz bundle install` now emit the package manager's own save flag per dependency type — `--save-peer` / `--save-optional` for npm & pnpm, `--peer` / `--optional` for yarn & bun — instead of silently installing peer/optional deps as regular dependencies. Managers with no peer/optional concept (deno) degrade to a regular dependency and now say exactly which packages were affected.

### Patch Changes

- [#37](https://github.com/SaKaNa-Y/Siz/pull/37) [`04829f2`](https://github.com/SaKaNa-Y/Siz/commit/04829f20d0a60dc0c2d01053894818d69837deef) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add a **package-size signal** to search results. Each result now shows its **install size** (the package's own unpacked-on-disk size) inline on every row — with a `■` glyph flagging packages past a "heavy" threshold — and, on the focused row in interactive search, its **bundle size** (minified + gzipped, including dependencies, from Bundlephobia). Install size is included in `--list` output and as an `installSize` field in `--json`; bundle size is interactive-only, so scripting/CI stays fast. Sizes load progressively and degrade silently if a source is unreachable.

- [#35](https://github.com/SaKaNa-Y/Siz/pull/35) [`f89d158`](https://github.com/SaKaNa-Y/Siz/commit/f89d158f3ec04685df35427b2fe3aa1b2872eff2) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Extract a shared registry-comparison core (`core/compare.ts`) that `siz upgrade` and `siz outdated` both specialize over, so the two commands agree on a project's dependency state by construction. Behavior and the public library API are unchanged.

## 0.3.2

### Patch Changes

- [#32](https://github.com/SaKaNa-Y/Siz/pull/32) [`9c5f9d3`](https://github.com/SaKaNa-Y/Siz/commit/9c5f9d38e455644be951b5c3d1e6e9ebaead0979) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add a shared dependency-scan step for the Manage track. `siz upgrade` and `siz outdated` now discover a project's manifests, nearest pnpm catalog, and the deduped set of upgradable names to query through one `discoverProjectDeps()` helper, so the two commands agree on what a project's dependencies are by construction. Exposed from the library as `discoverProjectDeps` / `DependencyScan`.

## 0.3.1

### Patch Changes

- [#31](https://github.com/SaKaNa-Y/Siz/pull/31) [`41731ff`](https://github.com/SaKaNa-Y/Siz/commit/41731ffe787a6cad6573e8f094731beb4d15ec34) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - **Breaking:** `siz add` and `siz rm` now install / uninstall packages in the current project (delegating to the detected package manager), instead of managing favorites. Favoriting moves to a `--fav` flag on both commands.

  - `siz add <pkg>` installs (ni-style: detects the package manager and runs, workspace picker only in a monorepo). Accepts version specifiers (`siz add react@18`, `siz add @scope/pkg@1.2.3`), a `-D`/`--dev` dev-dependency toggle, and honors the dependency-rules guardrail (`--no-rules` to bypass).
  - `siz rm <pkg> [...packages]` uninstalls (multiple packages at once). It does **not** touch favorites.
  - `siz add <pkg> --fav` favorites; `siz rm <pkg> --fav` removes a favorite. `--bundle <name>` still records into a bundle (mutually exclusive with `--fav`).

  To keep the old behavior, add `--fav`: `siz add lodash` → `siz add lodash --fav`, `siz rm lodash` → `siz rm lodash --fav`.

- [#29](https://github.com/SaKaNa-Y/Siz/pull/29) [`6e9b02a`](https://github.com/SaKaNa-Y/Siz/commit/6e9b02a4c0c33b2d0d1853d63ecc5925fa7bfaec) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Surface replacement suggestions for deprecated packages in search results. When a deprecated package's npm deprecation message names a successor ("use `got` instead", "migrate to undici", an `npmjs.com/package/...` link), siz now extracts it and shows `→ replaced by <pkg>` in the focused-row detail and `--list`, and adds a `replacedBy` array to `--json`. Suggestions are parsed straight from the maintainer's message (high-confidence only) — siz never invents a recommendation, so a deprecated package whose message names no successor simply shows none.

## 0.3.0

### Minor Changes

- [#28](https://github.com/SaKaNa-Y/Siz/pull/28) [`0516406`](https://github.com/SaKaNa-Y/Siz/commit/05164063fc7fbda349d0906f4467036a3095fded) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add `siz outdated` — a read-only, non-interactive report of dependencies that are behind the registry. It shows each dependency as **Current / Wanted / Latest** (Current is the declared range floor, so it works on a fresh checkout before install), mirrors `siz upgrade`'s scope with `-r/--recursive` and pnpm catalog support, and never writes or installs anything. Use `--json` to emit `{ outdated, skipped, summary }` for CI, and `--exit-code` to fail the build when anything is outdated.

### Patch Changes

- [#25](https://github.com/SaKaNa-Y/Siz/pull/25) [`ae36997`](https://github.com/SaKaNa-Y/Siz/commit/ae369972f5b3cdb489d2929273dcffa8ee66c798) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add download-trend momentum to trust-aware search results. Each result now shows a `↑` (rising) or `↓` (falling) glyph when its npm download volume is climbing or dropping, derived from npm's public download-counts API. The trend is informational only — it never reranks or filters — and appears in interactive search, `--list`, and `--json` output. Scoped packages (`@scope/pkg`) and very low-volume packages show no momentum.

## 0.2.3

### Patch Changes

- [#24](https://github.com/SaKaNa-Y/Siz/pull/24) [`86536b6`](https://github.com/SaKaNa-Y/Siz/commit/86536b6e9ae60a5f376695d8a31014387151d840) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Dependency rules: drop a committable `siz.config.json` at your repo root to declare `allow` / `deny` glob lists of package names, and siz blocks disallowed packages at install time — both the interactive **Install** action and `siz bundle install`. `deny` always wins; an empty `allow` is denylist mode, a non-empty `allow` is allowlist mode (`@ourorg/*`, `*-deprecated`, exact names all work). Denied packages in a selection are dropped with a notice naming the rule that blocked them; if every selection is blocked the action aborts non-zero. A missing config means no restrictions; a malformed config fails closed (siz aborts rather than letting everything through). Pass `--no-rules` to bypass for a deliberate one-off.

- [#22](https://github.com/SaKaNa-Y/Siz/pull/22) [`e2797af`](https://github.com/SaKaNa-Y/Siz/commit/e2797af6a0cd4bd318c863b10a22f7eba4776529) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Trust-aware discovery: search results now show inline trust signals — `⚠` deprecated, `⚑` stale (published >2 years ago), and `✓` provenance — so you can judge a package before installing. Glyphs appear on every row for at-a-glance comparison; the focused row expands them to words. Signals load progressively (the list never blocks on them) and degrade silently if the metadata service is unreachable. `--list` and `--json` output include them too, with `--json` adding `deprecated`, `publishedAt`, and `provenance` fields per result.

## 0.2.2

### Patch Changes

- [#19](https://github.com/SaKaNa-Y/Siz/pull/19) [`223489e`](https://github.com/SaKaNa-Y/Siz/commit/223489ec2e4dd9995480999490ea89da5e65df89) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Replace the two-tier track/favorite model with a single Favorites list. A package in your local list is simply a favorite — there's no separate "tracked" state.

  - `siz add <pkg>` now favorites a package; use `siz add <pkg> --bundle <name>` to record into a bundle instead (this no longer favorites the package).
  - Removed the `siz fav` / `siz unfav` commands and the `siz list --fav` filter (everything in the list is a favorite now).
  - The post-install "Track these in Siz too?" prompt and the interactive "Track" action are gone; use the "Favorite" action.
  - Library API renamed: `trackPackage` → `addFavorite`, `untrack` → `removeFavorite`, `listPackages` → `listFavorites`; `setFavorite` and `sortByFavoriteThenName` removed; the `TrackedPackage` type is now `FavoritePackage`.

  Existing data migrates automatically (schema v3): every previously tracked package becomes a favorite, with no data loss.

## 0.2.1

### Patch Changes

- [#18](https://github.com/SaKaNa-Y/Siz/pull/18) [`ad80f38`](https://github.com/SaKaNa-Y/Siz/commit/ad80f382acd6b63b1dc63b3a19a143a185a3a09f) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - `siz upgrade` now upgrades pnpm catalog versions. When a `pnpm-workspace.yaml` is found (walking up from the current directory), Siz reads its `catalog:` and `catalogs:` blocks and offers each entry as its own upgrade row — tagged `catalog` or `catalog:<name>` — alongside your `package.json` deps. Selected entries are rewritten directly in `pnpm-workspace.yaml`, preserving formatting and comments, so a shared version is bumped once for the whole workspace. The `catalog:` references inside each `package.json` are left untouched, since they point at the catalog that just changed. Works with both the default catalog and named catalogs, and respects the same ceiling semantics (`major | minor | patch | latest`) and `--dry-run` preview as the rest of the upgrade flow. (Yarn and Bun catalogs are not handled yet.)

- [#18](https://github.com/SaKaNa-Y/Siz/pull/18) [`ad80f38`](https://github.com/SaKaNa-Y/Siz/commit/ad80f382acd6b63b1dc63b3a19a143a185a3a09f) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Workspace-aware manifest discovery for `siz upgrade -r` and the install workspace picker. When a workspace is declared — pnpm's `packages:` in `pnpm-workspace.yaml`, or an npm/yarn `workspaces` field (array or `{ packages: [...] }`) — Siz now scans only the declared members (plus the root), instead of every `package.json` under the directory. A stray `package.json` in `examples/`, `fixtures/`, `templates/`, or `docs/` is no longer treated as a workspace member, so it matches what `pnpm`/`npm`/`yarn install` actually link. Negation globs (`!packages/internal/**`) are honored. Repos with no workspace definition keep the previous brute-force behavior, so a plain folder of projects is unaffected.

- [#16](https://github.com/SaKaNa-Y/Siz/pull/16) [`3bf5f61`](https://github.com/SaKaNa-Y/Siz/commit/3bf5f61ff5883f61f617c026393bd11b4c8c9f31) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Install into a specific workspace from interactive search. When you choose **Install** in a monorepo — where more than one `package.json` exists under the current directory (skipping `node_modules`, `dist`, and `.git`) — Siz now asks which package to install into and runs your package manager in that package's directory, so the dependency lands in the right workspace. Projects with a single `package.json` are unaffected (no extra prompt).

## 0.2.0

### Minor Changes

- [#15](https://github.com/SaKaNa-Y/Siz/pull/15) [`f19376a`](https://github.com/SaKaNa-Y/Siz/commit/f19376a31810004c9f25927740e6d843e48a0179) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Upgrade dependencies to their latest versions, several across major boundaries.

  Runtime: `fast-npm-meta` v1 → v2 (drives `siz upgrade` version resolution), `@clack/*`, `ansis`, and `package-manager-detector`. Toolchain: TypeScript 6, Vitest 4, tsdown 0.22, oxlint 1.68, oxfmt 0.53, tsx 4.22. `@types/node` is pinned to the `20.x` line to match the supported Node engine (`>=20.19.0`), and the build loads `tsdown.config.ts` via tsx (`tsdown --config-loader tsx`).

### Patch Changes

- [#11](https://github.com/SaKaNa-Y/Siz/pull/11) [`8360e76`](https://github.com/SaKaNa-Y/Siz/commit/8360e7645820470ef2f278a0c9521344b4b8f819) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add **preset bundles** — reusable, named collections of packages you can install in one step.

  - `siz add <pkg...> --bundle <name>` records the tracked packages into a bundle (created if missing); `-D`/`--dev` marks them as devDependencies. Without `--bundle`, `siz add` offers an interactive "Add to a bundle?" picker on a TTY.
  - `siz bundle list` — list saved bundles, most-recently-used first.
  - `siz bundle install <name>` — resolve fresh versions from npm, apply each package's version strategy (caret/tilde/exact/latest), pick a package manager, and install.
  - `siz bundle show <name>`, `siz bundle rm <name>`, `siz bundle rename <old> <new>` — inspect and manage bundles.

  Bundles persist in the siz data store. Existing data files migrate non-destructively to schema v2.

- [#14](https://github.com/SaKaNa-Y/Siz/pull/14) [`35b7719`](https://github.com/SaKaNa-Y/Siz/commit/35b7719a25a3cef7e5f2a0f0f8c95c4aef7a4338) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add **monorepo support to `siz upgrade`** via `-r` / `--recursive`.

  - `siz upgrade -r` discovers every `package.json` under the current directory (Taze-style glob, skipping `node_modules`, `dist`, and `.git`) and offers all of their updates in a single list, each row tagged with its package.
  - Dependencies are resolved independently per package; selected ranges are rewritten format-preservingly in each manifest, and a single install runs at the root.
  - Without `-r`, `siz upgrade` keeps its previous single-package behavior (the nearest `package.json`). `workspace:` / `catalog:` deps remain skipped — pnpm catalog support is planned (see the README's "Future plans").

  New library exports: `discoverManifests`, `loadManifestAt`, `planManifests`, `collectQueryNames` (and `DiscoverOptions`, `ManifestPlan` types).

- [#15](https://github.com/SaKaNa-Y/Siz/pull/15) [`f19376a`](https://github.com/SaKaNa-Y/Siz/commit/f19376a31810004c9f25927740e6d843e48a0179) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Remove the user-defined tag feature and the "Show install command" search action.

  Custom tags on tracked packages are gone: the `siz tag` / `siz untag` commands, the "Add tags" action in interactive search, the `list --tag` filter, and tag rendering have all been removed, along with the `tags` field on tracked packages. Existing `tags` data in your local `data.json` is preserved untouched (round-tripped as an unknown field) and never dropped. The `tag:` / `tags:` search qualifier is unaffected — it remains an alias of `keyword:` for npm search.

  The post-selection "Show install command" action has also been removed; use "Install", which already shows the exact command(s) for confirmation before running them.

- [#15](https://github.com/SaKaNa-Y/Siz/pull/15) [`f19376a`](https://github.com/SaKaNa-Y/Siz/commit/f19376a31810004c9f25927740e6d843e48a0179) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Show the dev-dependency marker as a clack `hint` in `siz upgrade`'s package picker. Previously the `[dev]` tag was embedded in the option label, where it collided with the multiselect's dim-based selection styling and made it hard to tell which rows were actually selected. Dev dependencies now render a separate dim `(dev)` hint, kept distinct from the selection state in every row.

## 0.1.2

### Patch Changes

- [#7](https://github.com/SaKaNa-Y/Siz/pull/7) [`58ad642`](https://github.com/SaKaNa-Y/Siz/commit/58ad6427dedd45aa06fcc28aab618d1f2c585649) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add `siz help` and `siz version` subcommands (alongside the existing `--help`/`--version` flags), give `siz --help` a concise layout with usage examples, and fix `--version` to report the real installed version instead of always `0.1.0`.

- [#9](https://github.com/SaKaNa-Y/Siz/pull/9) [`82ea179`](https://github.com/SaKaNa-Y/Siz/commit/82ea17933b9e81b6adcb2049706991714d9ba88e) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Interactive install now supports marking each package as a dependency or devDependency individually (Ctrl+T in the search box, shown with a [dep]/[dev] badge), and lets you choose the package manager (npm/pnpm/yarn/bun/deno) at install time instead of always using the detected one. Mixed selections install as separate `add` / `add -D` commands.

- [#10](https://github.com/SaKaNa-Y/Siz/pull/10) [`28b121f`](https://github.com/SaKaNa-Y/Siz/commit/28b121fb92a45f6d705ebaf4f82f88d26a7de92c) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add `siz upgrade [level]` (alias `siz up`) to bump your project's dependencies. It reads the local `package.json`, shows which `dependencies`/`devDependencies` have newer versions, lets you pick which to upgrade and choose your package manager, then rewrites the version ranges in place (preserving your `^`/`~`/exact style and the file's formatting) and runs the install. Levels use ceiling semantics like `taze`: `patch` (newest within the same major.minor), `minor` (newest within the same major), and `major`/`latest` (absolute newest), with pre-1.0 `0.x` treated as breaking. Use `--dry-run` to preview without writing. Non-registry specifiers (`workspace:`/`catalog:`/npm-alias/git/file/link) and packages not found on the registry are skipped.

## 0.1.1

### Patch Changes

- [#4](https://github.com/SaKaNa-Y/Siz/pull/4) [`d513971`](https://github.com/SaKaNa-Y/Siz/commit/d513971dac605c40d9bc6f82d9cdea29580caf8c) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Internal: set up the Changesets-based release pipeline — CI changeset reminder, explicit `createGithubReleases`, and a format-clean `version-packages` step — and document the release flow in `CLAUDE.md`. No user-facing or runtime changes; this patch release validates the automated npm publish + GitHub Release pipeline end-to-end.
