---
"@sakana-y/siz": patch
---

Replace the two-tier track/favorite model with a single Favorites list. A package in your local list is simply a favorite — there's no separate "tracked" state.

- `siz add <pkg>` now favorites a package; use `siz add <pkg> --bundle <name>` to record into a bundle instead (this no longer favorites the package).
- Removed the `siz fav` / `siz unfav` commands and the `siz list --fav` filter (everything in the list is a favorite now).
- The post-install "Track these in Siz too?" prompt and the interactive "Track" action are gone; use the "Favorite" action.
- Library API renamed: `trackPackage` → `addFavorite`, `untrack` → `removeFavorite`, `listPackages` → `listFavorites`; `setFavorite` and `sortByFavoriteThenName` removed; the `TrackedPackage` type is now `FavoritePackage`.

Existing data migrates automatically (schema v3): every previously tracked package becomes a favorite, with no data loss.
