---
"@sakana-y/siz": minor
---

Upgrade dependencies to their latest versions, several across major boundaries.

Runtime: `fast-npm-meta` v1 → v2 (drives `siz upgrade` version resolution), `@clack/*`, `ansis`, and `package-manager-detector`. Toolchain: TypeScript 6, Vitest 4, tsdown 0.22, oxlint 1.68, oxfmt 0.53, tsx 4.22. `@types/node` is pinned to the `20.x` line to match the supported Node engine (`>=20.19.0`), and the build loads `tsdown.config.ts` via tsx (`tsdown --config-loader tsx`).
