---
"@sakana-y/siz": patch
---

Add **preset bundles** — reusable, named collections of packages you can install in one step.

- `siz add <pkg...> --bundle <name>` records the tracked packages into a bundle (created if missing); `-D`/`--dev` marks them as devDependencies. Without `--bundle`, `siz add` offers an interactive "Add to a bundle?" picker on a TTY.
- `siz bundle list` — list saved bundles, most-recently-used first.
- `siz bundle install <name>` — resolve fresh versions from npm, apply each package's version strategy (caret/tilde/exact/latest), pick a package manager, and install.
- `siz bundle show <name>`, `siz bundle rm <name>`, `siz bundle rename <old> <new>` — inspect and manage bundles.

Bundles persist in the siz data store. Existing data files migrate non-destructively to schema v2.
