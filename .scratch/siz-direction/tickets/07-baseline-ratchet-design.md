# 07 — How does a real repository adopt a policy it currently fails?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 05, 06

## Question

Any policy enabled on an existing project fails on day one. If the only options are "fix 40 things now" or "don't adopt", nobody adopts. So the ratchet is not a feature — it is the adoption mechanic, and its details decide whether it works.

- Where does the accepted set live, what is it called, and is it committed?
- What identifies an accepted finding? Include the observed value and the file churns on every publish; exclude it and a violation getting *worse* stays accepted. Which failure is worse?
- Are accepted findings hidden, or shown-but-not-fatal? (Hiding debt makes it invisible; showing it makes the report noisy again.)
- How does the accepted set shrink — reported as stale, pruned automatically, or manually curated?
- How does a user regenerate it, and what stops "regenerate" from becoming the standard response to any failure?
- How does this interact with a PR-scoped `--since` check? **Ticket 03 answered this: complements, and the baseline is the one to build first.** Two reasons it is load-bearing rather than merely convenient: it is the only mechanism covering **time-varying facts** (a dependency becomes deprecated with no diff at all, so a changed-only mode stays green forever), and it works on push, cron and local runs where there is no base ref to diff against. Does that change how much design effort this deserves?
- Does the ratchet apply to the install gate too, or only to the audit?

## What would resolve this

An agreed baseline design: file location and name, the identity rule with its trade-off consciously chosen, the visibility rule, the shrink mechanism, the regeneration command, and a stated relationship to PR-scoped checking. Vocabulary added to `CONTEXT.md` in the destination ticket.

## Input from 05 (resolved 2026-08-05)

Ticket 05 gave every rule a per-rule **`ignore`** list (glob array, scoped to the rule rather than global, so an exception cannot hide a package's *other* violations) and deliberately left one question to this ticket: **do `ignore` entries carry a reason or an expiry, or stay bare globs?** The ratchet is the case that actually needs that provenance, so it is yours to settle — note that JSON cannot carry a comment, which is the strongest argument for an object form.

Two other 05 decisions shape the adoption story:

- **Severity defaults to `error` when a rule is configured at all**, and `warn` exists explicitly for the repo that currently fails a rule and is climbing out. So there are already *two* adoption mechanisms in play — `warn` and a baseline — and this ticket should say when each is the right one rather than assuming the baseline is the only answer.
- **Budgets are excluded from the rule vocabulary** and are ratchet-shaped by nature (nobody sets an aggregate ceiling from zero). Whatever baseline mechanism this ticket lands is the thing ticket 18 would build on.
