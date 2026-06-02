---
"@sakana-y/siz": patch
---

Add `siz upgrade [level]` (alias `siz up`) to bump your project's dependencies. It reads the local `package.json`, shows which `dependencies`/`devDependencies` have newer versions, lets you pick which to upgrade and choose your package manager, then rewrites the version ranges in place (preserving your `^`/`~`/exact style and the file's formatting) and runs the install. Levels use ceiling semantics like `taze`: `patch` (newest within the same major.minor), `minor` (newest within the same major), and `major`/`latest` (absolute newest), with pre-1.0 `0.x` treated as breaking. Use `--dry-run` to preview without writing. Non-registry specifiers (`workspace:`/`catalog:`/npm-alias/git/file/link) and packages not found on the registry are skipped.
