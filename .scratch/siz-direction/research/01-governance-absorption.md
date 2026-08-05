# 01 — Is dependency governance being absorbed by the package managers?

Research findings for wayfinder ticket `01-governance-absorption`.
Date: 2026-08-05. Synthesis of three parallel research passes; the detail, per-tool tables and primary-source citations live in:

- [`01-parts/a-package-managers.md`](01-parts/a-package-managers.md) — pnpm, npm, yarn, bun, deno
- [`01-parts/b-bots-and-vendors.md`](01-parts/b-bots-and-vendors.md) — Renovate, Dependabot, `dependency-review-action`, socket.dev, Snyk, Sonatype/Mend/JFrog, OpenSSF Scorecard, allstar
- [`01-parts/c-oss-tools.md`](01-parts/c-oss-tools.md) — npq, license-checker lineage, knip, depcheck, dependency-cruiser, ncu, taze, sandworm-audit, osv-scanner, OWASP Dependency-Track, ESLint approaches

This document answers only the ticket's closing question: **which parts of the hypothesised policy surface are already available to a team that installs nothing new, and which are genuinely absent?** Everything here is traceable to a primary source in one of the three parts.

---

## The direct answer

**The hypothesis survives, but two of its six fact families have been absorbed and must be dropped from the differentiation claim.**

| Fact family | Already available to a team that installs nothing new? | Where |
| --- | --- | --- |
| **Publish age / release recency** | **Yes — absorbed, ecosystem-wide, during 2025–2026** | pnpm `minimumReleaseAge` (v10.16, **on by default since v11**), npm `min-release-age` (11.10.0, Feb 2026), yarn `npmMinimalAgeGate` (Berry 4.10), bun `install.minimumReleaseAge` (1.3). All committable, all real install-time gates. |
| **Provenance / attestation** | **Largely — as a separate check, not an install gate** | `npm audit signatures --include-attestations`; pnpm `trustPolicy` (gates *regression* in trust tier, not absence); npq's `provenance` marshall does full attestation verification. |
| **License** | **Partly, but only at PR time and only on GitHub** | `actions/dependency-review-action` (`allow-licenses`/`deny-packages`, free on public repos, GHAS-gated on private, PR-diff only). `license-checker` exits non-zero but its whole lineage is sunsetting. `osv-scanner --licenses`, `dependency-cruiser`'s `license`/`licenseNot`. **No package manager enforces license at all** — pnpm ships `pnpm licenses list`, a report. |
| **Deprecation** | **Barely — warn-only where it exists** | Every PM warns and none gates; pnpm's `allowedDeprecatedVersions` exists purely to *mute* the warning. `ncu --no-deprecated` and `osv-scanner` gate it for their own narrow purposes; npq gates it at install. |
| **Install size** | **No — total whitespace** | No PM, no bot, no vendor at any price. Only third-party Bundlephobia CLI wrappers (single-fact, maintenance unverified). |
| **Maintenance staleness** | **No — and the ecosystem's age logic runs the wrong direction** | Every tool that reasons about age uses it to *delay adoption of new things* (cooldown / `minimumReleaseAge`). Nothing forbids a dependency for being *old and abandoned*. OpenSSF Scorecard's `Maintained` check and Socket's signals are informational scores, not thresholds. |

So: **publish age is genuinely absorbed and provenance nearly so. License is well-served but only in one deployment shape. Deprecation-as-a-gate, install size, and maintenance staleness are unclaimed.**

---

## The four structural findings that matter more than the table

The per-fact table is the shallow reading. The absorption question turns out to be answered less by "which facts are checked" — most facts are checked by *something* — than by four structural boundaries every existing tool sits on one side of.

### 1. The gap is the seam, not the fact

A team wanting "no GPL, nothing unpublished in 3 years, nothing deprecated, nothing over 5MB" today stitches together: `license-checker-rseidelsohn` (or its named successor `@lizenz/checker`) + `ncu --cooldown` or `taze --maturity-period` + `dependency-cruiser`'s `deprecated` type or `osv-scanner` + a Bundlephobia CLI wrapper + npq for provenance + **nothing at all** for graded staleness. That is five-plus tools, five-plus invocations, and five config surfaces — CLI flags, `.ncurc`, `taze.config.ts`, environment variables, `.dependency-cruiser.js` — sharing no schema, no cache, and no exit code.

**The absent thing is one file, one schema, one exit code across the families — not any individual predicate.**

### 2. Update-shaping is not admission control, and the bots cannot cross that line

Renovate and Dependabot are mature, free, and **structurally incapable** of gating presence. Every knob — `packageRules`, `allowedVersions`, `minimumReleaseAge`/`cooldown`, `matchConfidence`, `allow`/`ignore`, `ignoreDeps` — governs only the bot's own proposed PRs. Neither can stop a human hand-adding a disallowed package, because neither has an admission-control hook: their entire model is "propose a branch a human merges." This is not a missing feature; it is the shape of the product.

### 3. Every tool picks *audit what's there* **or** *gate what's coming* — never both from one artifact

- `dependency-review-action` gates presence for real (a required status check that fails on `allow-licenses`/`deny-packages`/severity) — but **only on PRs that touch the manifest**. Nothing already merged is ever audited, and a repo without the ruleset configured bypasses it.
- `sandworm-audit` audits an already-resolved project with `--fail-on` conditions — but is not an install interceptor, and has been dormant since 2023-10-24.
- Snyk's license policy can fail a build, but the policy itself lives in the SaaS dashboard and is **Enterprise-only**; `.snyk` can only *ignore* already-flagged issues.
- OWASP Dependency-Track is a genuine multi-fact OSS policy engine — and is a self-hosted server whose policy lives in a database behind a web UI, the opposite ergonomics from a committed file.

**Dual-mode from one committed artifact — audit the existing tree and gate the incoming install — is unoccupied.**

### 4. Yarn constraints, the only real policy *language* in a PM, provably cannot see any of these facts

Yarn's `defineConstraints` in `yarn.config.cjs` is the closest thing to a policy engine any package manager ships, and its docs are explicit that it supports exactly two targets: workspace dependencies and arbitrary `package.json` fields, with transitive dependencies **out of scope, "PRs welcome."** It cannot reach a license, a publish date, a deprecation flag, or an unpacked size — not because it lacks a predicate, but because none of those facts exist in a workspace manifest. It is the right *shape* with no access to the data. That is a precise statement of the gap: the facts are registry- or disk-sourced, and the PM policy engines are manifest-scoped.

---

## The competitor the map did not name: npq

`npq` ([lirantal/npq](https://github.com/lirantal/npq), `3.23.3` published 2026-07-23, ~8k weekly downloads, actively maintained) is materially closer to siz's proposition than the map's hypothesis allows for. It runs 15 "marshalls" and already covers **four of the six families** — license (presence only), publish age, deprecation, provenance (full attestation verification) — and, importantly, **it already does the dual mode**: run `npq` with no `install` subcommand from a project directory and it audits declared dependencies instead of wrapping a package manager.

What npq lacks, precisely:

1. **No committable file.** Its entire configuration surface is environment variables — one `MARSHALL_DISABLE_*` per marshall — and its thresholds (22 days, 20 downloads/month, 7-day version maturity) read as hardcoded. A reviewer cannot open a PR diff and see the team's dependency policy.
2. **No install size** signal at all.
3. **No graded maintenance staleness** — only a binary dormant-maintainer heuristic inside one marshall.
4. Its audit mode reads **declared `package.json` deps**, not a lockfile-resolved tree.

The map's hypothesis is right that the gap exists, but it is narrower than "siz fetches facts nobody else fetches." The honest claim is: **npq proved the fact-checking; nobody has made the policy committable, and nobody covers size or staleness.**

---

## What this does to the map

**It does not invalidate the map. It narrows the claim and removes two predicates from the differentiation story.**

- **Positioning must not lead with publish-age gating.** It is the one thing the ecosystem converged on natively, and pnpm's is on by default. A siz release-age predicate would be restating a rule the user's package manager already enforces better.
- **Positioning must not lead with provenance** either. npm and pnpm both ship verification; npq verifies attestations.
- **The defensible ground is:** (a) *one committable file, one schema, one exit code* across families; (b) **install size** as a policy predicate, which literally nothing surveyed exposes; (c) **maintenance staleness as an admission rule**, which requires inverting the ecosystem's cooldown logic; (d) **dual-mode** — audit the merged tree *and* gate the install — which every tool surveyed picked one half of; (e) **committable, not dashboard-hosted**, which is where every commercial answer differs.
- **Deprecation and license sit in between:** both are covered by *something*, neither by a package manager, and license only at PR time on GitHub. They belong in the policy for completeness, but they are table stakes rather than the wedge.

Prior art worth copying rather than inventing: pnpm's `audit:` block in `pnpm-workspace.yaml` (a committable severity threshold plus an ignore list) is almost exactly the shape siz's policy file needs, and pnpm shipped it first for CVEs. `renovate.json`'s preset mechanism and `allstar`'s org-config-plus-repo-override shape are the two most-studied precedents for whatever ticket 09 decides about inheritance.

---

## Open threads this raises

- **Delegation vs duplication.** `ncu` and `taze` both *inherit* the package manager's own `minimumReleaseAge`/`npmMinimalAgeGate`/cooldown setting rather than defining a competing one. If siz has an age predicate at all, the same question applies — and it generalises to any predicate a PM absorbs later. Recorded as fog on the map; the predicate vocabulary (ticket 05) has to settle before it is sharp.
- **`dependency-review-action` is the incumbent for PR-scoped license gating** and it is free on public repos. Ticket 08 needs to answer siz's PR-scoped story against it specifically, not against a vacuum.
- **Unverified corners**, carried forward honestly: yarn's consumption-side provenance verification (no equivalent to `npm audit signatures` found); whether `osv-scanner.toml` can express its license allowlist in-file or only as a flag; whether `docs.sandworm.dev` documents a config-file mode; Snyk's actual Team-tier pricing (conflicting third-party figures, no public rate card); the maintenance currency of the Bundlephobia CLI wrappers. None is load-bearing for the conclusion above.
