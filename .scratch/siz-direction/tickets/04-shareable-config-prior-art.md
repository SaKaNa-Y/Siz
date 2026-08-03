# 04 — What does shipping a shareable, extendable config commit you to?

Labels: `wayfinder:research`
Status: closed
Claimed by: research subagent (charting session, 2026-08-02)
Blocked by: none — can start immediately

## Question

Shareable policy packs (`extends: "@ourorg/siz-policy"`) are the one idea on this map with a network effect: one org writes a policy, every repo inherits it. They are also the idea most likely to drag in a decade of other people's pain.

- **eslint** is the canonical case, and it changed its answer once (eslintrc `extends` → flat config). What went wrong with the first design, and what does the flat-config model do differently?
- **Resolution.** How is an extended config located — Node resolution from the config's own location, from the project root, something bespoke? What breaks under pnpm's strict `node_modules`?
- **Precedence and merging.** How do shareable configs merge with local overrides, especially for array-valued settings like allow/deny lists where "merge" and "replace" are both defensible?
- **Security.** A config that can be `extends`-ed from npm is code (or data) executing policy decisions. What is the trust model — does eslint/prettier/tsconfig treat these as trusted, and has that been exploited?
- **The JSON-only constraint.** Siz's config is deliberately plain JSON. Does `extends` work at all without allowing JS configs, and what do TypeScript's `tsconfig.json` `extends` and Prettier's shareable configs do about exactly this?

## What would resolve this

A findings document covering each point with primary sources, ending with: the minimum viable `extends` design that stays JSON-only, its resolution rule, its merge semantics for lists, and an explicit statement of what siz would be signing up to maintain forever. Feeds the policy-packs decision ticket.

## Resolution

Findings: [`../research/04-shareable-config-prior-art.md`](../research/04-shareable-config-prior-art.md)

**The headline: composition and distribution are separable, and only the second half is dangerous.** Relative-path `extends` delivers the monorepo case with almost no cost. npm-hosted packs deliver the org-wide network effect this ticket cared about — and that is the part carrying a proven attack channel and a permanent supply-chain position.

What the research settled:

- **Resolution has one right answer**, unanimous across the prior art: resolve every entry relative to the directory of the file that *wrote* it — never project root, never cwd. eslintrc got this right for `extends` and wrong for `plugins`, and that asymmetry is the bug that made presets require hand-installed peer deps for years.
- **pnpm is the discriminator.** "Resolve from project root" works by accident under npm hoisting and fails hard under pnpm's strict layout; the ecosystem workarounds for this are all bad.
- **Arrays replace, they don't append** — universally. But siz's case is *unprecedented*: no surveyed tool has a two-list allow/deny predicate under inheritance. Recommendation is deliberately asymmetric — `deny` unions (a silent deny-shrink is the fail-open direction ADR 0001 rejects), `allow` replaces (unioning silently widens permission and can't express "narrow the pack's allowlist"), and un-denying must be an explicit subtractive key rather than a side effect.
- **The trust model is: there isn't one.** Two real incidents — eslint-config-eslint (2018, token theft) and eslint-config-prettier (July 2025, CVE-2025-54313, ~78M weekly downloads). Renovate, the closest analogue and the one running JSON-only policy data at scale, is **deprecating its npm-hosted presets** in favour of local references.
- **JSON-only buys less safety than it looks.** Both payloads ran at *install* time, not parse time. So the JSON constraint protects against nothing if the pack arrives from npm; its security value only holds for relative paths or fetched data.
- **JSON-only `extends` does work** — tsconfig proves it — but Prettier deliberately refused a JSON-level `extends`, requiring a JS config and a spread instead.
- **Recommended MVP:** relative-path-only, string-or-array from day one, resolved from the config's own directory, cycle-detected, later-wins, fail-closed on an unresolvable entry, with effective-policy introspection shipped in the *same* release rather than later.
- **Eight permanent obligations** are enumerated in §7. The sharpest: wrong merge semantics fail *silently* — a user whose deny list quietly stopped applying doesn't file a bug, they ship a denied package. Neither ESLint nor TypeScript could reverse their resolution decision cheaply.

This ticket asked a research question, so it decides nothing. Ticket 09 makes the call, now with a much sharper choice than "extends: yes or no".
