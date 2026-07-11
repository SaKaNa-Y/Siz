---
"@sakana-y/siz": patch
---

Add a shared dependency-scan step for the Manage track. `siz upgrade` and `siz outdated` now discover a project's manifests, nearest pnpm catalog, and the deduped set of upgradable names to query through one `discoverProjectDeps()` helper, so the two commands agree on what a project's dependencies are by construction. Exposed from the library as `discoverProjectDeps` / `DependencyScan`.
