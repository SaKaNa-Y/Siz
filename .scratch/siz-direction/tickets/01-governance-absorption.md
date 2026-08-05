# 01 — Is dependency governance being absorbed by the package managers?

Labels: `wayfinder:research`
Status: closed
Claimed by: research subagents (wayfinder session, 2026-08-05) — re-claimed; the charting session's run produced no findings file
Blocked by: none — can start immediately

## Question

The whole map rests on one bet: that a committable policy over package facts, enforced in CI and at install, is a real gap. How much of that gap is already closed — natively by the package managers, or commercially by existing products?

Specifically:

- **pnpm** has been shipping govern features into the package manager itself (`minimumReleaseAge`, `onlyBuiltDependencies`, and whatever else its recent settings surface now covers). What exactly can pnpm enforce today from `pnpm-workspace.yaml` / `package.json` settings, with no extra tool?
- **npm** and **yarn** and **bun** — what policy-ish knobs exist (`--before`, audit signatures, resolution restrictions, yarn constraints, `bun pm` settings)? Yarn's **constraints** feature is the closest thing to a policy engine in a package manager and needs a proper look.
- **Renovate** and **Dependabot** — both let you write rules about what may be updated. How far do those rules reach into "what may be *present*", and do people already use them as de-facto dependency policy?
- **socket.dev**, **snyk**, and equivalents — what do they cover, what do they charge, and what is their free/OSS tier? These are the commercial answer to the same question.
- **npq**, **license-checker**, **knip**, **depcheck** — precise scope of each, so the differentiation claim in the map's hypothesis is accurate rather than convenient.

## Why it gates everything

This is the one ticket whose findings could invalidate the map. If a policy over license, size, age, deprecation and provenance is mostly expressible in pnpm settings plus a Renovate config, then the differentiated slice is much narrower than the hypothesis assumes, and positioning must be rewritten before it is written.

## What would resolve this

A findings document that, for each item above, states what it can enforce, what it cannot, and where the boundary sits — with links to primary sources (docs, release notes, RFCs), not blog summaries. Ending with a direct answer to: **which parts of the hypothesised policy surface are already available to a team that installs nothing new, and which are genuinely absent?**

## Comments

### Resolution — 2026-08-05

Findings: [`research/01-governance-absorption.md`](../research/01-governance-absorption.md), synthesised from three parallel research passes kept as appendices under [`research/01-parts/`](../research/01-parts/) (a: package managers, b: bots and vendors, c: OSS tools). Every claim below is traceable to a primary source in one of those.

**The hypothesis survives, but two of the six fact families are absorbed and must leave the differentiation claim.**

- **Publish age is absorbed, ecosystem-wide, during 2025–2026.** pnpm `minimumReleaseAge` (v10.16, **on by default since v11**), npm `min-release-age` (11.10.0, Feb 2026), yarn `npmMinimalAgeGate` (Berry 4.10), bun `install.minimumReleaseAge` (1.3). All committable, all real install-time gates. A siz release-age predicate would restate a rule the user's package manager already enforces better.
- **Provenance is nearly absorbed** — `npm audit signatures --include-attestations`, pnpm `trustPolicy`, and npq's provenance marshall all verify it.
- **License, deprecation, install size, maintenance staleness are not enforced by any package manager.** pnpm ships `pnpm licenses list` — a report, not a gate. Deprecation only ever warns; pnpm's `allowedDeprecatedVersions` exists purely to *mute* that warning. Install size is total whitespace across every tool surveyed, free or Enterprise. Maintenance staleness has no native concept anywhere.

**Four structural findings that matter more than the per-fact table:**

1. **The gap is the seam, not the fact.** Most facts are checked by *something*. Approximating the hypothesised policy today means five-plus tools across five config surfaces (CLI flags, `.ncurc`, `taze.config.ts`, env vars, `.dependency-cruiser.js`) sharing no schema, no cache, no exit code. What is absent is one file, one schema, one exit code.
2. **Renovate and Dependabot are structurally incapable of admission control.** Every knob shapes only the bot's own PRs; neither can stop a human hand-adding a disallowed package. Not a missing feature — the shape of the product.
3. **Every tool picks *audit what's there* or *gate what's coming*, never both from one artifact.** `dependency-review-action` gates presence for real but only on PRs touching the manifest; `sandworm-audit` audits only, and is dormant since 2023; Snyk's license policy is Enterprise-only and dashboard-hosted; OWASP Dependency-Track is a genuine multi-fact OSS policy engine but is a self-hosted server with policy in a database. Dual-mode from one committed file is unoccupied.
4. **Yarn constraints — the only real policy language in a package manager — provably cannot see any of these facts.** The docs are explicit: two targets only (workspace dependencies, `package.json` fields), transitive deps out of scope. Right shape, no access to the data. That is the gap stated precisely: the facts are registry- or disk-sourced, and PM policy engines are manifest-scoped.

**The competitor the map did not name: `npq`.** Actively maintained (`3.23.3`, 2026-07-23, ~8k weekly downloads), covers **four of the six families** (license-presence, publish age, deprecation, provenance), and already does dual mode — run it with no `install` subcommand and it audits the project instead of wrapping the package manager. What it lacks precisely: configuration is **environment variables only**, one per marshall, with hardcoded thresholds and no committable file; no install size at all; only a binary dormant-maintainer heuristic for staleness; and its audit reads declared `package.json` deps, not a resolved tree.

**Verdict for positioning:** do not lead with release-age or provenance. The defensible ground is (a) one committable file, one schema, one exit code across families; (b) **install size** as a policy predicate, which nothing surveyed exposes; (c) **maintenance staleness as an admission rule**, which requires inverting the ecosystem's cooldown logic — every tool that reasons about age uses it to delay *new* things, never to forbid *old* ones; (d) dual-mode audit-and-gate; (e) committable rather than dashboard-hosted. License and deprecation belong in the policy but are table stakes, not the wedge.

**Prior art to copy rather than invent:** pnpm's `audit:` block in `pnpm-workspace.yaml` (committable severity threshold + ignore list) is almost exactly the shape siz's policy file needs. `renovate.json` presets and `allstar`'s org-config-plus-repo-override are the two best-studied precedents for ticket 09's inheritance question.
