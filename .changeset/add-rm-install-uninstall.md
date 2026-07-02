---
"@sakana-y/siz": patch
---

**Breaking:** `siz add` and `siz rm` now install / uninstall packages in the current project (delegating to the detected package manager), instead of managing favorites. Favoriting moves to a `--fav` flag on both commands.

- `siz add <pkg>` installs (ni-style: detects the package manager and runs, workspace picker only in a monorepo). Accepts version specifiers (`siz add react@18`, `siz add @scope/pkg@1.2.3`), a `-D`/`--dev` dev-dependency toggle, and honors the dependency-rules guardrail (`--no-rules` to bypass).
- `siz rm <pkg> [...packages]` uninstalls (multiple packages at once). It does **not** touch favorites.
- `siz add <pkg> --fav` favorites; `siz rm <pkg> --fav` removes a favorite. `--bundle <name>` still records into a bundle (mutually exclusive with `--fav`).

To keep the old behavior, add `--fav`: `siz add lodash` → `siz add lodash --fav`, `siz rm lodash` → `siz rm lodash --fav`.
