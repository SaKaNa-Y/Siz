---
"@sakana-y/siz": patch
---

Trust-aware discovery: search results now show inline trust signals — `⚠` deprecated, `⚑` stale (published >2 years ago), and `✓` provenance — so you can judge a package before installing. Glyphs appear on every row for at-a-glance comparison; the focused row expands them to words. Signals load progressively (the list never blocks on them) and degrade silently if the metadata service is unreachable. `--list` and `--json` output include them too, with `--json` adding `deprecated`, `publishedAt`, and `provenance` fields per result.
