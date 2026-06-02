# @sakana-y/siz

## 0.1.2

### Patch Changes

- [#7](https://github.com/SaKaNa-Y/Siz/pull/7) [`58ad642`](https://github.com/SaKaNa-Y/Siz/commit/58ad6427dedd45aa06fcc28aab618d1f2c585649) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add `siz help` and `siz version` subcommands (alongside the existing `--help`/`--version` flags), give `siz --help` a concise layout with usage examples, and fix `--version` to report the real installed version instead of always `0.1.0`.

- [#9](https://github.com/SaKaNa-Y/Siz/pull/9) [`82ea179`](https://github.com/SaKaNa-Y/Siz/commit/82ea17933b9e81b6adcb2049706991714d9ba88e) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Interactive install now supports marking each package as a dependency or devDependency individually (Ctrl+T in the search box, shown with a [dep]/[dev] badge), and lets you choose the package manager (npm/pnpm/yarn/bun/deno) at install time instead of always using the detected one. Mixed selections install as separate `add` / `add -D` commands.

- [#10](https://github.com/SaKaNa-Y/Siz/pull/10) [`28b121f`](https://github.com/SaKaNa-Y/Siz/commit/28b121fb92a45f6d705ebaf4f82f88d26a7de92c) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Add `siz upgrade [level]` (alias `siz up`) to bump your project's dependencies. It reads the local `package.json`, shows which `dependencies`/`devDependencies` have newer versions, lets you pick which to upgrade and choose your package manager, then rewrites the version ranges in place (preserving your `^`/`~`/exact style and the file's formatting) and runs the install. Levels use ceiling semantics like `taze`: `patch` (newest within the same major.minor), `minor` (newest within the same major), and `major`/`latest` (absolute newest), with pre-1.0 `0.x` treated as breaking. Use `--dry-run` to preview without writing. Non-registry specifiers (`workspace:`/`catalog:`/npm-alias/git/file/link) and packages not found on the registry are skipped.

## 0.1.1

### Patch Changes

- [#4](https://github.com/SaKaNa-Y/Siz/pull/4) [`d513971`](https://github.com/SaKaNa-Y/Siz/commit/d513971dac605c40d9bc6f82d9cdea29580caf8c) Thanks [@SaKaNa-Y](https://github.com/SaKaNa-Y)! - Internal: set up the Changesets-based release pipeline — CI changeset reminder, explicit `createGithubReleases`, and a format-clean `version-packages` step — and document the release flow in `CLAUDE.md`. No user-facing or runtime changes; this patch release validates the automated npm publish + GitHub Release pipeline end-to-end.
