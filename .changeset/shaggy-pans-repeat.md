---
"@sakana-y/siz": minor
---

Deprecation and provenance now come from the npm packument siz already fetches for every search result, instead of being bought a second time from the third-party metadata service. That service is consulted only for publish age now — the one fact the manifest doesn't carry — so the `⚑` stale flag is unchanged.

The `⚠` deprecated glyph, its message, the `→ replaced by …` successor suggestion, and the `✓` provenance mark all read the same way to you, and `--json` keeps the `deprecated`, `publishedAt`, `provenance` and `replacedBy` fields with unchanged names. Each source degrades on its own: a failing packument still leaves the age, a failing metadata batch still leaves deprecation and provenance.

Search also makes fewer requests than before: the packument memo now dedupes in-flight requests, so install size, license, deprecation and provenance genuinely share **one** fetch per package instead of each starting its own.

One deliberate narrowing: `✓` now means "the published version carries a provenance attestation" and no longer also covers npm's separate trusted-publisher flag, which the packument does not expose. A handful of packages that showed `✓` on the publisher flag alone will no longer show it. The mark stays positive-only — its absence never means "unsafe".
