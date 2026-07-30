# 01 — Bundles become the saved-package store

**What to build:** Everything the user has saved into bundles becomes reachable as one flat list, and individual entries become removable — so bundles can carry the whole Organize track before favorites are taken away.

Pressing Enter on an empty search box opens a flat list of every saved entry across all bundles, each tagged with the bundle it came from, and selecting entries leads into the existing action set (Install / Add to bundle / Favorite — Favorite is removed in ticket 02, not here). `siz list` prints that same flat list for scripting, filterable to a single bundle with `-b/--bundle <name>`. `siz bundle rm <bundle> [...packages]` removes the named entries from a bundle, while `siz bundle rm <bundle>` with no package arguments keeps deleting the whole bundle after the existing confirmation.

Favorites are deliberately left untouched and fully working in this ticket — the replacement lands before the removal.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The store exposes a flat saved-entry query returning every bundle entry across all bundles, each carrying its bundle name, in a stable order, with an optional single-bundle filter
- [ ] Pressing Enter on an empty search box opens that flat list instead of favorites, with each row showing its bundle
- [ ] Selecting one or more entries from the flat list flows into the same action menu that search selections use
- [ ] `siz list` prints the flat saved-entry list; `siz list -b <bundle>` / `--bundle <bundle>` narrows it to one bundle
- [ ] `siz list` on an empty store prints a helpful hint rather than an error
- [ ] `siz bundle rm <bundle> <pkg> [...pkgs]` removes exactly those entries and leaves the rest of the bundle intact
- [ ] Removing a package that is not in the bundle reports that clearly and does not fail the whole command
- [ ] Removing the last entry from a bundle leaves an empty bundle rather than implicitly deleting it
- [ ] `siz bundle rm <bundle>` with no package arguments still deletes the whole bundle, behind the existing confirmation
- [ ] Favorites continue to work unchanged (`siz add --fav`, `siz rm --fav`, the Favorite action)
- [ ] Store tests cover the flat query's ordering, bundle tagging, single-bundle filter, empty store, and per-entry removal including a name absent from the bundle — using the existing injected-data-file and temp-directory pattern
- [ ] The `siz -h` block and per-command help in the project instructions are updated for the new `siz list` and `siz bundle rm` surfaces
- [ ] A changeset is authored at `minor` describing the new flat saved-entry list and per-entry bundle removal
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone — it fails repo-wide here from CRLF)
