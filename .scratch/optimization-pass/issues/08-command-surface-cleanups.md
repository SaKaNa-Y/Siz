# 08 — Command-surface cleanups

**What to build:** Four small sharp edges filed off the CLI surface.

1. **One name for "newest overall".** `siz upgrade major` and `siz upgrade latest` resolve through the same branch — two names, one behavior. `major` becomes canonical (it belongs to the same semver vocabulary as `minor` and `patch`) and `latest` is no longer an accepted level. Bare `siz upgrade` still means newest overall.
2. **Consistent version strategies.** The `--strategy` flag accepts four values while the interactive bundle version-policy prompt offers only two, so the interactive path is quietly less capable. The prompt offers all four.
3. **No silent override.** Recording a bundle entry with an explicit `@version` while `--strategy` is set silently pins the entry; it now prints a notice saying the version won.
4. **Honest help text.** `--no-rules` currently renders as though rule-bypassing were the default, which is the opposite of the truth.

`siz help` and `siz version` are deliberately **kept** — they duplicate the flags, but that duplication is a near-universal CLI convention.

This ticket is independent of tickets 01–07 and can be picked up at any time.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `siz upgrade latest` is rejected with a message listing the accepted levels
- [x] `siz upgrade major` and bare `siz upgrade` both mean newest overall, with unchanged ceiling semantics for `minor` and `patch`
- [x] The interactive bundle version-policy prompt offers latest, exact, caret and tilde
- [x] Recording a bundle entry with an explicit `@version` alongside `--strategy` prints a notice that the version pinned the entry
- [x] `--no-rules` help text no longer shows a misleading default, wherever the flag is registered
- [x] `siz help` and `siz version` still work
- [x] Upgrade level validation is covered by tests
- [x] The `siz -h` block and per-command help in the project instructions match the new level list and flag text
- [x] A changeset is authored at `minor` noting the removed upgrade level
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone)
