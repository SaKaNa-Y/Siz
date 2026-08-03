# MAP — Siz's direction: what this tool is for

Labels: `wayfinder:map`

## Destination

Siz's positioning **locked and recorded** — an ADR plus the `CONTEXT.md` vocabulary that goes with it — and, derived from it, a filed spec with numbered `ready-for-agent` issues for the phase of work that positioning implies. No implementation on this map: the last artifact is a spec someone can pick up, not a shipped feature.

## Notes

**Domain.** `siz` is an npm package CLI spanning three tracks — Discover, Organize, Manage — plus a Govern surface (dependency rules). Read `CONTEXT.md` for the glossary and `docs/adr/` for prior decisions before resolving any ticket; use that vocabulary in every answer. Conventions live in `docs/agents/`.

**Skills.** Every ticket resolves through `/grilling` and `/domain-modeling` unless its type says otherwise. `research` tickets go to a `/research` subagent; `prototype` tickets to `/prototype`.

**The working hypothesis this map tests.** Siz's differentiated surface is not its search box — it is that siz *fetches facts about packages* (license, install size, publish age, deprecation, provenance) and could therefore enforce a **committable policy** over those facts, both as a CI-gateable audit of what a project already has and as the install gate it already has. Evidence that shaped this: `nai`, the tool siz's interactive search is modelled on, has ~85 downloads/month after years, while every widely-adopted neighbour (`knip` 47M, `ni` 10M, `depcheck` 6.9M, `ncu` 3.3M, `taze` 344k, `npq` 39k) is non-interactive and CI-runnable. Siz itself: created 2026-05-30, 0 stars, ~200 downloads/month, no distribution attempt yet — so "nobody uses it" is not yet evidence about the product.

**Scope decisions already taken** (from the charting session, 2026-08-02):
- **Discover and Organize are frozen** — they keep working and stay documented, but no new feature work goes there and their speculative roadmap entries are candidates to drop. Nothing is deleted.
- **Audit depth starts at direct dependencies.** The transitive tree is a later, separate decision.
- **The `optimization-pass` effort lands first, untouched.** Its open issues 06–10 are cleanup of what exists and do not depend on positioning. No ticket on this map may edit the files they own.

**No spec exists yet, deliberately.** A PRD and eight implementation tickets for the govern feature were written ahead of this map and have been **deleted** — they were drafted before the absorption research ran, so their schema, scope and severities were guesses dressed as decisions. The spec gets regenerated from this map's findings by the final ticket. If you remember that document, do not reconstruct it from memory: it is not evidence.

**Querying this map.** Tickets are files under `./tickets/`. Open tickets are deliberately **not** listed in this map — find the frontier by looking for tickets whose `Status:` is not `closed` and whose every blocker is closed. Claim one by putting your name on its `Claimed by:` line *before* doing any work.

## Decisions so far

<!-- one line per closed ticket: enough to judge relevance, then open the ticket for the detail -->

- [02 — What would auditing the transitive tree actually cost?](tickets/02-transitive-audit-feasibility.md) — the axis is **disk-sourced vs registry-sourced facts**, not direct vs transitive: license/size/engines are free from disk for thousands of packages, but siz's differentiating facts (age, deprecation, provenance) are registry-only and would need ~2000 requests per run — a server's job, not a CLI's. Mid-size repos resolve to 1300–2500 packages. `core/packument.ts` is not the seed: it keys on name and `/latest`, an audit needs `name@version`.
- [03 — How does a tool know which dependencies a PR changed?](tickets/03-pr-scoped-diff-mechanics.md) — `--since` and a baseline are **complements**; build the baseline first. GitHub's own action uses the dependency-graph API and 403s on forks and non-GHAS private repos, which is siz's opening for a git-only mode. The basis is "run the dependency scan at two refs and diff", catalog included. New hole: predicates over time-varying facts mean a dependency can go deprecated with no diff, so `--since` alone stays green forever.
- [04 — What does shipping a shareable, extendable config commit you to?](tickets/04-shareable-config-prior-art.md) — composition and distribution are separable: relative-path `extends` is cheap and safe, npm-hosted packs carry a proven attack channel (CVE-2025-54313) and a permanent supply-chain position; resolution must be relative to the writing file; siz's allow/deny merge case is unprecedented in the prior art and wants asymmetric semantics.

## Not yet specified

Fog — in scope, headed toward the destination, but not yet sharp enough to ticket. Each patch graduates into tickets as the frontier reaches it.

- **Project-level budgets.** Aggregate ceilings (total install size, count of unmaintained deps, allowed license mix) rather than per-package predicates — a different mental model, and it depends on what the predicate vocabulary turns out to be.
- **A vulnerability predicate.** Whether advisory data belongs in the policy at all, given it means a new data source and a new trust relationship.
- **On-disk fact caching.** `name@version` is immutable so it can be cached forever (deprecation needs a TTL), but CI starts cold and CI is the case that motivates any of this. Whether siz grows a persistent cache at all, and where it lives. The narrower question of *name-keyed vs version-keyed* fetching is no longer fog — ticket 11 owns it.
- **Remediation depth.** Once "does siz form opinions" is settled, how far a suggestion goes — naming the maintainer's successor, a curated swap, an automated `--fix`.
- **Config back-compat and migration.** What existing `siz.config.json` users experience as the schema grows; whether anything is ever deprecated.
- **SPDX expression evaluation.** Whether compound license expressions are ever really evaluated rather than reported as unevaluated.
- **Effective-policy introspection.** A way to print the resolved policy siz is actually applying, and where each rule came from. Ticket 04 found this becomes non-optional the moment rules can come from more than one file ("why was this blocked?" is otherwise unanswerable), and that JSON-only config is what makes it cheap — it is the affordance ESLint's flat config lost and regretted. Sharpness depends on ticket 09's outcome: mandatory if inheritance ships, merely nice if not.
- **Where `siz why` sits.** The README's planned dependency-provenance explainer may belong to Govern rather than Manage, but only once Govern's shape is known.

## Out of scope

Ruled beyond this destination. These never graduate; they return only if the destination is redrawn, and then as a fresh effort.

- **Any implementation.** This map produces decisions and a spec. The build is a separate effort.
- **Deleting Discover or Organize.** Freezing was chosen over cutting: bundles ship a migrated schema v4 store, and the search box is the interactive on-ramp. Removing either would need its own migration and its own justification.
- **New Discover or Organize features.** AI-assisted search, the comparison view, export/import, team presets, seed-from-project. Which of these get formally dropped from the README is a ticket here; *building* any of them is not.
- **The `optimization-pass` issues 06–10.** A separate live effort that lands untouched.
- **Competing with `ni` or `taze` head-on.** Positioning siz as a better unified installer/upgrader was considered and rejected during charting: the only edge would be packaging, against 10M-download incumbents.
