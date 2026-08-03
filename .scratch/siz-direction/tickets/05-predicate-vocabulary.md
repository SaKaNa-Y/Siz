# 05 — What can a policy actually say?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
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
