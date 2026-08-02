# 03 — Remove heuristic categories

**What to build:** Siz stops labelling packages with a category it guessed.

Today every search row is prefixed with a magenta category guess derived from a hardcoded substring table — `zod` is shown as `[DevTools]`, `zod-to-json-schema` as `[Backend]` — sitting in the same visual position as facts like `MIT` and `4.6 MB install`. That label is removed from result rows and cards. The `category:` / `cat:` query qualifier is removed from the query grammar (rejected as an unknown qualifier, not silently accepted and ignored), the client-side category filter over search results is removed, and category fields disappear from stored entries.

Bundles are categorization the user chose, which makes a guessed taxonomy redundant — and a guessed label contradicts the project's own rule that result signals are facts fetched from a source, never opinions siz forms.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** 02 — Remove favorites (schema v4 migration).

**Status:** done

- [x] No category label appears on interactive result rows, in `--list` output, or on result cards
- [x] The categories module and its heuristics are deleted, along with the category suggestion and normalization helpers
- [x] The `category:` and `cat:` qualifiers no longer parse as qualifiers
- [x] The client-side category filter is removed from the search path
- [x] Category fields are removed from stored entry types and from the library surface
- [x] The categories test file is deleted; query, registry and store tests are updated for the removed qualifier, filter and field
- [x] Search continues to work identically otherwise — qualifier handling for `keyword:`, `author:`, `scope:` and `tag:` is unchanged
- [x] The `siz -h` block and per-command help in the project instructions drop the `category:` qualifier reference
- [x] A changeset is authored at `minor` noting the removed qualifier and label
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone)
