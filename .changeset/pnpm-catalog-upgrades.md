---
"@sakana-y/siz": patch
---

`siz upgrade` now upgrades pnpm catalog versions. When a `pnpm-workspace.yaml` is found (walking up from the current directory), Siz reads its `catalog:` and `catalogs:` blocks and offers each entry as its own upgrade row — tagged `catalog` or `catalog:<name>` — alongside your `package.json` deps. Selected entries are rewritten directly in `pnpm-workspace.yaml`, preserving formatting and comments, so a shared version is bumped once for the whole workspace. The `catalog:` references inside each `package.json` are left untouched, since they point at the catalog that just changed. Works with both the default catalog and named catalogs, and respects the same ceiling semantics (`major | minor | patch | latest`) and `--dry-run` preview as the rest of the upgrade flow. (Yarn and Bun catalogs are not handled yet.)
