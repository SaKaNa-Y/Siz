---
"@sakana-y/siz": minor
---

Command-surface cleanups.

- **`siz upgrade latest` is removed.** `major` is now the only name for "newest overall" — it belongs to the same semver vocabulary as `minor` and `patch`, and the two names always resolved through the same branch. Passing `latest` errors with the accepted levels; bare `siz upgrade` is unchanged and still means newest overall. Library consumers: the exported `UpgradeMode` type loses its `'latest'` member, and `parseUpgradeMode` / `UPGRADE_LEVELS` / `DEFAULT_UPGRADE_MODE` are now exported alongside it.
- The interactive **version policy** prompt (Add to bundle) now offers all four strategies — caret, tilde, latest and exact — matching what `siz add --strategy` accepts.
- Recording a bundle entry with an explicit `@version` while `--strategy` is set now prints a notice that the version pinned the entry, instead of silently overriding the strategy.
- `--no-rules` no longer renders a misleading `(default: true)` in help, wherever the flag is registered.
