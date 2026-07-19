---
"@sakana-y/siz": minor
---

Install **peer and optional dependencies** into their correct bucket when installing a bundle. `siz add --bundle` / `siz bundle install` now emit the package manager's own save flag per dependency type — `--save-peer` / `--save-optional` for npm & pnpm, `--peer` / `--optional` for yarn & bun — instead of silently installing peer/optional deps as regular dependencies. Managers with no peer/optional concept (deno) degrade to a regular dependency and now say exactly which packages were affected.
