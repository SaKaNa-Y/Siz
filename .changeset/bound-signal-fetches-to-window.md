---
"@sakana-y/siz": patch
---

Interactive search now fetches result signals (install size, license, deprecation, provenance, download counts) only for the rows your terminal actually shows, plus a small prefetch margin — instead of one packument request per result in the whole set. Rows further down fill in as you scroll, nothing is fetched twice, and signals still load progressively without blocking the list, so results settle faster on a short terminal. `--list` and `--json` are unchanged: they print every result, so they still fetch signals for every result.
