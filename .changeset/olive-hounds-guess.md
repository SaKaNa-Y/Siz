---
'@sakana-y/siz': minor
---

**Heuristic category labels are gone.** Search results no longer carry a guessed `[Category]` prefix — in the interactive box, in `--list` output, or on result cards. The label was derived from a hardcoded substring table (`zod` read as `[DevTools]`, `zod-to-json-schema` as `[Backend]`) and sat in the same position as facts like `MIT` and `4.6 MB install`, which made a guess look like a signal. Bundles are categorization you chose, so a guessed taxonomy was redundant.

- **Query grammar.** The `category:` / `cat:` qualifier is removed. It is no longer accepted-and-ignored: `siz category:frontend` now treats `category:frontend` as a plain search term, exactly like any other unknown `key:value` token. `keyword:`, `author:`, `scope:` and `tag:` are unchanged.
- **Search.** The client-side category filter is gone from the search path; results come back as the registry ranked them.
- **Library surface.** The `categories` module is removed — `suggestCategory`, `normalizeCategory`, `CATEGORIES` and the `Category` type no longer exist. `filterByCategory` is removed from `registry.ts`, and `categoryLabel` from the render surface.
