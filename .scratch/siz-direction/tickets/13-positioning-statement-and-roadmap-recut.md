# 13 — What is siz, in one sentence, and what does the roadmap become?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 01, 05

## Question

The destination ticket writes this down; this ticket decides it.

- **Who is siz for?** Name the user concretely enough to reject features. "npm users" rejects nothing.
- **What is the one sentence?** The README currently opens with "Simpler package zearch — a smarter npm package search and management CLI" and then a three-layer feature checklist. If the spearhead is govern, that sentence is wrong. What replaces it?
- **What is siz's relationship to `ni` and `taze`?** Today the README leads with being inspired by and borrowing from them, which invites the comparison siz loses. Is the honest framing "the govern layer your existing tools don't have", and does siz still claim the install/upgrade surface at all?
- **What happens to the three-layer Discover / Organize / Manage framing?** Is it still how siz explains itself, or is it internal architecture that stopped being the pitch?
- **The roadmap re-cut.** The README's Features list carries `Next` / `Later` / `Maybe` entries across all four layers. Which drop to out-of-scope, which stay, which get promoted? Specifically: AI-assisted search, the comparison view, ships-types signal, lighter-alternative suggestions, export/import bundles, seed-a-bundle-from-project, team presets, search history, `siz run`, `siz x`, clean/frozen install, interactive uninstall picker, `siz why`, per-package upgrade modes, license policy rules, vulnerability scan.
- **Is the name still right?** "Siz" encodes "package zearch" — a premise this map may have just demoted. Renaming a published package is expensive; ignoring a wrong name is also expensive.

## What would resolve this

An agreed positioning statement, a stated relationship to the neighbouring tools, a verdict on the three-layer framing, and a re-cut Features roadmap with each listed entry explicitly kept, demoted, or dropped. The naming question answered even if the answer is "keep it, and here's why".

## Input from 01 (resolved 2026-08-05)

Two constraints on the sentence, from the absorption research:

- **Do not lead with release-age or provenance gating.** Both are absorbed — pnpm's release-age gate is on by default since v11 and npm/yarn/bun all shipped equivalents. Claiming them reads as ignorance of the ecosystem.
- **`npq` is the named competitor** (actively maintained, ~8k weekly downloads) and already covers four of the six fact families *and* runs as a standalone audit. The differentiation against it is precise and small: a committable policy file (npq is environment-variables-only), install size, and graded staleness.

The defensible ground 01 identified: one committable file / one schema / one exit code across families; install size as a predicate (nothing surveyed exposes one); staleness as an admission rule (inverts everyone's cooldown logic); dual-mode audit-and-gate (every tool surveyed does one half); committable rather than dashboard-hosted (where every commercial answer differs).
