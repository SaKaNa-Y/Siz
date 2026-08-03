# 17 — Does the audit ever leave direct dependencies?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 05, 11

## Question

Graduated from the map's fog by ticket 02, which found the question was framed on the wrong axis. It is not direct-versus-transitive — it is **disk-sourced facts versus registry-sourced facts**, and that makes the decision answerable.

The shape of the answer is now constrained by measurement rather than intuition:

- **A disk-sourced transitive audit is affordable.** License, install size and engines sit in each installed package's own `package.json`: roughly 1–2 seconds for 2000 packages, no network. Mid-size repos resolve to 1300–2500 packages.
- **A registry-sourced transitive audit is not.** Publish age, deprecation and provenance are registry-only, so covering them transitively means thousands of requests per run — which is a hosted service's economics, not a CLI's.

So the decision:

- **Does siz ship a transitive audit at all?** "No, permanently, and here is the sentence explaining why" is a legitimate and possibly better answer than a partial one — it draws a clean line against Socket-style products rather than competing badly with them.
- **If yes: is a predicate-subset audit explainable?** License and size apply transitively, age and deprecation and provenance do not. Earlier charting flagged exactly this as a hazard: *"a policy whose predicates have different scopes is hard to explain and easy to misread."* Is that hazard acceptable now that the reason is a hard cost rather than a preference?
- **Where does the package set come from?** Lockfile parsing is cheap for pnpm and npm, covered for yarn v1+berry by an existing parser, hand-rolled for `bun.lock`, and infeasible for `bun.lockb`. A `node_modules` walk is cheaper still but **fails silently under pnpm** — 18 visible entries against 274 real ones in this very repo. Silent wrong answers are worse than refusing to answer.
- **Does a bun user get a worse tool?** If `bun.lockb` cannot be read, the feature is unavailable for one supported package manager. Is that acceptable, or does it argue for the `node_modules` route with pnpm handled specially?
- **What does the report say about coverage?** If it audits 2000 packages for two predicates and 30 for five, the output must make that legible without a paragraph of explanation.
- **Does the install gate participate**, or is transitive strictly an audit-time concern?

## What would resolve this

A decision: never, disk-facts-only, or full. If anything ships, the package-set source with its per-package-manager verdicts, the predicate subset, how coverage is communicated, and whether the install gate is involved. If the answer is never, a recorded rationale sharp enough that the next person proposing it can see why — and a note for the positioning ADR, since "siz stops at what you declared" is a positioning statement, not just a scope limit.
