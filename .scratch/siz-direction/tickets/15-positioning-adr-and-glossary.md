# 15 — Record the positioning: ADR and glossary

Labels: `wayfinder:task`
Status: open
Claimed by: —
Blocked by: 13

## What to do

Write the positioning down where the repo already keeps its decisions, so the next contributor — human or agent — inherits it instead of re-deriving it.

This is a `task`, not a decision: everything it records was decided in ticket 13 and its blockers. It earns its place on the route because the destination is "positioning **locked and recorded**", and an unrecorded decision is not locked.

- A new **ADR** in `docs/adr/` capturing the positioning decision: what siz is for, what was rejected (competing head-on with `ni`/`taze`, leading with interactive search), the evidence that drove it, and what would have to change for it to be revisited. Follow the numbering and the shape of the existing ADRs.
- **`CONTEXT.md` vocabulary** for the govern surface, in the established style — a definition, its relationships to existing terms via `[[...]]` links, and `_Avoid_` notes for the phrasings that would smuggle opinions back in. The exact term set comes from whatever tickets 05, 07 and 10 settled.
- A note in `CONTEXT.md` relating the govern surface to the existing **result signal** families, since it is the same facts with policy attached.
- Whether the frozen status of Discover and Organize belongs in an ADR too, so "no new work here" is a recorded decision rather than folklore.

## What would resolve this

The ADR merged and `CONTEXT.md` updated, with the terms actually used by the map's other resolved tickets. The README rewrite is **not** part of this ticket — that is a work item in the final spec, and it must not collide with the `optimization-pass` README rewrite still open in `.scratch/optimization-pass/`.

## Input from 05 (resolved 2026-08-05)

Ticket 05 settled the govern vocabulary, so three specific `CONTEXT.md` edits are now known rather than to-be-discovered:

- **Add "policy"** — the committed `siz.config.json` artifact as a whole.
- **Add "rule"** — one entry in its `rules` block, judging one package in isolation. Distinguish from a **budget** (judges the set; excluded from the vocabulary, see ticket 18).
- **Broaden the existing "dependency rule" entry** from "name globs" to "any rule", demoting today's meaning to the `name` rule specifically. Its `_Avoid_` line needs revisiting, since "constraint" and "permission" were ruled out against the narrower sense.

Note the word **predicate** must not appear in `CONTEXT.md` — it was this map's scratch term and 05 deliberately dropped it. It survives only in ticket 05's own filename and title.
