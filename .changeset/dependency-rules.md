---
"@sakana-y/siz": patch
---

Dependency rules: drop a committable `siz.config.json` at your repo root to declare `allow` / `deny` glob lists of package names, and siz blocks disallowed packages at install time — both the interactive **Install** action and `siz bundle install`. `deny` always wins; an empty `allow` is denylist mode, a non-empty `allow` is allowlist mode (`@ourorg/*`, `*-deprecated`, exact names all work). Denied packages in a selection are dropped with a notice naming the rule that blocked them; if every selection is blocked the action aborts non-zero. A missing config means no restrictions; a malformed config fails closed (siz aborts rather than letting everything through). Pass `--no-rules` to bypass for a deliberate one-off.
