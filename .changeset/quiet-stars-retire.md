---
"@sakana-y/siz": minor
---

Favorites are gone — bundles are the only place packages are saved. Your favorites are not lost: on first run after upgrading they migrate into a bundle named `favorites`, so `siz list -b favorites` shows them.

- **Removed flags.** `siz add --fav` and `siz rm --fav` now error with a message naming the replacement flow rather than being silently ignored: save with `siz add <pkg> --bundle <name>`, remove with `siz bundle rm <name> <pkg>`, list with `siz list`.
- **`siz add` has exactly two modes** — install by default, record into a bundle with `--bundle <name>`. `siz rm <pkg>` means only "uninstall from this project", with no mode flag at all.
- **The interactive action menu** offers **Install** and **Add to bundle**; the **Favorite** action is gone.
- **Migration (store schema v4).** Every favorite becomes a bundle entry recorded as a regular dependency tracking latest. The version snapshot each favorite carried is dropped — it was captured whenever the package was favorited and never refreshed — and so is its guessed category. The migration never deletes a bundle, never overwrites an entry that already exists (so a `favorites` bundle you made yourself keeps its own entries), leaves every other bundle alone, and is safe to run twice.
- **Library surface.** `addFavorite`, `removeFavorite`, `listFavorites`, `setCategory`, and the `FavoritePackage` type are removed; `SizData` no longer has a `favorites` map. New: `FAVORITES_BUNDLE`, the bundle name the migration writes into.
