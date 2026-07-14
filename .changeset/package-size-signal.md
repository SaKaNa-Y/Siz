---
"@sakana-y/siz": patch
---

Add a **package-size signal** to search results. Each result now shows its **install size** (the package's own unpacked-on-disk size) inline on every row — with a `■` glyph flagging packages past a "heavy" threshold — and, on the focused row in interactive search, its **bundle size** (minified + gzipped, including dependencies, from Bundlephobia). Install size is included in `--list` output and as an `installSize` field in `--json`; bundle size is interactive-only, so scripting/CI stays fast. Sizes load progressively and degrade silently if a source is unreachable.
