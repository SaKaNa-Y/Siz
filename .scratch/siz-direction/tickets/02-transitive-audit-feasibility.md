# 02 — What would auditing the transitive tree actually cost?

Labels: `wayfinder:research`
Status: closed
Claimed by: research subagent (charting session, 2026-08-02)
Blocked by: none — can start immediately

## Question

Charting settled that the audit starts at **direct** dependencies. But a license or provenance audit that stops at direct deps is weaker than a full-tree scanner, and this is the most likely first extension — so the cost needs to be known before the shape is locked, not after.

- **Lockfile formats.** What does it take to read the resolved package set out of `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` (both v1 and berry), and `bun.lock`/`bun.lockb`? Are there maintained libraries for this, and do they cover all four, or does each need its own parser?
- **Volume.** For a realistic mid-size app, how many resolved packages are there versus declared ones — the multiplier that decides whether per-package packument fetches are viable at all.
- **Alternatives to fetching.** Reading installed `package.json` files off disk avoids the network entirely but requires a completed install and has to cope with pnpm's symlinked store layout. What do existing full-tree tools actually do?
- **Prior art.** How do `license-checker`, `npm ls`, socket.dev, and similar tools obtain their tree, and what do they give up for it?
- **Caching.** Is there a sane on-disk cache story for package facts, and what invalidates it?

## What would resolve this

A findings document with: a per-lockfile-format verdict (library available / hand-rolled / infeasible), the realistic package-count multiplier, a comparison of lockfile-versus-`node_modules` sourcing with the trade-off each forces, and a bottom line on whether transitive auditing is a **plausible later ticket** or a **different product**. That verdict graduates the transitive-scope fog on the map.

## Resolution

Findings: [`../research/02-transitive-audit-feasibility.md`](../research/02-transitive-audit-feasibility.md)

**The ticket asked the wrong axis.** It is not direct-versus-transitive. It is **disk-sourced facts versus registry-sourced facts** — and that reframing is the finding.

- **Transitive auditing is a plausible later increment if facts come from disk, and a different product if they come from the registry.** License, install size and engines all sit in each installed package's own `package.json`: free, offline, roughly 1–2 seconds for 2000 packages.
- **But siz's actual differentiators are registry-only.** Publish age, deprecation, provenance and momentum are not on disk. Auditing those transitively means ~2000 HTTP requests per run — which is a server, i.e. Socket's business model, not a CLI's.
- So "start at direct" was the right call, for a better reason than "start small": the direct set is the largest set siz can afford to fetch *registry* facts for.
- **Volume, measured on 9 real repos:** mid-size apps resolve to 1300–2500 packages (siz itself only 334). The direct-to-transitive *ratio* swings 17×–121×, so the absolute resolved count is the stable number to design against.
- **Lockfile verdicts:** pnpm trivial (the `yaml` dep is already present); npm trivial JSON; yarn v1+berry covered by `parseSyml` from `@yarnpkg/parsers`; `bun.lock` hand-rolled with an undocumented schema; `bun.lockb` infeasible without shelling out.
- **A lockfile gets you the set and nothing about it.** Only npm's lockfile carries `license` — verified, `grep -ci license pnpm-lock.yaml` returns 0.
- **The `node_modules` walk fails silently under pnpm**, which is the worst failure mode available: this repo's `node_modules` has 18 entries (direct only) while the real 274 live under `.pnpm`. Wrong answer, no error. That is why `pnpm licenses list` exists as a first-party command.
- **Caching is unusually favourable** — `name@version` is immutable, so cache forever (deprecation needs a TTL). But CI starts cold, and CI is the case motivating the feature.
- **`core/packument.ts` is not the seed of this.** It keys on package *name* and fetches `/latest`; any version-accurate audit needs `name@version` and `/<pkg>/<version>`. Two caches, two invalidation stories.

That last point converges with ticket 11's constraint: a version-keyed fact layer is what *both* policy-aware upgrade and any registry-sourced transitive audit would require. Ticket 11 owns that decision; ticket 17 (newly graduated) owns the transitive scope call.
