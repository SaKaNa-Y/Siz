# 03 — How does a tool know which dependencies a PR changed?

Labels: `wayfinder:research`
Status: closed
Claimed by: research subagent (charting session, 2026-08-02)
Blocked by: none — can start immediately

## Question

A PR-scoped audit (`--since <ref>`) is the single biggest lever on whether anyone leaves a policy check enabled: it turns a 400-line report on a legacy repo into a two-line comment about what this branch introduced. But "what did this PR change, dependency-wise" is less obvious than it sounds.

- **GitHub's own `dependency-review-action`** does exactly this. How does it determine the diff — the dependency graph API, lockfile parsing, something else — and what does it require of the repo?
- **Git-only approaches.** Is diffing the `package.json` at two refs enough to be useful, and what does it miss (a lockfile-only change, a transitive addition, a catalog bump)?
- **Interaction with a baseline.** A ratchet file and a `--since` diff solve overlapping problems. Do tools ship both, and how do they explain the difference to users?
- **CI ergonomics.** What ref is actually available in a GitHub Actions PR context, and what does shallow cloning break?
- **Prior art in adjacent tools.** How do `knip`, `eslint`, and coverage tools scope themselves to changed files, and does any of that transfer?

## What would resolve this

A findings document stating: how `dependency-review-action` works and what it needs; whether a `package.json`-diff-at-two-refs approach is sufficient for siz's direct-dependency scope, with its blind spots enumerated; the practical CI requirements; and a recommendation on whether `--since` and a baseline are complements or substitutes. Feeds the PR-scoped design ticket.

## Resolution

Findings: [`../research/03-pr-scoped-diff-mechanics.md`](../research/03-pr-scoped-diff-mechanics.md)

**Verdict: a `--since` mode and a baseline are complements, not substitutes — and if only one is built, build the baseline.**

- **`dependency-review-action` parses nothing.** It makes one call to GitHub's dependency-graph compare API. No git, no lockfile reading, `fetch-depth` irrelevant.
- **And that is siz's opening.** It 403s on forks and on private repos without GitHub Advanced Security, and 404s when the graph snapshot isn't indexed. A git-only `--since` works on forks, private repos, GHES, GitLab, and offline.
- Its one real edge is transitive visibility, which comes purely from lockfile parsing. Its response carries no direct/transitive distinction and no `modified` change type — a version bump appears as a removal plus an addition.
- **The comparison basis for siz is not "diff `package.json`".** It is *run the existing dependency scan at two refs and diff the results* — manifests **and** the pnpm catalog, because a catalog bump changes effective versions with zero `package.json` diff.
- **Most blind spots are not new costs.** Lockfile-only changes and transitive additions are already excluded by ADR 0004's range-floor choice and the direct-only scope.
- **One genuinely new hole:** siz's predicates are over **time-varying facts**. A dependency becomes deprecated with no diff at all, so `--since` stays green forever. No git trick fixes this — which is precisely why the baseline is the load-bearing mechanism and `--since` is the ergonomic one.
- **Second hole:** if `siz.config.json` changes in the same PR, the dependency diff is empty while the violating set has moved. Needs an explicit "config changed → full audit" escape hatch.
- **Prior art:** Semgrep and Codecov ship both mechanisms; ESLint ships baseline only; Jest diff only; Knip neither — Knip *cannot* diff-scope because its answer depends on the whole graph. **Siz can, because per-dependency verdicts are independent.** That contrast belongs in the ADR.
- **CI reality:** the default PR job is `fetch-depth: 1` on `refs/pull/N/merge`, so the base SHA isn't in the object store. A `--since` mode needs `fetch-depth: 0` or a targeted fetch, merge-base three-dot semantics, and a **loud** failure when the base is unresolvable — never a silent full audit, never a false green.
