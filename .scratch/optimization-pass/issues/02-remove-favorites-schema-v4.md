# 02 — Remove favorites (schema v4 migration)

**What to build:** Favorites stop existing as a concept, without anyone losing the packages they curated.

On first run after upgrading, every existing favorite is migrated into a bundle so it stays reachable through the flat saved-entry list and `siz list`. The migration is non-destructive, preserves every package name, never deletes a bundle, and is safe to run twice. The stale version snapshot each favorite carried is **not** carried over (it was captured whenever the package was favorited and never refreshed), and neither is its category.

`siz add --fav` and `siz rm --fav` are removed: using either produces a clear error naming what replaces it, rather than being silently ignored. `siz add` becomes a two-mode command — install by default, record into a bundle with `--bundle` — and `siz rm <pkg>` means only "uninstall from this project", with no mode flag at all, completing the direction ADR 0006 set. The interactive action menu keeps Install and Add to bundle; the Favorite action is gone. The favorites API leaves the store and the library surface.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** 01 — Bundles become the saved-package store.

**Status:** completed

- [x] Store schema advances to v4 with a guarded migration step following the existing chain
- [x] Every favorite present in a v3 store appears as an entry in a bundle after migration, recorded as a regular dependency tracking latest
- [x] The migration drops the favorite's stored version snapshot and its category
- [x] The migration is idempotent — running it twice produces the same result and never removes a package or a bundle
- [x] A v3 store with no favorites, and a store already at v4, both migrate without error
- [x] Pre-existing bundles are unaffected by the migration
- [x] `siz add --fav` errors with a message naming the replacement flow; same for `siz rm --fav`
- [x] `siz add` supports exactly two modes: default install and `--bundle <name>`
- [x] `siz rm <pkg>` always builds an uninstall command, with no favorites branch
- [x] The interactive action menu offers Install and Add to bundle only
- [x] The favorites mutators and query are removed from the store and from the library surface
- [x] Store tests cover v4 migration from a raw v3 object (entries preserved, version and category dropped, bundles untouched), idempotency, and the no-favorites case
- [x] Command dispatch tests cover `siz add`'s two modes, the removed-flag errors, and `siz rm` always uninstalling; favorites-specific cases are deleted
- [x] The `siz -h` block and per-command help in the project instructions no longer mention `--fav`
- [x] A changeset is authored at `minor` calling out the removed flags and the migration
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone)
