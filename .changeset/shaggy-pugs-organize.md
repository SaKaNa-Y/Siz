---
"@sakana-y/siz": minor
---

Bundles now hold everything you've saved, and single entries can be removed.

- Pressing **Enter** on an empty search box opens a flat list of every package saved across all your bundles, each row tagged with the bundle it came from — selections flow into the same action menu search selections use, and each entry installs as the dependency type it was saved with.
- `siz list` prints that same flat list for scripting, showing each entry's version range, dependency type, and bundle. `-b/--bundle <name>` narrows it to one bundle; `-c/--category` is gone.
- `siz bundle rm <bundle> <pkg...>` removes exactly those entries from a bundle. A name that isn't in the bundle is reported and the rest still go; removing the last entry leaves an empty bundle. `siz bundle rm <bundle>` with no package names still deletes the whole bundle behind the existing confirmation.
- Library surface: new `listSavedEntries()` and `SavedEntry`; `removeFromBundle()` now returns `{ bundle, removed, missing }` instead of the bundle.
