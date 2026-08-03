# 08 — Should the audit be able to scope itself to what a branch changed?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 03 (closed), 06

## Question

Ticket 03's research resolved the framing: `--since` and a baseline are **complements**, and the baseline is the one to build first. So this ticket is no longer "which mechanism" — it is whether the second mechanism is worth building, and exactly what it compares.

- **Is it worth it, given a baseline exists?** What `--since` adds is a sharp, low-noise PR comment with **zero persisted state** — nothing to commit, nothing to regenerate, no file to go stale. What it cannot do is catch a fact that changed without a diff. Is the ergonomic win worth a second mechanism to maintain?
- **The comparison basis is not "diff `package.json`".** The research's answer: run siz's existing dependency scan at two refs and diff the *results* — manifests **and** the pnpm catalog, since a catalog bump changes effective versions with no `package.json` diff at all. Confirm that is the basis, and that catalog coverage is in from the start rather than bolted on.
- **The escape hatch.** If `siz.config.json` changes in the same PR, the dependency diff is empty while the violating set has moved. A "config changed → full audit" rule is required. Is that rule automatic, or does it warn and let the user choose?
- **Failure posture.** The default GitHub PR job is `fetch-depth: 1` on `refs/pull/N/merge`, so the base SHA is not in the object store. The mode needs `fetch-depth: 0` or a targeted fetch, merge-base three-dot semantics, and — the important part — a **loud failure when the base is unresolvable**. Never a silent fall-back to a full audit, and never a false green. Which of those two failure modes is worse, and does the answer differ in CI versus local?
- **Empty diff.** When nothing dependency-related changed, the output must be cheap and quiet. What does it actually print, and does it still exit `0` visibly rather than silently?
- **Is it a flag or a mode?** And does it change the exit-code rule, or only the row set?
- **What siz should not copy.** GitHub's `dependency-review-action` uses the dependency-graph API — no git, no lockfile — and consequently 403s on forks and on private repos without Advanced Security, and 404s when the snapshot isn't indexed. A git-only mode works on forks, private repos, GHES, GitLab, and offline. Is that reach part of the pitch, or incidental?

## For the ADR

The research surfaced a reason siz *can* do this that belongs in the record: tools whose answer depends on the whole graph (Knip) cannot meaningfully diff-scope, while siz can, because **per-dependency verdicts are independent**. Semgrep and Codecov ship both mechanisms; ESLint ships baseline only; Jest diff only. Worth capturing so the design is understood as following from the domain rather than from fashion.

## What would resolve this

A decision — ship, defer, or drop — with the comparison basis, the config-changed rule, the unresolvable-base behaviour, the empty-diff output, and whether it is a flag or a mode. If deferred, recorded precisely enough that revisiting is cheap.
