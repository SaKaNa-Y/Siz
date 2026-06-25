---
"@sakana-y/siz": patch
---

Surface replacement suggestions for deprecated packages in search results. When a deprecated package's npm deprecation message names a successor ("use `got` instead", "migrate to undici", an `npmjs.com/package/...` link), siz now extracts it and shows `→ replaced by <pkg>` in the focused-row detail and `--list`, and adds a `replacedBy` array to `--json`. Suggestions are parsed straight from the maintainer's message (high-confidence only) — siz never invents a recommendation, so a deprecated package whose message names no successor simply shows none.
