# 06 — Deprecation and provenance from the packument

**What to build:** Siz stops buying facts twice from two providers.

The `/latest` packument siz already fetches for every result row (about 4 kB) carries `license`, `dist.unpackedSize`, **`deprecated`** and **`dist.attestations`** — verified against the live registry. Today only the first two are read, and the deprecation flag and provenance mark are fetched a second time from a third-party metadata service, which is therefore the source siz trusts for facts it already holds.

After this ticket the `⚠` deprecated flag, the deprecation message that feeds the replacement suggestion, and the `✓` provenance mark are all derived from the packument. The third-party service is consulted only for publish age — the one fact it genuinely provides cheaply and which the manifest does not carry — so the `⚑` stale flag is unaffected. Glyphs, expanded focused-row detail, `--list` and `--json` output stay the same to the user, with one deliberate narrowing: `✓` now means "has a provenance attestation" and no longer covers npm's separate trusted-publisher flag.

The packument projection must stay narrow, keep its process-scoped memo, and preserve the contract that a name appears in the result only if its packument resolved — that contract is what keeps *unknown* distinct from *found nothing*, per ADR 0009.

Parent spec: `.scratch/optimization-pass/PRD.md`. Partially supersedes ADR 0003; the decision is recorded in ticket 09.

**Blocked by:** 05 — Weekly downloads replace the score bars.

**Status:** done

- [x] The packument projection includes the deprecation field and the distribution attestations alongside license and unpacked size, and remains a narrow projection
- [x] The `⚠` deprecated glyph and its focused-row message are derived from the packument
- [x] The replacement suggestion (`→ replaced by …`) still parses out of the deprecation message, per ADR 0005, including in `--list` and `--json`
- [x] The `✓` provenance mark is derived from the presence of an attestation, and remains positive-only
- [x] The third-party metadata batch is consulted only for publish age; the `⚑` stale flag and the "published X ago" detail are unchanged
- [x] The resolved-versus-never-resolved contract of the packument layer is preserved
- [x] Each source degrades silently and independently — a failing packument or a failing metadata batch never blocks the result list or suppresses the other's signals
- [x] `--json` still carries the deprecation, publish time and provenance fields with unchanged names and meanings
- [x] Signal tests cover deprecation and provenance derived from the packument, the replacement suggestion surviving, the metadata batch being used for publish age only, and independent silent degrade
- [x] A changeset is authored at `minor` noting that provenance narrows to attestation-only
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone)
