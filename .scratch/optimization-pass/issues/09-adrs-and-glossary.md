# 09 — ADRs and glossary

**What to build:** The decisions behind this pass get recorded, and the glossary stops being factually wrong.

Three of these decisions are hard to reverse, surprising without context, and the result of a real trade-off — the bar for an ADR. Without them, someone re-adds the score bars or the favorites store without knowing why they went.

- **ADR 0010 — Bundles as the only saved-package store.** Favorites and heuristic categories removed; schema v4 migrates favorites into a bundle rather than dropping them; the front door becomes a flat cross-bundle entry list. Record the trade-off that was actually weighed: collapsing into a default bundle would have kept every line of favorites code alive under a new name and shipped a bundle whose install-all default nobody wants, while deleting outright cost one extra level of navigation unless the front door listed entries across bundles.
- **ADR 0011 — Weekly downloads replace npm's score bars.** The load-bearing observation is invisible from the code and must be written down: npm's search endpoint returns `quality = popularity = maintenance = 1.000` for every package, and its relevance number is not a 0..1 fraction. Record that the replacement count was already on the wire for momentum, and that the `--json` score fields were removed rather than left as constants.
- **ADR 0012 — Packument as the source for deprecation and provenance.** Partially supersedes ADR 0003, demoting the third-party metadata service to publish age alone. Record the deliberate narrowing of `✓` to attestation-only, dropping npm's separate trusted-publisher flag, and note that the abbreviated packument was rejected as an alternative (about 1 MB for `zod`, and it carries neither `license` nor `deprecated`).

The glossary needs correcting, not just refreshing — several entries now describe things that are not true:

- **Score** — currently claims npm returns quality/popularity/maintenance numbers in 0..1 that siz renders as bars. Both halves are false. Rewrite it as an opaque relevance number used only as a ranking tiebreaker.
- **Provenance** — currently folds in the trusted-publisher flag; narrow it to the attestation.
- **Momentum** — rework so the download count is the primary fact and the arrow is derived from it; scoped packages get a count but no arrow.
- **Download count** — new entry in the trust family, as Score's replacement.
- **Organize** — the track has no glossary section at all today, which is part of how favorites and bundles drifted into overlapping. Add it with **Bundle**, **Saved entry** and **Front door**.

Keep the glossary free of implementation detail — it is a glossary, not a spec. The visible-window fetching from ticket 07 is implementation and does not belong in it.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** 01, 02, 03, 05, 06.

**Status:** done

- [x] ADR 0010 written, covering favorites removal, the v4 migration, categories removal and the flat front door, with the alternatives that were rejected
- [x] ADR 0011 written, recording the constant-`1.000` score evidence and the non-fractional relevance number
- [x] ADR 0012 written, stating what it supersedes in ADR 0003, the attestation-only narrowing, and why the abbreviated packument was rejected
- [x] Each ADR follows the format of the existing ADRs in this repo and is numbered consecutively
- [x] ADR 0003 notes that it is partially superseded by 0012
- [x] The glossary's Score entry is rewritten to describe an opaque relevance number used for tiebreaking
- [x] The glossary's Provenance entry is narrowed to the attestation
- [x] The glossary's Momentum entry makes the count primary and the arrow derived, and states the scoped-package gap
- [x] A Download count entry is added under the trust family
- [x] An Organize section is added with Bundle, Saved entry and Front door entries, cross-linked to related terms
- [x] Glossary entries for removed concepts (favorites, heuristic categories, the old Score framing) no longer describe behavior that does not exist
- [x] The glossary contains no implementation detail
- [x] `pnpm lint` passes (docs-only ticket — no changeset needed)
