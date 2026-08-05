# 05 — What can a policy actually say?

Labels: `wayfinder:grilling`
Status: closed
Claimed by: wayfinder session, 2026-08-05
Blocked by: 01

## Question

The policy vocabulary is the load-bearing decision of the whole govern direction: every other ticket either renders it, enforces it, ratchets it, or shares it. What predicates exist, how are they written, and what do they mean at the edges?

- Which facts become predicates — and which of the ones siz already fetches deliberately do **not**?
- Does every predicate carry a severity, and what is the default when a predicate is configured at all?
- What happens when a predicate needs a fact siz could not fetch? One candidate answer — "unknown, never a violation, reported in its own bucket" — follows the unknown-vs-finding distinction ADR 0009 already draws for the license signal. It needs arguing rather than inheriting: the install path and the CI path may deserve different answers, since failing a build and blocking a developer working offline have different costs.
- How do the existing `rules.allow` / `rules.deny` name lists relate to the new vocabulary — hoisted into it, kept beside it, or deprecated? What does an existing user's config do after upgrading?
- Is a malformed or unrecognized predicate a hard error? (ADR 0001's fail-closed posture says probably, but "unknown key" and "malformed JSON" are not obviously the same case.)
- How are limits written — human strings like `"5MB"` / `"2y"`, raw numbers, both?
- Does the vocabulary stay flat, or does it need composition (any/all, per-dependency-type scoping, exceptions per package)?
- **Does every predicate need a declared merge rule?** Ticket 04's research found that if config inheritance ever ships, each key needs its own documented merge semantics at the moment it is added — and getting one wrong fails *silently*, because a rule that quietly stopped applying produces no error, just a package that got through. That is an argument for deciding each predicate's merge rule as part of defining it, even if inheritance is deferred.
- Where does the line sit between a predicate and a **budget** (per-package limit versus project aggregate)?

## Why this is grilled and not just written

A complete answer to all of the above was drafted once already, before the absorption research existed, and was deleted for that reason. The vocabulary is the decision every other ticket inherits, so it is worth arguing from evidence rather than from a plausible first draft. Ticket 01's findings are the input: a predicate a package manager already enforces natively may not be worth siz having at all.

## What would resolve this

An agreed predicate vocabulary and config schema, with the unknown-fact rule, severity defaults, back-compat behaviour, and error posture all settled and their rationale recorded. Named using `CONTEXT.md` vocabulary, or extending it deliberately.

## Input from 01 (resolved 2026-08-05)

Ticket 01 found **publish age absorbed ecosystem-wide** (pnpm's `minimumReleaseAge` is on by default since v11; npm, yarn and bun all ship equivalents, all committable, all real install-time gates) and **provenance nearly so** (`npm audit signatures`, pnpm `trustPolicy`, npq's provenance marshall). Both were assumed predicates in the map's hypothesis. Deciding whether they stay in the vocabulary — restated, delegated to the PM's own setting the way `ncu` and `taze` do, or dropped — is now this ticket's problem, and the answer generalises to any predicate a PM absorbs later.

Conversely, **install size** and **maintenance staleness as an admission rule** are enforced by nothing surveyed at any price. Note that staleness inverts the ecosystem's age logic: every existing tool uses age to *delay adoption of new things* (cooldown), never to *forbid old, abandoned ones*.

Shape prior art: pnpm's `audit:` block in `pnpm-workspace.yaml` — a committable severity threshold plus an ignore list — is close to what this vocabulary needs, and pnpm shipped it first for CVEs.

## Resolution (grilling session, 2026-08-05)

### Naming

`siz.config.json` is the **policy**. Each entry in its `rules` block is a **rule**. "Predicate" was this map's scratch word and does **not** enter the product vocabulary. `CONTEXT.md`'s **dependency rule** broadens from "name globs" to "any rule"; today's meaning demotes to the `name` rule specifically.

### The six rules

| Rule | Fact source | Rule keys | Fires when |
| --- | --- | --- | --- |
| `name` | — | `allow`, `deny` (globs) | deny wins — unchanged from today |
| `license` | packument | `allow`, `deny` | declared license matches `deny`, or misses a non-empty `allow` |
| `installSize` | packument | `max` | `dist.unpackedSize` exceeds `max` |
| `stale` | fast-npm-meta | `max` | latest publish older than `max` |
| `deprecated` | fast-npm-meta | — | fact **present** |
| `provenance` | fast-npm-meta | — | fact **absent** |

Every rule additionally accepts `severity`, `scope`, `ignore`. That is the entire grammar — no nesting, no composition. `name` takes no `ignore` (its `allow` already is one).

```json
{
  "rules": {
    "name":        { "deny": ["left-pad"] },
    "license":     { "allow": ["MIT", "Apache-2.0"], "scope": "prod" },
    "installSize": { "max": "5MB", "ignore": ["typescript"] },
    "stale":       { "max": "2y", "severity": "warn" },
    "deprecated":  "error",
    "provenance":  "off"
  }
}
```

### The absorption rule (generalises beyond this ticket)

**Siz defines a rule when the question is "what is in this project," and delegates when the question is "may this version be adopted right now."** Audit-shaped facts are siz's; install-moment version gates are the package manager's.

This splits 01's "publish age" into two facts wearing one name, and only kills one of them:

- **Release-age cooldown** ("don't adopt a version published < N days ago") is action-shaping, the PM owns that moment, and pnpm's is on by default. **Delegated — siz never defines it.**
- **Maintenance staleness** ("don't *have* a dependency abandoned for 2 years") is admission control over the existing tree, the mode 01 found unoccupied. **Siz's, and arguably the wedge.**

Provenance is **kept** despite near-absorption, on a different argument: `npm audit signatures` verifies but is not a *committable* policy, and 01's differentiation claim is "one file, one schema, one exit code across the families." A hole in the file costs more than the redundancy.

Accepted cost: `siz.config.json` will carry a staleness rule and **no** cooldown rule, so a reader cannot see the team's full incoming-version policy in one place.

### Inclusion criterion, and what it excludes

> A fact earns a rule when it is (a) sourced deterministically from the registry or disk, (b) cheap enough to fetch for every direct dependency in cold CI, and (c) a property of the *package* that a project can defensibly require. Facts failing any of these stay Discover-only result signals.

- **Bundle size — out.** Fails (a) and (b): third-party (Bundlephobia), rate-limited, already fetched lazily for the focused row only and deliberately kept out of `--list`/`--json` to stay CI-safe. A rule that goes red because someone else's server is down is worse than no rule.
- **Weekly downloads and momentum — out.** Fails (c). Popularity is not a property a project can defensibly *require*; as policy it forbids new and niche packages for being new and niche, and its verdict changes under you as strangers install things. npq hardcodes a 20-downloads/month threshold — copying it while fixing the config file would inherit the wrong half.

### Placement and back-compat

`rules` **extends in place**; every key is a rule. Legacy `{ "rules": { "allow": [...], "deny": [...] } }` is read as the `name` rule — a **permanent alias**, never deprecated, never warned about. An existing user's file stays valid verbatim after upgrading.

Rejected: a second `policy` block beside `rules` (two blocks doing one job, able to contradict each other) and a migration into one (a breaking change to a committed file, unjustifiable for a `0.x` tool with no adoption pressure).

### Severity

Every rule carries one. **Default `error` when the rule is configured at all** — writing a rule into a committed file *is* the act of opting in, and a policy that reports violations while exiting `0` destroys the "one exit code" claim that is the differentiation. `warn` stays available explicitly and earns its keep for ticket 07's adoption case.

Values `"error" | "warn" | "off"`, which gives the ESLint-style bare-string shorthand for free. An absent key means the rule does not run; `"off"` exists so an *inherited* rule can be switched off explicitly.

**Severity attaches to the rule, not the finding** — pnpm's `audit:` block has a global threshold because CVEs arrive pre-graded by someone else; siz's facts are not graded. There is no global threshold key.

**Boolean rules carry an implied polarity in the key name** (`deprecated` fires on presence, `provenance` on absence). Accepted over explicit `requireProvenance` naming to preserve key-equals-fact-name symmetry; documented per rule.

### Unknown facts

**Unknown is never a violation, on any path. It is reported in its own bucket.** Reuses ADR 0009's unknown-vs-finding distinction and `core/packument.ts`'s contract that a name appears in the returned map iff its packument resolved.

- **Install guardrail** — unknown never blocks, no flag. A developer offline must be able to install, and the install path is not the compliance record. A guardrail failing closed on *network conditions* trains people to reach for `--no-rules`.
- **Audit (`siz check`)** — exits `0` by default with unknowns bucketed, plus **one global opt-in** (working name `--fail-on-unknown`; ticket 06 owns the final name) for hermetic CI. Without it, a run that silently could not fetch facts is a policy that quietly stopped applying — 04's silent-failure mode.

**No per-rule unknown handling.** Unknownness is one failed packument taking out `license` and `installSize` together; a per-rule knob prices a distinction that does not exist in practice.

**An unclear license is a finding, not an unknown** (ADR 0009). `UNLICENSED` / `SEE LICENSE IN …` evaluates normally and correctly fails `license.allow: ["MIT"]`.

### Limits

**Human strings only — no raw-number alternative.** Two spellings of one value is the ambiguity the pitch exists to remove; a bare `5242880` needs a unit that is not in the file.

- **Bytes**: `B`, `kB`/`KB`, `MB`, `GB`, **base-1000**, matching `formatBytes` in `core/size.ts`. Case-insensitive prefix, whitespace tolerated.
- **Duration**: `d`, `w`, `mo`, `y` — `mo` explicit because `m` is ambiguous; matches `formatPublishAge`.

An unparseable limit is a **hard config error**, not a skipped rule.

Noted, not fixed here: `HEAVY_INSTALL_BYTES` is `1024 * 1024` (binary) while `formatBytes` is base-1000. Harmless for an editorial glyph, but the config parser must be decimal — it has to agree with the numbers a user is reading when they choose a limit. Aligning the constant is a cleanup for another effort.

### Error posture

**Anything siz cannot fully understand aborts.** One posture, three classes, differing only in message: malformed JSON (already implemented), unrecognized key (`Unknown rule "instalSize" — did you mean "installSize"?`), wrong shape or value.

Forward-compatibility loses here: a silently ignored rule is a policy that quietly stopped applying, failing invisibly. ESLint and `tsc` both error on unknown keys and are the closer analogues. Mitigations: the unknown-key error carries a forward-compat hint naming the running version; `$schema` stays tolerated and ignored; the vocabulary is small and closed by design.

Asymmetric by design: **`--no-rules` bypasses a broken config on the install path** (`commands/install-rules.ts:18` returns before `loadRules`, so this already holds), and **the audit has no bypass** — "the policy file is broken" is exactly what CI exists to catch.

### Composition

**Flat. No `any`/`all`, no nesting, no per-package limit overrides — ever.** Boolean composition turns a config into a language needing precedence rules, expression-tree error messages, and an introspection command. Yarn constraints is 01's cautionary tale: a real policy language with no access to the facts. Siz is its inverse — dumb structure, rich facts.

Two per-rule modifiers, because without them people disable rules wholesale:

- **`ignore`** (glob array, per rule). Every policy meets a package it must permit anyway; without an exception the only move is disabling the rule, trading one known violation for unlimited unknown ones. Matches pnpm's `audit:` prior art (threshold + ignore list). Scoped per rule deliberately — a global ignore would hide a package's *other* violations. Whether entries carry a reason or an expiry is **ticket 07's** call, since the ratchet is what needs that provenance.
- **`scope`**: `"prod" | "dev" | "all"`, **default `all`** uniformly. A 20 MB dev tool is fine; a 20 MB runtime dependency is not — every license tool ships `--production`. `all` is not the *useful* default for `license`, but choosing `prod` there would be siz forming an opinion, which is **ticket 10's** decision.

### Merge semantics

Declared now, per key, whether or not ticket 09 ships inheritance — a column in the spec today, unrecoverable later (changing a merge rule changes what existing files mean without changing a byte).

| Key | Merge |
| --- | --- |
| `severity`, `max`, `scope` | child **replaces** |
| `deny`, `ignore` | **union** |
| `allow` | **intersection** |

Principle: **a child may weaken the policy, but only by saying so.** Scalars replace freely — `"license": "off"` is explicit, local, greppable. Lists never replace, because a list *looks additive*: a child writing `deny: ["moment"]` and silently dropping the parent's `deny: ["left-pad"]` is the classic `extends` footgun and is invisible in review. `allow` intersects because an allow-list restricts by complement, so composing two means keeping only what both permit. This is the asymmetry 04 predicted.

Consequence to state plainly in the ADR: **siz's `extends` is a convenience, not a control.** A child can always loosen what it inherits. An inheritance chain that tries to be a security boundary is a different product — 01 already found what that looks like (OWASP Dependency-Track: a self-hosted server with the policy in a database behind a web UI).

**Standing rule: every future rule ships with its merge rule declared in the commit that adds it.**

### Rule vs budget

**A rule judges one package in isolation; a budget judges the set.** Test: *if evaluating it requires knowing about any package other than the one being judged, it is not a rule.*

Budgets are **excluded from this vocabulary** and, if ever built, get their own top-level block — never a key inside `rules`. Three reasons:

1. **Verdict shape differs.** A rule violation names a package and a remedy; a budget violation names the project and answers no question about what to do — different output, so it cannot ride the reporting path ticket 06 designs.
2. **The install path cannot carry them.** "Does this package pass" is one packument; "would adding this push us over" needs the whole tree, destroying install latency — so budgets would be audit-only, breaking the dual-mode symmetry 01 identified as the differentiation.
3. **Budgets are ratchet-shaped.** Nobody sets an aggregate budget from zero; they set it at current-plus-headroom, which depends on ticket 07's baseline.

### Two consequences recorded, not separately decided

- `license.allow` / `license.deny` match the declared string with the **same glob engine `name` uses** (`globToRegExp`), so `GPL-*` works. **Compound SPDX expressions are not evaluated** — `(MIT OR GPL-3.0)` is matched as text. The map's "SPDX expression evaluation" fog patch stays open rather than being resolved by accident here.
- `name` takes no `ignore`.

### Handoffs

- **06** — owns the unknown bucket in the output and the final name of `--fail-on-unknown`; the audit has no `--no-rules` equivalent.
- **07** — owns whether `ignore` entries carry a reason or an expiry.
- **09** — inherits the merge table above; `extends` is explicitly non-binding.
- **10** — owns whether `license.scope` defaults to `prod` rather than the uniform `all`.
- **15** — `CONTEXT.md` gains **policy** (the file) and **rule** (one entry), and its existing **dependency rule** entry broadens.
