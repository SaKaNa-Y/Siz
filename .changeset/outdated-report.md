---
"@sakana-y/siz": minor
---

Add `siz outdated` — a read-only, non-interactive report of dependencies that are behind the registry. It shows each dependency as **Current / Wanted / Latest** (Current is the declared range floor, so it works on a fresh checkout before install), mirrors `siz upgrade`'s scope with `-r/--recursive` and pnpm catalog support, and never writes or installs anything. Use `--json` to emit `{ outdated, skipped, summary }` for CI, and `--exit-code` to fail the build when anything is outdated.
