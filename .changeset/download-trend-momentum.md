---
"@sakana-y/siz": patch
---

Add download-trend momentum to trust-aware search results. Each result now shows a `↑` (rising) or `↓` (falling) glyph when its npm download volume is climbing or dropping, derived from npm's public download-counts API. The trend is informational only — it never reranks or filters — and appears in interactive search, `--list`, and `--json` output. Scoped packages (`@scope/pkg`) and very low-volume packages show no momentum.
