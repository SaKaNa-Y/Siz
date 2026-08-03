# 01 — Is dependency governance being absorbed by the package managers?

Labels: `wayfinder:research`
Status: open
Claimed by: research subagent (charting session, 2026-08-02)
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
