# 05 — Weekly downloads replace the score bars

**What to build:** The two most prominent elements on every result row stop being noise and start being a fact.

npm retired the scores behind `quality ▰▰▰▰▰  popularity ▰▰▰▰▰`; the search endpoint now returns `quality = popularity = maintenance = 1.000` for **every** package, and its relevance number is not a 0..1 fraction (it comes back in the hundreds). The bars are structurally always full. Meanwhile siz already fetches download data for the momentum arrow and throws the count away.

After this ticket each row shows a weekly download count instead of the bars, so adoption can be compared at a glance. Scoped packages — `@types/node`, `@babel/core`, `@tanstack/react-query`, currently blank because the bulk endpoint rejects scoped names — get a count from npm's single-package endpoint (last week only, bounded concurrency, same silent degrade). The momentum arrow is kept where both periods are available, and stays unavailable for scoped packages. `--json` gains the count and loses the dead score fields; the registry's relevance number survives only as the internal re-ranking tiebreaker.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** 04 — One search: rank, don't filter.

**Status:** ready-for-agent

- [ ] Result rows show a weekly download count inline, in place of the quality and popularity bars
- [ ] The bars are removed from interactive rows, `--list` output and result cards
- [ ] Unscoped packages get their count from the download data already fetched for momentum, with no additional request
- [ ] Scoped packages get a last-week count via the single-package download endpoint, with bounded concurrency
- [ ] The momentum arrow still appears for unscoped packages above the existing volume floor, and never for scoped packages
- [ ] A missing count renders nothing rather than a zero
- [ ] Download counts load progressively and degrade silently, like every other result signal
- [ ] `--json` includes a weekly download count when known and omits it when not
- [ ] `--json` no longer includes the quality, popularity, maintenance or relevance score fields
- [ ] The relevance number is retained internally as the re-ranking tiebreaker only
- [ ] A pure downloads formatter lives beside the existing publish-age formatter and is unit-tested for magnitude thresholds and rounding
- [ ] Signal tests cover count retention for unscoped names, the scoped fallback producing a count but no arrow, and silent degrade when the download source fails
- [ ] A changeset is authored at `minor` calling out the `--json` field removals and the new count
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone)
