# Part B — How much of the policy-gate gap is already closed by update bots and commercial supply-chain products?

Research findings for wayfinder ticket, Part B (bots and vendors).
Date: 2026-08-05. Sources are primary (official docs, vendor pricing pages, GitHub docs) except where marked; secondary/derived figures are labeled and dated.

The bet under test: siz wants a **committable policy file** over package facts (license, install size, publish age, deprecation, provenance, staleness), enforced both as a CI audit of the existing dependency set and as an install-time gate. Below, each tool is scored against five fixed questions:

**(a)** what facts can it write a rule about, **(b)** committable-to-repo vs SaaS-dashboard-only, **(c)** does it gate *presence* (stop a disallowed dep from being added/merged) or only *updates* (bot-authored PRs), **(d)** cost/free-tier reality as of 2026-08-05, **(e)** works fully offline/no-account.

---

## 1. Renovate — deep dive

**Verdict up front: Renovate is exclusively an update-shaping tool. It has no mechanism to block a dependency a human adds by hand — not by license, not by size, not by name.** Every knob below governs what Renovate itself proposes.

### What it can configure, and where the reach stops

| Option | What it does | Governs presence or only Renovate's own PRs? |
| --- | --- | --- |
| `packageRules` | Conditional-logic blocks — match on `matchPackageNames`/`matchDepNames`/`matchManagers`/`matchDatasources`/etc., then apply settings (`enabled`, `automerge`, grouping, `minimumReleaseAge`, …) to the matched subset. Rules apply in order, later rules can override earlier ones. [Renovate Docs — Configuration Options](https://docs.renovatebot.com/configuration-options/) | Renovate's own update proposals only |
| `allowedVersions` | Regex or range restricting which versions of a matched dependency Renovate will ever propose (e.g. pin a package to `"[4.0.2,5.0)"`) | Renovate's own proposals — does not stop a human from installing an out-of-range version directly |
| `minimumReleaseAge` (formerly `stabilityDays`) | Cooldown: Renovate won't propose a version until it's been published at least N days/hours. For npm, when set, Renovate passes `--before=<date>` to npm during lockfile generation so *transitive* resolution during Renovate's own update also respects the cutoff; if the existing lockfile already contains a newer package, npm errors `ETARGET` and Renovate retries without `--before`, logging a warning. [Renovate Docs — Minimum Release Age](https://docs.renovatebot.com/key-concepts/minimum-release-age/) | Renovate's own update PRs (and their induced lockfile churn) only — a manually-added fresh package is untouched |
| `matchConfidence` (Merge Confidence) | Filters/gates by Renovate's own crowd-sourced merge-confidence score (`low`/`neutral`/`high`/`very high`, derived from age + adoption + passing tests across the whole ecosystem, not just this repo) — typically paired with `automerge` or `dependencyDashboardApproval`. [Renovate Docs — Merge Confidence](https://docs.renovatebot.com/merge-confidence/) | Renovate's own PRs |
| `osvVulnerabilityAlerts` | Experimental: adds OSV.dev as a second vulnerability data source alongside the host's native advisory feed (GHSA on GitHub); the two are known to disagree on ~31% of advisories in field-tested comparisons **[unverified — single blog-reported field test]** | Feeds Renovate's own remediation PRs / Dependency Dashboard summary — not a gate on existing deps |
| `configMigration` | Opens a PR that rewrites deprecated config keys (e.g. `stabilityDays` → `minimumReleaseAge`) to the current schema | N/A — meta-config hygiene, not a dependency gate |

### The blocking-semantics question, precisely

- `ignoreDeps` is a **top-level list of names**, not a `packageRules` matcher — you cannot select on it inside a rule. The documented pattern to "block" a dependency is instead a `packageRules` entry matching `matchPackageNames`/`matchDepNames` with `"enabled": false`, which stops Renovate from *looking up or proposing updates* for that name. [GitHub Discussion #25107](https://github.com/renovatebot/renovate/discussions/25107), [#20050](https://github.com/renovatebot/renovate/discussions/20050)
- `enabledManagers` disables entire *managers* (e.g. turn off Bundler/Composer/Docker Compose, keep npm) — repo-wide, not per-package. [Renovate Docs — Managers](https://docs.renovatebot.com/modules/manager/)
- None of these stop a `git commit` that adds `left-pad` (or a GPL package, or a 50MB package) to `package.json` by hand. Renovate has **no admission-control hook** — no pre-commit, no PR check that fails on manifest diff content. It only ever proposes or withholds *its own* branches. This is corroborated structurally: Renovate's entire model is "raise a PR that a human merges"; there is no first-party "audit what's already there" mode analogous to `siz outdated`, only forward-looking update proposals plus the Dependency Dashboard issue (a tracking view of what Renovate itself found, not an enforced gate).

### License or size gating?

**None found.** Search across Renovate's docs, Mend's Renovate guides, and community discussions turned up no `allowedLicenses`, `deniedLicenses`, or package-size predicate in `packageRules`. Renovate's rule engine matches on package identity, datasource, manager, dep type, and update semantics — never on the *content* of a license field or `dist.unpackedSize`. If a team wants license/size gating today, Renovate is not the tool; that would have to come from a separate CI step (dependency-review-action, Snyk, etc., below) layered alongside Renovate.

### Config location and the `extends` precedent

Config is a committable `renovate.json` (or `.json5`/`.yml`) at the repo root — first-class prior art for siz's own potential `extends`/preset mechanism. Renovate's presets are ESLint-style shareable config: `{"extends": ["config:recommended", "helpers:pinGitHubActionDigests"]}`; presets are hosted in repos (same platform host, or an HTTP server), can be pinned to a tag/SemVer release, support an implicit `default.json` when a filename is omitted, and can nest. npm-hosted presets are **deprecated for removal**. Org-wide defaults resolve automatically via a `renovate-config` repo in the parent org/user (with nested-group support on GitLab) or a `.github`-style repo with `renovate-config.json`. [Renovate Docs — Shareable Config Presets](https://docs.renovatebot.com/config-presets/), [Renovate Docs — Presets](https://docs.renovatebot.com/key-concepts/presets/), [Renovate Docs — Config Overview](https://docs.renovatebot.com/config-overview/)

**(a)** version, release age, merge-confidence, vulnerability source, dep name/manager/datasource. No license, no size, no deprecation-as-gate (deprecation surfaces as an update signal, not a blocking predicate). **(b)** committable (`renovate.json` + `extends` presets). **(c)** updates only, never presence. **(d)** free and open source (self-hosted or via the free GitHub/GitLab/Bitbucket app — Mend's hosted Renovate app has usage-based paid tiers for org-scale management, but the core bot and config schema are free) — pricing for Mend's hosted app is not itself in scope here since the OSS CLI is what's relevant. **(e)** self-hostable with no account, but it still needs live registry/network access per run — not a fully offline audit.

---

## 2. Dependabot + GitHub dependency review action + repository rulesets

### `dependabot.yml` (version updates) — same shape as Renovate, narrower

| Key | Semantics |
| --- | --- |
| `allow` | Narrows the exact set of deps Dependabot maintains: `dependency-name` (wildcard `*`; ecosystem-specific formats for Gradle/Maven `groupId:artifactId`, Docker repo names), `dependency-type` (`direct`/`indirect`/`all`/`production`/`development`, with ecosystem support caveats), `update-types`. Applies to **both** version and security updates. |
| `ignore` | Same matchers, plus `versions` (native range syntax per ecosystem: npm `^1.0.0`, Bundler `~> 2.0`, NuGet `7.*`, Maven `[1.4,)`). **If a dep matches both `allow` and `ignore`, it is ignored** — ignore wins. |
| `versioning-strategy` | Governs how Dependabot picks/writes the target version and rewrites manifest constraints once an update is cleared. |
| `cooldown` | Version updates only (not security updates). `default-days` (3-day default even unconfigured), `semver-major-days`/`semver-minor-days`/`semver-patch-days` (SemVer-aware ecosystems only), `include`/`exclude` (≤150 items each, `exclude` wins). Support matrix: SemVer-bump days work for Bundler, Bun, Cargo, Composer, Conda, Deno, Dotnet SDK, Elm, Gomod, Gradle, Hex, Julia, Maven, npm/Yarn, NuGet, Pip, Pub, Rust toolchain, sbt, Swift, UV — **not** Bazel, Devcontainers, Docker, Docker Compose, GitHub Actions, Gitsubmodule, Helm, Nix flakes, OpenTofu, pre-commit, Terraform, vcpkg. |

[GitHub Docs — Configuration options for the dependabot.yml file](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)

**Gating verdict: identical to Renovate.** Every option above shapes only Dependabot's own PR behavior. `ignore` stops Dependabot from *proposing* an update to that name/version; it does nothing to a human who adds or pins that exact package by hand. `cooldown` delays Dependabot's own proposal of a fresh release; a developer can `npm install foo@just-published` immediately with zero friction. `allow` narrows Dependabot's maintenance scope, not a repo-wide allowlist. There is no admission-control surface in `dependabot.yml` at all — confirmed directly from the docs, no inference needed.

**Dependabot alerts vs Dependabot updates** — two different products sharing a name: *alerts* are vulnerability notifications derived from the Dependency Graph + GitHub Advisory Database (read-only, informational, can trigger *security* updates); *updates* (`dependabot.yml`) are the PR-generating bot covered above. Neither is a merge gate by itself — enforcement requires wiring alerts into branch protection separately.

### GitHub `dependency-review-action` — this one actually gates

This is categorically different: it is a **CI check that runs on the PR diff** and can be made a required status check, i.e. it can block a merge. Config file: none required by default — it's a GitHub Actions workflow step; an external policy file can be supplied via `config-file` (local path or `OWNER/REPO/FILENAME@BRANCH` for a shared org-wide policy, needing `external-repo-token` for private/GHES repos).

| Option | Values | Default | Note |
| --- | --- | --- | --- |
| `fail-on-severity` | `low`/`moderate`/`high`/`critical` | `low` | |
| `allow-licenses` | SPDX ids | none | mutually exclusive with `deny-licenses` |
| `deny-licenses` | SPDX ids | none | **deprecated, planned for removal** ([issue #938](https://github.com/actions/dependency-review-action)) |
| `deny-packages` | purl (version-omitted = wildcard) | empty | blocks specific packages outright |
| `deny-groups` | purl namespace | empty | blocks whole namespaces/scopes |
| `fail-on-scopes` | `runtime`/`development`/`unknown` | `runtime` | |
| `allow-ghsas` | GHSA ids | none | per-advisory exception |
| `allow-dependencies-licenses` | purl | none | excludes specific packages from license checks |
| `warn-only` | bool | false | demotes all failures to warnings |
| `show-openssf-scorecard` / `warn-on-openssf-scorecard-level` | bool / int | true / 3 | surfaces OpenSSF Scorecard score in the PR summary |

[GitHub — actions/dependency-review-action](https://github.com/actions/dependency-review-action)

**Known limitations (from the action's own docs):**
- **Private repos**: dependency review requires **GitHub Advanced Security** (or, per GitHub's product docs, private repos owned by orgs on GitHub Team/Enterprise Cloud with a Code Security/GHAS license) — [GitHub Docs — About the dependency graph](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph). Public repos get it free.
- **GHES**: license data isn't returned by the GHES API at all — every option marked with license dependence in the source is explicitly unsupported there.
- **Fork PRs**: not documented on the action's own page, but corroborated by community reports: the action needs `pull_request_target` (not plain `pull_request`) to get write-level `GITHUB_TOKEN` permissions when it must comment or fail-check across a fork boundary, and `pull_request_target` by default checks out the *base* branch, not the fork's head — requiring an explicit head-ref checkout workaround, which is a known footgun independent of this specific action. **[unverified — no 403 specifically reported against dependency-review-action itself in the sources found; the fork/token friction is a general Actions pattern, not an action-specific bug]**
- **Output cap**: 1MB; recommend routing through env vars, not string interpolation.
- **Undetected license → no fail**: if ClearlyDefined/the API can't determine a license, the action warns but does not fail the build — a silent gap in "no unknown licenses" policies. ClearlyDefined's `OTHER` bucket maps to the sentinel string `LicenseRef-clearlydefined-OTHER`, which must literally appear in allow/deny lists to match it.

### Repository rulesets / dependency graph

The Dependency Graph itself is read-only metadata (manifest + lockfile parsing, updated on every push) — **not a policy surface**; it feeds dependency review and Dependabot but carries no rules of its own. Private repos lose only the "dependents" (reverse-dependency) view, not the graph itself. Ecosystems that resolve transitively at build time (not statically parseable from a lockfile) need a separate dependency-submission-action per ecosystem (e.g. Component Detection for Vcpkg/Conan/Conda/Crates/NuGet) to populate the graph completely. [GitHub Docs — About the dependency graph](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph)

GitHub **repository rulesets** are the org-level surface for *requiring* the dependency-review-action's status check on protected branches — rulesets themselves carry no license/dependency-specific vocabulary; they only make an existing check (like dependency-review) mandatory before merge. The gate is dependency-review-action; rulesets are the enforcement plumbing that makes it un-bypassable.

**(a)** dependency-review-action: license (allow/deny SPDX), specific packages/namespaces (purl), severity threshold, scope (runtime/dev). **(b)** committable (`config-file` YAML or workflow inline). **(c)** **presence** — it diffs the PR's manifest/lockfile changes and can fail the check, and paired with a required ruleset it is a genuine merge gate. This is the sharpest tool in this whole survey for "no GPL" and "no denied package," but it only fires **on PRs that change the manifest** — it is not a standing audit of what's already merged, and a direct push to a non-protected branch (or a repo without the ruleset configured) bypasses it entirely. **(d)** free on public repos; needs GHAS/Code Security license on private repos (opaque per-seat GitHub Advanced Security pricing, not separately quoted here — **[unverified pricing]**). **(e)** no — requires GitHub-hosted Actions + the Dependency Graph/Advisory Database; not runnable fully offline.

---

## 3. socket.dev

### Detection taxonomy (from Socket's own GitHub App docs)

Static analysis of manifests/lockfiles surfaces: **install scripts** (cited stat: 93.9% of malicious npm packages carried at least one — [Socket Docs — Socket for GitHub](https://docs.socket.dev/docs/socket-for-github)), **telemetry** in transitive deps, **native/compiled code** (audit-resistant, also a portability problem for edge/browser runtimes), **known malware** (continues flagging during the takedown window even after Socket reports to npm), **troll/protestware packages** (deliberately confusing or joke names), **typosquats** (the most common vector per Socket), plus shell-script overrides, mutable git/http dependency refs, and invalid manifests. Socket's pricing page separately claims **"70+ risk types (malware, vulnerabilities, license, etc.)"** are detected even on the Free plan — so license *is* one of Socket's signals, though the license-specific rule vocabulary isn't detailed on the pages fetched. **[unverified — exact license-rule granularity not found in primary docs during this pass]**

### Deployment surfaces

- **GitHub App** — comments on PRs when a new/changed dependency trips a risk category; this is the presence-gating surface (fires on the manifest diff in a PR, similar in shape to dependency-review-action but broader taxonomy).
- **`socket npm` / `socket npx` ("safe npm")** — install-time CLI wrapper, `npm install -g @socketsecurity/cli`, intercepts `npm install`/`npm i`/`npm uninstall` (uninstall can trigger installs too) before packages land on disk; recommended aliased as `alias npm="socket npm"`. **This is Socket's original install-time gate**, per-developer-machine, and it is now explicitly superseded. [Socket Docs — socket npm & socket npx](https://docs.socket.dev/docs/socket-npm-socket-npx)
- **Socket Firewall (`sfw`)** — the current recommended install-time gate: prefix any package-manager command (`sfw npm install`, `sfw pnpm install`, …), covers npm/yarn/pnpm/pip/uv/cargo free, and on Enterprise also Go/Maven-Gradle/Ruby/.NET, with **no Socket account required for the free tier** — genuinely a local, no-account install gate. Enterprise Firewall adds configurable policies, private-registry support, package allow-lists, dashboard visibility, and proxy/service deployment modes.
- **`socket.yml`** — committable CLI config, version-2 schema, supports `projectIgnorePaths` to exclude files from a report. This is closer to scan-scoping than a rule DSL (no evidence found of license/size predicates inside it — it configures what Socket *scans*, not what it *permits*).

### Free vs paid (Socket pricing page, checked 2026-08-05)

| Tier | Price (2026-08-05) | Scope |
| --- | --- | --- |
| Free | $0/dev/mo | Unlimited devs/repos, 1,000 scans/mo, 500 API calls/hr, capped at 3 members + 1 repo label, "70+ risk types," automatic malicious-dependency blocking + AI behavior analysis |
| Team | $25/dev/mo (5-dev min, −20% annual) | + 5,000 scans/mo, 2,500 API/hr, unlimited members, 3 repo labels, precomputed reachability (claims 60% CVE false-positive cut), priority scoring, Slack alerts |
| Business | $50/dev/mo (20-dev min, −20% annual) | + unlimited members/labels, 10,000 API/hr, compliance tooling (Vanta), SBOM import/export, SSO/SAML, webhooks, GitHub Actions + AI-model scanning |
| Enterprise | custom | + full function-level reachability (claims up to 90% irrelevant-CVE elimination), GitLab/Bitbucket/Azure DevOps/self-hosted, SCIM, audit logs, IP restriction, named account manager |

[Socket.dev — Pricing](https://socket.dev/pricing)

**(a)** malware/typosquat/install-script/telemetry/native-code/protestware signals, license (breadth unconfirmed), and (Team+) vulnerability reachability. **(b)** partially — `socket.yml` scopes scans; there's no evidence of a full policy-as-code rule file gating specific facts (unlike dependency-review-action's explicit `deny-licenses`/`deny-packages`). **(c)** the GitHub App gates PR-time presence; Socket Firewall gates local install-time presence — both are presence gates, a meaningfully different posture from Renovate/Dependabot. **(d)** genuinely usable free (1,000 scans/mo, no card required per the page's framing); scales to $25–50/dev/mo above that. **(e)** Socket Firewall free tier works with **no Socket account** for basic malware/typosquat interception; the GitHub App and deeper scans require the hosted service.

---

## 4. Snyk

### CLI vs SaaS split

`snyk test` — one-shot, point-in-time scan (CLI or CI), exits non-zero on policy violation, suitable as a gate. `snyk monitor` — snapshots the current dependency state to Snyk's SaaS dashboard for ongoing/continuous monitoring (new advisories published after the snapshot still surface); this is the standing-audit half, not a merge gate. Both draw on the same underlying vulnerability + license data. **[synthesized from docs.snyk.io site structure and general Snyk CLI documentation conventions — the specific `snyk test`/`snyk monitor` reference page returned a 404 during this research pass; treat as unverified pending direct doc confirmation]**

### `.snyk` policy file — confirmed scope (fetched directly)

YAML file, project-scoped, three top-level keys only:
- `ignore:` — suppress specific issues (by Snyk issue ID) across `snyk test`/`snyk monitor` and SCM/CLI/CI-CD scans; also covers file/directory exclusions and IaC "unmanaged resource" ignores. **License issues are suppressed here by ID, same as vulnerabilities** — but this is an ignore-list, not a policy-authoring surface.
- `language-settings:` — pins a Python version for SCM scans, overriding org-level default.
- `patch:` — declares patches for vulnerabilities that have no upgrade path; drives CLI/CI patch behavior.

**Critically: the `.snyk` file does not define license *policy* (the allow/deny rule itself) — it can only ignore individual already-flagged license issues.** [Snyk Docs — Define policies](https://docs.snyk.io/implementation-guides/enterprise-implementation-guide/configure-group-settings-and-policies/define-policies.md) (fetched 2026-08-05)

### License policy tier gating — the sharpest fact in this section

**License policies are available only on Snyk Enterprise plans, and only apply to Snyk Open Source scans.** [Snyk Docs — Define policies](https://docs.snyk.io/implementation-guides/enterprise-implementation-guide/configure-group-settings-and-policies/define-policies.md) This is the closest commercial analogue to siz's core license predicate, and it is **not** in Snyk's Free or Team tiers — confirmed directly from Snyk's own docs, not inferred.

### Pricing (as of 2026-08-05, third-party aggregation — Snyk does not publish a full rate card)

Four public tiers: **Free** (all five products, capped tests/mo — one third-party figure cites 200 OSS tests, 100 container tests, 300 IaC tests per month, **[unverified — third-party, not Snyk's own page]**), **Team** (commonly cited entry point **$25/contributing-developer/month** billed annually, though other sources put bundle list pricing at $52–98/dev/mo depending on product mix — **[unverified — conflicting third-party figures, no single authoritative page reconciled them]**), **Ignite** (sales-assisted mid-tier, terms undisclosed), **Enterprise** (quote-only). "Contributing developer" = anyone who committed to a scanned private repo in the trailing 90 days. Given license policy is Enterprise-only, the realistic floor to get siz's core license predicate from Snyk is an Enterprise quote, not the advertised $25/dev/mo Team price.

**(a)** vulnerabilities (OSS/Container/IaC/Code), license (Enterprise-only), patches. **(b)** partially committable — `.snyk` can ignore flagged issues and set patches, but the license *policy itself* lives in Snyk's Group/Org settings (SaaS dashboard), not in a repo file. **(c)** `snyk test` in CI can fail a build/PR on violation (presence-gating, same mechanics as dependency-review-action) but requires Enterprise for the license predicate specifically. **(d)** license gating is Enterprise-tier, effectively uncosted publicly. **(e)** no — `snyk test` needs network access to Snyk's vulnerability/license database; no offline mode found.

---

## 5. Briefly: Sonatype, Mend, JFrog Xray, OpenSSF Scorecard, allstar

**Sonatype.** Nexus Repository OSS (the artifact-repository half) is genuinely free and self-hostable, but carries no policy engine. OSS Index — historically a free, often-unauthenticated REST API for vulnerability lookups by purl (`GET https://ossindex.sonatype.org/api/v3/component-report/pkg:nuget/...`) — has been rebranded "Sonatype Guide" and, per its current live page, **now requires authentication** (a free account), ending true no-account usage. **[unverified — exact current rate limits and grace period for the migration not found]**. Any actual policy gate (license rules, vulnerability firewall blocking downloads, component-age rules) lives in **Nexus Lifecycle/Firewall**, which has **no free tier** and is priced per contributing developer, commercial-only. [Sonatype OSS Index](https://ossindex.sonatype.org/), [Sonatype — Pricing](https://www.sonatype.com/products/pricing)

**Mend (formerly WhiteSource).** Full SCA + license-compliance platform; the free community edition was retired in the rebrand, and **Mend.io publishes no free tier and no public rate card** for its core SCA product — sales-quoted only, reported ballpark $200–350/developer/year for mid-size teams. **[unverified — third-party estimate, no primary pricing page]** The free **Renovate** bot is a separate, narrower Mend-owned product (covered fully in §1) and should not be conflated with Mend's paid SCA/license offering.

**JFrog Xray.** Policy + Watch model: policies define rules (CVE severity/ID, license type, CVSS, component age) and actions (block download, fail build, alert, webhook); Watches scope which repos/builds a policy applies to — this is a genuine presence/build gate, structurally similar to Sonatype Lifecycle. Sold as an Artifactory add-on or in Platform bundles; no free tier, reported annual cost $10k–$50k+ depending on scale. **[unverified — third-party benchmarking figures, no public JFrog rate card found]** [JFrog Docs — Policy and Governance](https://jfrog.com/help/r/jfrog-security-user-guide/products/xray/features-and-capabilities/sdlc-policy-mangement)

**OpenSSF Scorecard.** Fully free, Apache-2.0, and the one tool in this whole survey with a genuine **offline, no-account CLI path**: `scorecard --local=<folder> --format json` runs entirely locally against a filesystem checkout for checks that don't require GitHub metadata; checks needing repo API data (Branch-Protection, Code-Review) still need a GitHub token. Structured JSON output is explicitly designed to feed an external policy engine (OPA/Rego or any custom program) — Scorecard itself ships no policy language, just facts plus a documented "bring your own policy engine" pattern. Not license/size-aware — its checks (`Maintained`, `Vulnerabilities`, `Dependency-Update-Tool`, `Packaging`, `Pinned-Dependencies`, etc.) are supply-chain-hygiene signals, not license/size predicates. [OpenSSF blog — Beyond Scores](https://openssf.org/blog/2024/04/17/beyond-scores-with-openssf-scorecard-granular-structured-results-for-custom-policy-enforcement/), [ossf/scorecard README](https://github.com/ossf/scorecard)

**allstar.** A GitHub App (OpenSSF/Google), free and self-hostable, that enforces **org/repo-level GitHub settings and file-presence policies** — not package-dependency facts. Org policy lives in a committable `.allstar` repo (`allstar.yaml` + per-policy YAMLs like `admin.yaml`, `actions.yaml`, `scorecard.yaml`); repo-level override in a `.allstar` directory in the repo itself. Its Scorecard-based policy can enforce a score floor and upload SARIF to the repo's Code Scanning tab. This governs repo hygiene (security policy file present, admin membership, binary artifacts, workflow permissions) — it has no notion of an npm package's license, size, or publish age. Irrelevant to siz's specific bet except as prior art for "committable org policy + per-repo override + opt-in/opt-out list," a config shape siz's `extends` mechanism could study. [ossf/allstar README](https://github.com/ossf/allstar)

---

## Bottom line

**For "no GPL, no package unpublished in 3 years, no deprecated dep, no unpacked size over 5MB" — no single existing tool expresses this whole rule, and no free tool expresses more than a slice of it.**

| Predicate | Best available today | Committable? | Cost | Gates presence or only updates? |
| --- | --- | --- | --- | --- |
| No GPL (license) | `dependency-review-action` (`deny-licenses`/`allow-licenses`, though `deny-licenses` is deprecated for removal — use `allow-licenses`) | Yes, workflow + optional external config file | Free on public repos; needs GHAS on private | **Presence** — PR-diff gate, real merge block if made a required ruleset check |
| Unpublished > 3 years | **Nothing found that gates this as a hard rule.** Renovate's `minimumReleaseAge` is the inverse (a *minimum* age before Renovate proposes a version) and only touches Renovate's own PRs — no tool blocks a dep for being *too old*/abandoned as a merge gate. Socket's "stale"-type signals and OpenSSF Scorecard's `Maintained` check surface staleness as an informational score, not an enforceable age threshold | No | Scorecard is free; Socket free tier partial | Neither — informational only |
| Not deprecated | Socket (GitHub App / Firewall) flags known-bad/malicious, not npm's `deprecated` flag specifically **[unverified — deprecation-as-rule not confirmed in any tool surveyed]**; no tool confirmed to hard-fail a PR purely because `npm deprecate` was called on a version | No confirmed committable rule | — | Neither confirmed |
| Unpacked size > 5MB | **Nothing found, anywhere, free or paid.** No tool in this survey — Renovate, Dependabot, dependency-review-action, Socket, Snyk, Sonatype, Mend, JFrog Xray — exposes an install-size predicate. This is the cleanest whitespace of the whole ticket | — | — | — |

**Realistic combination to get closest today:** `dependency-review-action` (license + specific-package denylist, free, required-ruleset merge gate) **+** Renovate or Dependabot (keeps the tree from drifting, cooldown as a soft proxy for "don't adopt a package the instant it's published," but not an admission gate) **+** OpenSSF Scorecard run locally with a custom policy layer for staleness/maintenance signals (free, offline-capable for local checks). That combination is **free** and gets a team roughly: real license enforcement at merge time, soft update-hygiene, and DIY staleness scoring — assembled from three separate tools with three separate config files and no shared vocabulary.

**What stays unexpressible by anyone, at any price, as of 2026-08-05:**
1. **Install size** as a policy predicate — total whitespace across every tool surveyed, free or Enterprise.
2. **"Unpublished for N years" as a hard admission rule** — every tool that touches age uses it to *delay adoption of new things* (cooldown/minimumReleaseAge), not to *forbid old, abandoned things*. This is the inverse of siz's staleness signal (`⚑` >2y) as a gate.
3. **A single committable file combining license + size + age + deprecation** that gates *both* new PRs and an *existing, already-merged* tree in one pass. Dependency-review-action gates PR diffs only (nothing already merged); Renovate/Dependabot never gate presence at all; Snyk's Enterprise license policy is dashboard-configured, not repo-committed; Socket's `socket.yml` scopes scans, not rules. Every tool here picked one half of "audit what's there" vs "gate what's coming" — none do both from one committed artifact.

This is exactly the gap `01-parts` set out to test, and it survives scrutiny: the update-bot ecosystem (Renovate, Dependabot) is mature and free but structurally incapable of admission control by design — it only ever proposes; the one free tool that *can* gate presence (dependency-review-action) covers license and explicit package/namespace denylists well but has no size or age vocabulary at all; and the vendors that might plausibly add size/age as paid features (Snyk, Sonatype, Mend, JFrog) gate license today only behind Enterprise contracts, leaving the exact rule this ticket describes — license + size + age + deprecation, committable, dual-mode — unbuilt by anyone.

---

## Sources

Primary:
- [Renovate Docs — Configuration Options](https://docs.renovatebot.com/configuration-options/) (`packageRules`, `enabledManagers`)
- [Renovate Docs — Minimum Release Age](https://docs.renovatebot.com/key-concepts/minimum-release-age/) (`minimumReleaseAge`, npm `--before` behavior, `ETARGET` fallback)
- [Renovate Docs — Merge Confidence](https://docs.renovatebot.com/merge-confidence/) (`matchConfidence` levels)
- [Renovate Docs — Shareable Config Presets](https://docs.renovatebot.com/config-presets/) and [Presets](https://docs.renovatebot.com/key-concepts/presets/) (`extends`, hosting, org defaults, npm-preset deprecation)
- [Renovate Docs — Managers](https://docs.renovatebot.com/modules/manager/) (`enabledManagers` semantics)
- [renovatebot/renovate Discussion #25107](https://github.com/renovatebot/renovate/discussions/25107) and [#20050](https://github.com/renovatebot/renovate/discussions/20050) (`ignoreDeps` cannot be used inside `packageRules`; `enabled:false` pattern)
- [GitHub Docs — Configuration options for the dependabot.yml file](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file) (`allow`, `ignore`, `versioning-strategy`, `cooldown`)
- [GitHub — actions/dependency-review-action](https://github.com/actions/dependency-review-action) (full option table, GHES/private-repo limitations, deprecated `deny-licenses`, output cap, undetected-license behavior)
- [GitHub Docs — About the dependency graph](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph) (private-repo dependents limitation, GHAS requirement for dependency review, transitive-ecosystem submission actions)
- [Socket Docs — Socket for GitHub](https://docs.socket.dev/docs/socket-for-github) (alert taxonomy: install scripts, telemetry, native code, malware, troll packages, typosquats)
- [Socket Docs — socket npm & socket npx](https://docs.socket.dev/docs/socket-npm-socket-npx) (install wrapper mechanics, Socket Firewall as successor)
- [Socket.dev — Pricing](https://socket.dev/pricing) (Free/Team/Business/Enterprise tiers and prices, checked 2026-08-05)
- [Snyk Docs — Define policies](https://docs.snyk.io/implementation-guides/enterprise-implementation-guide/configure-group-settings-and-policies/define-policies.md) (license policy is Enterprise-only, `.snyk` file's three keys, fetched 2026-08-05)
- [Sonatype OSS Index](https://ossindex.sonatype.org/) and [Sonatype — Pricing](https://www.sonatype.com/products/pricing) (auth-now-required status, Lifecycle/Firewall as no-free-tier commercial add-ons)
- [JFrog Docs — Policy and Governance (Xray)](https://jfrog.com/help/r/jfrog-security-user-guide/products/xray/features-and-capabilities/sdlc-policy-mangement) (policy/watch model, block-download/fail-build actions)
- [OpenSSF blog — Beyond Scores with OpenSSF Scorecard](https://openssf.org/blog/2024/04/17/beyond-scores-with-openssf-scorecard-granular-structured-results-for-custom-policy-enforcement/) and [ossf/scorecard README](https://github.com/ossf/scorecard) (`--local`, JSON output, bring-your-own policy-engine pattern, check list)
- [ossf/allstar README](https://github.com/ossf/allstar) (org/repo `.allstar` config, `allstar.yaml`, opt-in/opt-out, Scorecard-based policy, SARIF upload)

Secondary / aggregated (flagged inline as unverified where load-bearing):
- Mend.io, Snyk, JFrog, Sonatype pricing aggregation sites (Vendr, dev.to, pixlodo, appsecsanta, CloudRepo) — used only for cost ballparks where vendors publish no rate card; all such figures are marked **[unverified]** in the body text above.
- Secustor.dev field-test blog on Renovate `osvVulnerabilityAlerts` vs GHSA overlap (31% disagreement figure) — marked **[unverified]**.

Not independently re-verified in this pass (carried over as established context from the companion Part-A research, `02-transitive-audit-feasibility.md`, and not re-cited as primary here): general npm/pnpm/yarn lockfile mechanics, which are out of this ticket's scope.
