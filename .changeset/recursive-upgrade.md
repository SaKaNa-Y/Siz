---
"@sakana-y/siz": patch
---

Add **monorepo support to `siz upgrade`** via `-r` / `--recursive`.

- `siz upgrade -r` discovers every `package.json` under the current directory (Taze-style glob, skipping `node_modules`, `dist`, and `.git`) and offers all of their updates in a single list, each row tagged with its package.
- Dependencies are resolved independently per package; selected ranges are rewritten format-preservingly in each manifest, and a single install runs at the root.
- Without `-r`, `siz upgrade` keeps its previous single-package behavior (the nearest `package.json`). `workspace:` / `catalog:` deps remain skipped — pnpm catalog support is planned (see the README's "Future plans").

New library exports: `discoverManifests`, `loadManifestAt`, `planManifests`, `collectQueryNames` (and `DiscoverOptions`, `ManifestPlan` types).
