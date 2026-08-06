# 07 — Bound eager signal fetches to the visible window

**What to build:** Searching stops paying for rows nobody is looking at.

A settled query at the default result size currently fires one manifest request per result — twenty of them — plus the search, the metadata batch and the download calls, and it repays that for every distinct input the user pauses on. The interactive box only ever displays about ten rows.

After this ticket the eager result signals (install size, license, deprecation, provenance, and download counts) are fetched for the rows on screen plus a small prefetch margin, with the rest filling in as the user scrolls — exploiting the existing process-scoped memo so nothing is ever fetched twice. Signals still load progressively, still never block the list, and still degrade silently; the user should notice only that results settle faster. Bundle size remains lazy and focused-row-only per ADR 0008.

`--list` and `--json` are explicitly unaffected: they print every result, so they fetch signals for every result. The window applies to the interactive box alone.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** 05 — Weekly downloads replace the score bars; 06 — Deprecation and provenance from the packument.

**Status:** done

- [x] A pure window function decides which result names get eager signal fetches, given a result count, a focus index, a viewport size and a prefetch margin
- [x] Scrolling beyond the initial window fetches the newly visible rows and re-renders when they resolve
- [x] Already-fetched names are never re-requested when they scroll back into view
- [x] Signals for visible rows still arrive progressively and never block the result list
- [x] Bundle size remains lazy and focused-row-only
- [x] `--list` and `--json` fetch signals for every result they print — output is byte-for-byte unaffected by the window
- [x] The window function is unit-tested for the start, middle and end of a list, and for lists shorter than the viewport
- [x] The windowing logic lives in core rather than in the interactive command or the prompt
- [x] A changeset is authored at `patch` describing the reduced per-search request count
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone)
