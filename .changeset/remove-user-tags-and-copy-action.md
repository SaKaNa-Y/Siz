---
"@sakana-y/siz": patch
---

Remove the user-defined tag feature and the "Show install command" search action.

Custom tags on tracked packages are gone: the `siz tag` / `siz untag` commands, the "Add tags" action in interactive search, the `list --tag` filter, and tag rendering have all been removed, along with the `tags` field on tracked packages. Existing `tags` data in your local `data.json` is preserved untouched (round-tripped as an unknown field) and never dropped. The `tag:` / `tags:` search qualifier is unaffected — it remains an alias of `keyword:` for npm search.

The post-selection "Show install command" action has also been removed; use "Install", which already shows the exact command(s) for confirmation before running them.
