# Research — 03: How does a tool know which dependencies a PR changed?

Resolves ticket [`../tickets/03-pr-scoped-diff-mechanics.md`](../tickets/03-pr-scoped-diff-mechanics.md).
Researched 2026-08-02. All claims below are traced to a primary source (official docs, action source, or the git manual); every URL is listed in **Sources** at the end. Where I am reasoning rather than citing, the paragraph says so.

---

## 1. GitHub's `dependency-review-action`: how it actually works

### 1.1 It does not parse anything. It asks a server.

The action performs **zero lockfile parsing and zero git diffing**. It makes one paginated REST call:

```ts
// src/dependency-graph.ts
'/repos/{owner}/{repo}/dependency-graph/compare/{basehead}'
// basehead: `${baseRef}...${headRef}`
```

That is the whole mechanism. `octo.paginate` walks the pages (`per_page: 5`), each page body is validated with `ChangesSchema.parse(response.data)`, and a base64 header `x-github-dependency-graph-snapshot-warnings` is decoded and returned alongside the changes. There is no `try`/`catch` in that module — HTTP retries come from composing the Octokit retry plugin, and everything else propagates.

The endpoint is [`GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}`](https://docs.github.com/en/rest/dependency-graph/dependency-review), documented as returning "the diff of the dependency changes between two commits of a repository". Each element of the response array is:

| field | values |
| --- | --- |
| `change_type` | `added` \| `removed` — **there is no `modified`** |
| `manifest` | path of the manifest the dependency belongs to |
| `ecosystem`, `name`, `version`, `package_url` | identity |
| `license`, `source_repository_url` | facts, sourced from ClearlyDefined |
| `vulnerabilities[]` | `severity`, `advisory_ghsa_id`, `advisory_summary`, `advisory_url` |
| `scope` | `unknown` \| `runtime` \| `development` |

Two consequences worth naming, because siz would inherit or reject them:

- **A version bump is reported as a `removed` + an `added` pair**, not as one change. The action's renderer only knows those two glyphs and throws `` `Unexpected change type: ${changeType}` `` on anything else.
- **There is no direct/transitive field in the response schema.** `scope` (runtime/development/unknown) is the only partition offered. The dependency-graph ecosystem table does say npm/pnpm/Yarn get `direct` and `transitive` labels applied by static analysis, but that classification is not surfaced in the comparison payload's documented schema. So a consumer of this API cannot cheaply say "only the direct deps changed" — which is precisely siz's declared audit scope.

### 1.2 Which refs it compares

From `src/git-refs.ts`, verbatim in behaviour:

1. `config.base_ref` / `config.head_ref` (the `base-ref` / `head-ref` action inputs) **take priority**; the event-derived defaults are only consulted when *both* are absent (`if (!base_ref && !head_ref)`).
2. `pull_request` and `pull_request_target` → `pull_request.base.sha` and `pull_request.head.sha` from the event payload.
3. `merge_group` → `merge_group.base_sha` and `merge_group.head_sha`.
4. Any other event → nothing is populated, and the run fails with a message beginning "Both a base ref and head ref must be provided…".

Note what this means: the action reads SHAs **out of the webhook payload**, not out of the local git object store. It never runs a git command, so `fetch-depth` is irrelevant to it. It also joins the two SHAs with `...`, and the API docs say that for *named* revisions "an appropriate merge base will be determined" — but `base.sha` is already a resolved SHA, so no merge-base resolution happens. Whatever staleness is baked into `pull_request.base.sha` is baked into the diff.

### 1.3 What it requires of the repository

This is the part that matters most for siz's positioning, because it is a wall:

- **Public repos: fine.** **Private repos: require a GitHub Advanced Security licence.** The API returns **403** for "a private repository when GitHub Advanced Security is not enabled, **or if used against a fork**".
- **The dependency graph must be enabled.** It is off by default on forked repositories — the long-standing complaint in [actions/dependency-review-action#164](https://github.com/actions/dependency-review-action/issues/164), which is why the action's 403 handler now links to the repo's `settings/security_analysis` page.
- **The snapshot must already be indexed** for both SHAs. If it is not, you get a 404 and `"Dependency review could not obtain dependency data for the specified owner, repository, or revision range."` The mitigation is the `retry-on-snapshot-warnings` input, which polls every 10 s (`retryDelay: 10`) up to `retry-on-snapshot-warnings-timeout` seconds and then logs `"Retry timeout exceeded. Proceeding..."` and continues with what it has.
- **GHES needs GHAS + GitHub Connect**, and licence data is unavailable there entirely — `allow-licenses`, `deny-licenses`, `allow-dependencies-licenses`, `retry-on-snapshot-warnings*` and `show-patched-versions` are all documented as unsupported on GHES.
- Permissions: `contents: read`, plus `pull-requests: write` for `comment-summary-in-pr`. `repo-token` is `required: true` — the Octokit client is built at module load, so a missing token throws during initialisation.

**Read this as competitive intelligence, not just mechanics.** The single most-cited PR-scoped dependency tool is unavailable on a private repo without GHAS and returns 403 on forks. A git-only `siz check --since` has no such gate: it works on private repos, on forks, on GHES, on GitLab, and offline on a laptop. That is not a small differentiator.

### 1.4 What its data source can and cannot see

The graph is built from files it parses ([supported ecosystems](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/dependency-graph-supported-package-ecosystems)): for npm/pnpm/Yarn the *recommended* file is the lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) with `package.json` as an "additional file". The docs say the lockfiles spell out "which versions are used for all direct and all indirect dependencies". So the action's superpower over a git-only approach is exactly one thing: **it sees transitive changes, because it reads the lockfile.** Note also that pnpm is explicitly marked *not* supported for "Automatic dependency submission" — for pnpm the graph comes from static lockfile parsing only.

---

## 2. The git-only approach: is diffing declared dependencies at two refs enough?

### 2.1 For siz specifically, it is not merely "enough" — it is the only coherent option

Three decisions already on record make this near-determined:

- **Audit depth starts at direct dependencies** (MAP, scope decisions from the 2026-08-02 charting session). The transitive tree is a separate, later decision.
- **Current is the range floor, not the installed version** (ADR 0004, `CONTEXT.md` → *Current (range floor)*). siz deliberately does not read `node_modules` or the lockfile — that is what lets `siz outdated` run on a fresh checkout before install.
- **The dependency scan** (`CONTEXT.md`) already defines "what a project's dependencies are" as: the discovered manifests (nearest `package.json`, or workspace members when recursive) plus the nearest pnpm catalog, reduced to a deduped set of upgradable names.

Given those, the honest framing is: **the comparison basis for `--since` is not "diff package.json" — it is "run the existing dependency scan at two refs and diff its output."** Every blind spot of that approach is a blind spot siz has *already chosen*, with one exception (§2.3, item 3).

### 2.2 The catalog is not optional

`siz` reads `pnpm-workspace.yaml`, and it must, because of how catalogs work. Per [pnpm's docs](https://pnpm.io/catalogs), a manifest entry reads `"react": "catalog:"` and "This is equivalent to writing a version range (e.g. `^18.3.1`) directly"; the actual range lives in `pnpm-workspace.yaml`. `catalog:` also supports named catalogs and is stripped on `pnpm publish`/`pack`.

So: **a catalog bump changes the effective version of a dependency in N packages while changing zero `package.json` files.** A naive `git diff base...head -- '**/package.json'` sees nothing at all. This is the one blind spot a git-only design must *not* inherit, and siz is unusually well placed to avoid it — `core/catalog.ts` already parses those blocks. The comparison basis must be *manifests **and** catalog*, at both refs.

(GitHub's dependency graph presumably catches catalog bumps via `pnpm-lock.yaml`, where versions are resolved. I did not find a primary source confirming how the graph handles the `catalog:` specifier in `package.json` itself; treat that as unverified.)

### 2.3 Enumerated blind spots of a declared-deps-at-two-refs diff

Ordered by how much they should worry the design.

1. **Lockfile-only changes are invisible.** `pnpm update` inside an existing `^` range, a `pnpm-lock.yaml` regeneration, a resolution change forced by a peer — none of these touch a declared range. *Severity for siz: low by construction.* ADR 0004 says siz's "current" is the range floor; a lockfile-only change does not move the range floor, so it cannot change a policy verdict siz is capable of forming. This blind spot is a restatement of an existing decision, not a new cost.

2. **Transitive additions are invisible.** A direct dep bumps a caret range and drags in 40 new packages, one of them AGPL. *Severity: low today, by the direct-only scope decision; high the day that decision is revisited.* Worth recording explicitly in the ADR so that "revisit transitive scope" is understood to also mean "revisit the comparison basis".

3. **Facts change without any ref changing. This is the real blind spot.** siz's policy predicates are over *facts fetched from the registry* — deprecation, publish age, licence, install size. Those are time-varying, not ref-varying. A dependency nobody touched can go deprecated on Tuesday; on Wednesday the project is out of policy and a `--since` run is green, because the diff is empty. No amount of git cleverness fixes this, and it is the single strongest argument that `--since` cannot be the *only* mechanism (§4).

4. **A rule change re-scopes the whole audit, but the dep diff is empty.** If the PR tightens `siz.config.json` — adds a `deny` glob, lowers a licence tolerance — then the set of violating dependencies changes with no dependency change at all. A changed-only mode must special-case this: **if `siz.config.json` differs between the refs, degrade to a full audit.** (`dependency-review-action` has no analogue of this problem because its policy lives in workflow inputs, re-read every run.)

5. **Workspace membership changes.** A PR that adds a new workspace package adds a whole new `package.json` that a single-file diff would miss, and one that deletes a member should not report its deps as "removed violations". The comparison must be over the *discovered manifest set* at each ref, not a fixed path list.

6. **Non-registry specifiers.** `workspace:`, `catalog:`, npm aliases, `git`/`file`/`link`, URLs — already excluded by `isUpgradableSpecifier()`. Consistent between the two refs, so they simply do not appear in the diff. Fine; just be sure a spec change *into* or *out of* one of these forms (`^1.0.0` → `file:../local`) is reported as removed rather than silently dropped.

7. **Range-shape churn without a semantic change.** `^18.2.0` → `>=18.2.0 <19` is a textual change with (almost) the same meaning. Diffing raw range strings will flag it. Diffing *comparison facts* (range floor, latest, leading operator — the `core/compare.ts` outputs) would not. Cheap improvement, worth taking.

8. **Squash-merge / rebase histories.** After a squash merge, the base branch contains no commit matching the PR's head; a subsequent `--since main` on a follow-up branch computes a merge base that may be much older than the author expects. Not a correctness bug, but it inflates the "changed" set.

### 2.4 Implementation shape (git plumbing, not a checkout)

The naive route — `git worktree add` at the base ref and re-run the scan — works and correctly handles added/removed workspace members, but it mutates the filesystem. The cleaner route reads blobs directly:

```
git ls-tree -r --name-only <base> | grep -E '(^|/)(package\.json|pnpm-workspace\.yaml)$'
git show <base>:<path>
```

That enumerates the manifest set at the base ref and reads each one without touching the working tree, and it composes with the existing pure parsers (`core/project.ts`, `core/catalog.ts`) if they can be fed content rather than a path. Whether they currently can is an implementation question for the design ticket, not a research question.

---

## 3. Prior art: do tools ship both a baseline and a changed-only mode?

| Tool | Changed-only mode | Baseline / suppressions file | Ships both? |
| --- | --- | --- | --- |
| **Semgrep** | `--baseline-commit <sha>` (diff-aware scan) | `.semgrepignore`, `nosemgrep` comments | **Yes** |
| **ESLint** | — | `eslint-suppressions.json` (`--suppress-all`, `--suppress-rule`, `--prune-suppressions`) | No — baseline only |
| **Codecov** | `codecov/patch` status | `codecov/project` with `threshold` (a soft ratchet) | **Yes** |
| **Jest** | `--changedSince <ref>`, `--onlyChanged`, `--lastCommit` | — | No — diff only |
| **Knip** | — | — | Neither |
| **dependency-review-action** | the whole product | — | No — diff only |

### 3.1 ESLint — the canonical baseline, and how it explains itself

The [suppressions docs](https://eslint.org/docs/latest/use/suppressions) frame the problem exactly as this map's: enabling a rule as `"error"` on a mature codebase "becomes harder and harder … as the codebase grows", and fixing everything first is impractical because new violations appear while you work. The solution is stated in one sentence: **"While the rule will be enforced for new code, the existing violations will not be reported."**

Four design details worth stealing wholesale:

- `eslint --fix --suppress-all` — the docs *recommend pairing with `--fix` first*, so auto-fixable problems get repaired rather than "silently entombed". A siz equivalent would suggest a fix pass before freezing.
- The file (`eslint-suppressions.json`, project root) is **meant to be committed** "so that the suppressions are shared with all the developers".
- **Staleness is an error by default.** When you genuinely fix a suppressed violation, ESLint exits non-zero with "There are suppressions left that do not occur anymore." `--prune-suppressions` cleans them; `--pass-on-unpruned-suppressions` opts out of the failure. This is what makes a baseline a *ratchet* and not a graveyard.
- Only `"error"`-level rules are eligible — warnings are never suppressed.

Note what ESLint does **not** ship: any `--since`. Its answer to "don't fail on inherited debt" is entirely the baseline.

### 3.2 Semgrep — ships both, and the two do different jobs

Semgrep's diff-aware scan runs `--baseline-commit <ref>` and, per its docs, effectively "runs two scans — one on the PR and another on the codebase before the PR — so only new findings are reported". It uses `git diff` with `--merge-base` "to correctly calculate the diff based on where the current tree branched from the baseline". It aborts if you are not in a git directory, if there are unstaged changes, or if the baseline hash does not exist.

Alongside that, `.semgrepignore` and `nosemgrep` comments persist as the suppression mechanism. The two coexist because they answer different questions: `--baseline-commit` answers *"is this change clean?"*, the ignore file answers *"is this finding accepted?"*. Semgrep is the closest structural analogue to what siz is contemplating, and its answer is unambiguously "both".

### 3.3 Codecov — the clearest articulation of the split

Codecov ships two commit statuses and explains the difference in one line each:

- `codecov/project` "measures overall project coverage and compares it against the base of the pull request or parent commit."
- `codecov/patch` "**only** measures lines adjusted in the pull request or single commit".

And the *defaults in its own examples* are the tell: project uses `threshold: 5` (tolerate a small regression), patch uses `threshold: 0%` (tolerate nothing on newly touched lines). That is exactly the "inherited debt tolerated, new debt not" policy, expressed as two checks with different strictness rather than one check with a diff filter. `target: auto` compares against the base commit's coverage — a ratchet computed at runtime instead of committed to a file, which is a third design point on the same axis.

### 3.4 Jest and Knip — the negative results

Jest's `--changedSince <branch|hash>` is a clean git-scoped mode, and its documented caveat is a useful warning: **"If the current branch has diverged from the given branch, then only changes made locally will be tested."** Same merge-base semantics, same trap.

Knip is the more interesting negative result, because it is the closest tool to siz in shape (project-level dependency linting, 47M downloads). Its [CLI reference](https://knip.dev/reference/cli) lists no `--since`, no git-diff scoping, and **no baseline or suppressions file** — the scoping knobs are `--workspace`, `--directory`, `--include`/`--exclude`, `--tags`. The structural reason is stated in its own docs: Knip's answer depends on the whole module graph, so analysing a subset of files changes the *answer*, not just the *report*. Siz does not have that problem — a per-dependency policy verdict is genuinely independent per dependency, which is what makes diff-scoping sound here where it is unsound for Knip. That is a real argument in siz's favour, and it is worth writing down in the ADR.

---

## 4. CI ergonomics: what refs exist, and what shallow cloning breaks

### 4.1 The default state of a `pull_request` job is hostile to `--since`

Three documented facts compose badly:

1. `GITHUB_REF` for an unmerged PR is **`refs/pull/<pr_number>/merge`** — the merge commit, not the PR head. (`GITHUB_REF_NAME` is `<pr_number>/merge`.)
2. `actions/checkout` defaults to **`fetch-depth: 1`** — "Only a single commit is fetched by default, for the ref/SHA that triggered the workflow."
3. `GITHUB_BASE_REF` gives you only the **branch name** (`main`), not a SHA, and is only set for `pull_request`/`pull_request_target`.

So in a default PR job, `git rev-parse origin/main` and `git cat-file -e <base.sha>` both fail: the base commit is not in the local object store. Semgrep's KB documents this exact failure — `git cat-file -e REF` → `Not a valid object name REF` — and prescribes `fetch-depth: 0`.

### 4.2 The three viable fixes, cheapest last

- **`fetch-depth: 0`.** The boring, universally-documented answer; what Semgrep's canonical workflow uses. Cost: full history clone on every run, which on a large repo is the slowest step in the job.
- **Targeted fetch.** `git fetch --no-tags --depth=1 origin +${{ github.event.pull_request.base.sha }}:refs/siz/base` brings in exactly the one commit. Cheap and sufficient if you diff against `base.sha` directly rather than computing a merge base. Note that a true merge base needs shared ancestry, which a depth-1 fetch of an unrelated tip does **not** provide — so this trades merge-base correctness for speed.
- **Skip git entirely.** Read the base manifests over the GitHub Contents API. Correct and shallow-clone-proof, but it introduces a token requirement and a network dependency into a command whose whole appeal is that it runs anywhere — the opposite of the positioning in §1.3. Do not make this the default.

The recommendation for siz's docs: **`--since` should fail loudly with an actionable message when the base ref is not resolvable locally**, naming `fetch-depth: 0`, rather than silently falling back to a full audit (which would produce the 400-line report the feature exists to prevent) or to an empty diff (which would produce a false green). Semgrep's abort-on-missing-baseline behaviour is the right precedent.

### 4.3 `base.sha` is not the merge base

The event payload's `pull_request.base.sha` is the base branch tip as recorded in the payload; if `main` has advanced since, diffing against it attributes other people's merged commits to this PR. `git diff A...B` is the fix — the [git manual](https://git-scm.com/docs/git-diff) states it "is equivalent to `git diff $(git merge-base A B) B`", showing "changes that occurred on the master branch since when the topic branch was started off it". `--merge-base` is the explicit spelling of the same thing. Semgrep uses it; `dependency-review-action` does **not** (it hands two raw SHAs to the API). Siz should use three-dot/merge-base semantics and say so.

A tempting shortcut: on the default merge-commit checkout, `HEAD^1` is the base branch tip. I did not verify that the parent objects are actually present at `fetch-depth: 1` (a shallow clone grafts the boundary, so the parent SHA is *named* but its tree may not be fetched). Treat as unverified; do not build on it without testing.

---

## 5. Recommendation

### 5.1 `--since <ref>` and a committed baseline are **complements, not substitutes**

They fail in different directions, and each covers the other's failure:

**What `--since` alone cannot do.** It is blind to time-varying facts (§2.3 item 3) — the deprecation that lands on an untouched dependency produces no diff and therefore no finding, forever. It produces no artifact a reviewer can see, so "how much debt do we have?" is unanswerable without a separate full run. It is meaningless on `push`-to-main, on `schedule`, and on a laptop, where there is no natural base ref — which is to say, it does not deliver "don't fail on inherited debt" for most of the ways a check actually gets run. And it silently degrades to a false green whenever CI is misconfigured (§4.2).

**What a baseline alone cannot do.** It requires a write to the repo before the check can be enabled, and a re-write every time a violation is legitimately accepted — friction at exactly the adoption moment. It cannot distinguish "this PR added a denied package" from "this PR is the first run after a rule change"; both show up as a mass of unsuppressed findings. And on a large legacy repo the initial file is enormous, which is its own adoption tax.

**Together** they cover the goal cleanly: the baseline defines *inherited* (frozen, reviewable, prunable, works on every event type), and `--since` defines *this change* (zero-state, sharp PR comment, cheap to try before committing anything). This is what Semgrep ships and what Codecov ships in a different vocabulary; ESLint ships only half and Jest ships only the other half.

**If forced to pick one to build first: the baseline.** It alone satisfies the literal goal on every trigger, needs no CI configuration, and has no false-green mode. `--since` is the better *demo* and the better PR comment, but it is the more fragile mechanism and it depends on CI setup siz does not control. Ship the baseline, then add `--since` as the PR-ergonomics layer on top of it — at which point the two compose as: *report findings that are (not in the baseline) AND (attributable to this diff)*, with the baseline still enforced repo-wide on push.

### 5.2 Minimum viable comparison basis

> Run siz's existing **dependency scan** at each of two refs and diff the results.
>
> A **unit** is `(manifest path | catalog name, dependency name)`. Its **value** is the declared range, normalised through the registry-comparison facts (range floor + leading operator) rather than compared as a raw string.
>
> A unit is **introduced by this change** when it is absent at base and present at head, or when its normalised value differs. Removals are reported but never fail.
>
> The base ref resolves via **merge base** (`git diff base...head` semantics), not the raw payload SHA.
>
> **Escape hatch:** if `siz.config.json` differs between the two refs, the diff is discarded and a full audit runs.
>
> Manifests and the pnpm catalog are read out of git objects (`git ls-tree` + `git show`), not a second checkout, so the working tree is untouched and added/removed workspace members are handled by construction.

### 5.3 Blind spots of that basis, enumerated

1. Lockfile-only changes — invisible. Consistent with ADR 0004 (range floor, never the installed version).
2. Transitive additions — invisible. Consistent with the direct-only scope decision; revisit *both* together.
3. **Facts that change with time rather than with the diff** (a dep goes deprecated, a new licence appears on the same range). Unfixable by any diff; this is what the baseline exists for.
4. Rule tightening in the same PR — handled only by the §5.2 escape hatch; if that hatch is not built, this is a silent gap.
5. Squash/rebase histories inflate the merge base and therefore the changed set.
6. Fork PRs and shallow clones — a resolvable-base precondition that must fail loudly, not silently.
7. Range-shape churn with no semantic change — mitigated, not eliminated, by comparing comparison facts instead of raw strings.
8. Specifier transitions into non-registry forms (`^1.0.0` → `file:../x`) need explicit handling or they vanish from both sides of the diff.

---

## Sources

Primary sources, all fetched 2026-08-02.

**dependency-review-action / GitHub API**
- `src/dependency-graph.ts` — https://raw.githubusercontent.com/actions/dependency-review-action/main/src/dependency-graph.ts
- `src/git-refs.ts` — https://raw.githubusercontent.com/actions/dependency-review-action/main/src/git-refs.ts
- `src/main.ts` — https://raw.githubusercontent.com/actions/dependency-review-action/main/src/main.ts
- README (inputs, requirements, GHES limits) — https://raw.githubusercontent.com/actions/dependency-review-action/main/README.md
- REST: dependency review compare endpoint — https://docs.github.com/en/rest/dependency-graph/dependency-review
- Dependency graph supported ecosystems — https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/dependency-graph-supported-package-ecosystems
- Issue #164, unclear error when graph disabled — https://github.com/actions/dependency-review-action/issues/164

**CI ergonomics**
- `actions/checkout` README (`fetch-depth` default 1) — https://raw.githubusercontent.com/actions/checkout/main/README.md
- GitHub Actions default environment variables — https://docs.github.com/en/actions/reference/workflows-and-actions/variables
- `git diff` manual (two-dot vs three-dot, `--merge-base`) — https://git-scm.com/docs/git-diff
- Semgrep KB, git command errors in PR scans — https://semgrep.dev/docs/kb/semgrep-ci/git-command-errors

**Baseline / changed-only prior art**
- ESLint bulk suppressions — https://eslint.org/docs/latest/use/suppressions
- Codecov commit statuses (project vs patch) — https://docs.codecov.com/docs/commit-status
- Jest CLI (`--changedSince` and friends) — https://jestjs.io/docs/cli
- Knip CLI reference — https://knip.dev/reference/cli
- Semgrep, remove unwanted findings — https://docs.semgrep.dev/semgrep-code/remove-unwanted-findings

**Ecosystem**
- pnpm catalogs — https://pnpm.io/catalogs

**Repo-internal** (context, not external sources)
- `CONTEXT.md` — *Dependency scan*, *Current (range floor)*, *Audit*, *Registry comparison*, *`siz.config.json`*
- `docs/adr/` — ADR 0004 (range floor), ADR 0007 (registry comparison)
- `.scratch/siz-direction/MAP.md` — direct-dependency scope decision

**Unverified / flagged**
- How the GitHub dependency graph treats a literal `catalog:` specifier in `package.json` (§2.2).
- Whether `HEAD^1` objects are present at `fetch-depth: 1` on a merge-ref checkout (§4.3).
