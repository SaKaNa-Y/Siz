# @sakana-y/siz

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
