# 09 — Should a policy be shareable across repositories?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 04 (closed), 05

## Question

Ticket 04's research reframed this. The original framing was "does siz support `extends`?" — the real question is which of **two separable things** siz ships, because they have wildly different costs:

- **Composition** — relative-path `extends` (`"./policies/base.json"`). Delivers the monorepo case, needs no resolution algorithm beyond path joining, is immune to the supply-chain attack class entirely, and is forward-compatible.
- **Distribution** — npm-hosted packs (`"@ourorg/siz-policy"`). This is the org-wide network effect that made the idea attractive, and it is the half carrying a proven attack channel and a permanent supply-chain position.

So:

- **Is composition worth shipping on its own?** It gives up the network effect this ticket was originally interested in. Who benefits — is siz's plausible user a monorepo with several `package.json` files wanting one shared base policy, or a single-repo user for whom `extends` is pure overhead?
- **Is distribution worth its cost?** Weigh against: both known shareable-config incidents ran their payload at **install** time, so siz's JSON-only config buys no protection; and Renovate — the closest analogue, running JSON-only policy data at scale for years — is **deprecating** its npm-hosted presets in favour of local references. There is also a self-consistency problem: a tool whose pitch is fetching provenance and trust signals about third-party packages, receiving its own policy from an unpinned third-party package.
- **If distribution, in what form?** npm packs with the exposure accepted and documented, or Renovate-style `github>` / `https://` fetching of config *data* — which dodges install scripts but adds a network dependency, a cache, and an offline story to a tool that today reads one local file.
- **Merge semantics.** The research found siz's case is unprecedented: no surveyed tool has a two-list allow/deny predicate under inheritance. Its recommendation is deliberately asymmetric — `deny` unions, `allow` replaces, un-denying requires an explicit subtractive key. Is that right, and is asymmetry explainable to users, given ESLint's three-implicit-behaviours-for-one-key is the cited anti-pattern?
- **Can a shared policy be loosened locally?** A policy an individual can relax is not a policy; one they cannot is one they bypass with `--no-rules`. This is the same question the subtractive key raises, from the user's side.
- **Timing.** Is any of this needed before a first release of the govern surface? This may be the cleanest thing on the map to defer — and deferring composition is cheap, since adding it later is additive.
- **The obligation nobody wants.** §7 of the findings lists eight permanent commitments; the sharpest is that wrong merge semantics fail *silently* — a user whose deny list stopped applying ships a denied package rather than filing a bug. Is a project at siz's current scale willing to own that?

## What would resolve this

A decision on each half separately — composition and distribution — with, for whatever ships: the resolution rule, merge semantics per list, the override direction, the loosen-locally answer, the trust posture, and the release it lands in. "Neither, and here's what we'd need to see first" is a fully acceptable outcome and should be recorded as such rather than left implicit.

## Input from 05 (resolved 2026-08-05)

**Merge semantics are already decided — this ticket inherits them rather than choosing them.** Ticket 05 took 04's finding seriously (a merge rule got wrong fails *silently*) and fixed the table at the moment the vocabulary was defined, whether or not inheritance ever ships:

| Key | Merge |
| --- | --- |
| `severity`, `max`, `scope` | child **replaces** |
| `deny`, `ignore` | **union** |
| `allow` | **intersection** |

Principle: *a child may weaken the policy, but only by saying so.* Scalars replace freely (`"license": "off"` is explicit, local, greppable); lists never replace, because a list looks additive and a silently dropped parent entry is invisible in review. This is the asymmetry 04 predicted.

Two consequences for this ticket:

- The **loosen-locally question is answered**: yes, a child can always loosen. 05 records `extends` as **a convenience, not a control** — an inheritance chain that tries to be a security boundary is a different product (01 found it: OWASP Dependency-Track, a self-hosted server with the policy in a database). If this ticket wants to overturn that, it must say so explicitly.
- **Every future rule ships its merge rule in the commit that adds it.** That is now a standing rule of the vocabulary; if inheritance ships, this ticket should make it a documented contribution requirement rather than a convention.
