# @sakana-y/siz

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
