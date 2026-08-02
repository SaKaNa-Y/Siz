---
"@sakana-y/siz": minor
---

One search: name affinity now **ranks** results instead of filtering them.

`siz <query>` runs a single full-text search over package names and descriptions, and re-ranks what the registry returned so the closest name matches come first (query coverage first, then exact → prefix → substring → fuzzy per term, with the registry's relevance as the tiebreaker). Ranking never removes a result, so multi-word queries that previously returned **zero** packages — `siz react form validation`, `siz "state management"` — now return useful ones, while `siz pino` still puts `pino` at row one. Descriptions are shown on results everywhere.

`siz search <query>` keeps working as a deprecated, hidden alias of `siz <query>` for one minor release; it is no longer listed in `siz -h` and prints a deprecation notice on stderr.

Also fixed: `siz --json` / `siz --list` with no query now exits non-zero with a message stating a query is required, instead of falling through into the interactive box — a CI script whose query variable came out empty can no longer get a TUI.

Library: `filterByName` is replaced by `rankByName(results, terms)`; the `mode` option is gone from `searchPackages`, `SearchOptions` and `runSearchPrint` (the `SearchMode` type is removed); and `renderSearchResult()` no longer takes `showDescription` — descriptions and keywords always render.
