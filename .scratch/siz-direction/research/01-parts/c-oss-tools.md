# C — Does an OSS CLI already do committable multi-fact dependency policy?

Research findings for wayfinder ticket, part C (`01-parts/c-oss-tools.md`).
Date: 2026-08-05. Sources are primary (official READMEs, docs, npm registry) except where marked.

Context: siz's claim under test is that no existing OSS CLI lets a team commit **one file** expressing policy across **license, install size, publish age, deprecation, provenance/attestation, and maintenance staleness**, enforced both as a CI audit of existing deps and as an install-time gate on new ones. This document tries to break that claim.

---

## 1. npq (lirantal/npq) — install-time gate

| | |
| --- | --- |
| Repo | [lirantal/npq](https://github.com/lirantal/npq) |
| Latest / published | `3.23.3`, 2026-07-23 (`registry.npmjs.org/npq`, measured 2026-08-05) |
| Weekly downloads | 8,048 (`api.npmjs.org/downloads/point/last-week/npq`, measured 2026-08-05) |
| Verdict | **Closest single competitor to the install-time half of siz's claim — but env-var configured, not a committable file.** |

npq runs 15 "marshalls" against a package before letting an install through: `age` (npm age < 22 days), `author` (new/dormant maintainer), `downloads` (< 20/month), `readme`, `repo`, `scripts` (pre/post-install), `snyk` (needs a token), `license` (absent field), `expired domains` (maintainer email DNS/RDAP), `signatures`, `provenance` (attestation verification — [docs/feature/provenance.md](https://github.com/lirantal/npq/blob/main/docs/feature/provenance.md)), `version-maturity` (< 7 days), `newBin`, `typosquatting`, `deprecation` (npm deprecation or archived GitHub repo) — full list and descriptions in the [README](https://github.com/lirantal/npq/blob/main/README.md).

That is **four of siz's six fact families already covered by one tool**: license (presence-only, not SPDX allow/deny), publish age, deprecation, provenance. Missing: install size, maintenance staleness beyond binary "dormant maintainer."

**Configuration is exclusively environment variables** — `MARSHALL_DISABLE_SNYK=1`, `MARSHALL_DISABLE_AGE=1`, etc., one env var per marshall, plus `NPQ_PKG_MGR`, `SNYK_TOKEN`, `GITHUB_TOKEN`. **No `.npqrc` or any committable file was found in the README**; thresholds (22 days, 20 downloads/month, 7-day version maturity) read as hardcoded, not tunable. This is the load-bearing gap versus siz's pitch: the policy lives in shell exports or CI env config, not in one file a reviewer can read in a PR diff.

npq **can** run as a standalone audit, not just an install interceptor: "Running `npq` without an `install`/`i`/`add` subcommand (for example from a project directory with a `package.json`) audits dependencies only and does not run the package manager" ([README](https://github.com/lirantal/npq/blob/main/README.md)). That audit reads declared `package.json` deps, not an installed/lockfile-resolved tree — closer to a manifest scan than the transitive-tree audit sketched in doc 02.

**Bottom line on npq:** it is the single tool that most overlaps siz's ambition, and it is actively maintained (published 3 weeks before this research). What it lacks is exactly the "one committable file" framing — everything is env-var/CLI-flag driven — and it never touches install size or a graded staleness signal (only a binary maintainer-dormancy heuristic inside the `author` marshall).

---

## 2. License tooling

| Tool | Latest / published | Weekly DL | Committable allow/deny config? | CI exit code? | Maintained? |
| --- | --- | --- | --- | --- | --- |
| [`license-checker`](https://github.com/davglass/license-checker) (davglass) | `25.0.1`, 2019-01-10 | 1,067,043 | No — CLI flags only | Yes, `--failOn`/`--onlyAllow` | **No** — 7-year-old latest, superseded by the fork |
| [`license-checker-rseidelsohn`](https://github.com/RSeidelsohn/license-checker-rseidelsohn) | `5.0.1` on npm, 2026-05-27; README states `6.0.0` is "the final release" | 431,683 | No — same CLI-flag model, plus a `--clarificationsFile` (corrects *detection*, not policy) | Yes, same two flags | **Deprecating itself** — the README says development is moving to a successor, `@lizenz/checker`, "a 100% compatible drop-in replacement," and calls the fork landscape "a bit complicated right now" |
| `@lizenz/checker` | not directly checked — named successor only | — | unverified **[unverified]** | unverified | unverified |
| `licensee` (github/licensee) | Ruby gem, not on npm | — | n/a | n/a | **Out of scope for an npm/Node CLI comparison** — different ecosystem entirely |
| `@quicinc/licenselint` | not independently verified this pass | — | **[unverified]** | **[unverified]** | **[unverified]** |
| `oss-attribution-generator` | not independently verified this pass | — | **[unverified]** — name implies a NOTICE-file generator, not a policy gate | **[unverified]** | **[unverified]** |

Both `license-checker` and its fork exit non-zero on a policy violation (`--failOn`, `--onlyAllow`, semicolon-delimited lists — [davglass README](https://github.com/davglass/license-checker), [rseidelsohn README](https://github.com/RSeidelsohn/license-checker-rseidelsohn)), which makes them CI-gateable *today*. But **neither reads a committable policy file** — the allow/deny list is a CLI argument, so in practice a team commits it inside a `package.json` script or a CI YAML step, not a standalone reviewable file. The rseidelsohn fork's `--clarificationsFile` is a JSON file, but it's a correction mechanism ("this package's real license is X, override the guess") not a policy mechanism.

The upstream original is unmaintained (last publish 2019); the maintained fork is itself sunsetting in favor of a new package. **License-only, single-fact, CLI-flag policy — no file, and the whole lineage is in flux.**

---

## 3. knip (webpro-nl/knip) — confirmed out of scope

| | |
| --- | --- |
| Repo | [webpro-nl/knip](https://github.com/webpro-nl/knip) |
| Latest / published | `6.31.0`, 2026-07-31 (registry, measured 2026-08-05) |
| Weekly downloads | 12,274,651 — by far the largest of any tool in this document |
| Verdict | **Zero overlap with any of the six fact families. Confirmed from its own README, not inferred from the name.** |

Knip's own tagline: "finds and fixes **unused dependencies, exports and files** in your JavaScript and TypeScript projects" ([README](https://github.com/webpro-nl/knip)). Nothing in the README mentions license, size, publish age, deprecation, provenance, or staleness — the repo topics are `deadcode`, `dependency-analysis`, `dependency-management`, `lint`, `unused-code`, `unused-exports`. The hypothesis in the ticket — "adjacent but doesn't overlap" — is confirmed. Knip answers "is this dependency used," never "is this dependency healthy." Notably it is the tool depcheck's own maintainers now point users toward (see §4).

---

## 4. depcheck (depcheck/depcheck) — archived, same scope caveat as knip

| | |
| --- | --- |
| Repo | [depcheck/depcheck](https://github.com/depcheck/depcheck) |
| Latest / published | `1.4.7`, 2023-10-17 |
| Weekly downloads | 1,757,418 (still heavily used despite being frozen) |
| Verdict | **Same scope as knip (unused/missing dependency detection) — zero fact-family overlap — and now archived.** |

The GitHub repository was **archived by the owner on 2026-06-16 and is read-only**, per search results surfacing the repo's own archive banner and README notice: "its lack of updates means it may not work well with modern tooling and frameworks," with the maintainers explicitly recommending **knip** as the successor. Depcheck's scope was always "how each dependency is used, which dependencies are useless, and which dependencies are missing from `package.json`" — pure usage analysis, never a package-fact tool. No overlap with any of the six families, and now formally dead.

---

## 5. Broader landscape

| Tool | Scope (from own docs) | Committable multi-fact policy file? | Overlap verdict |
| --- | --- | --- | --- |
| [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser) (`18.1.1`, published 2026-08-02, 3.17M weekly DL) | Primarily the **module import graph** (orphan, reachable, circular, ancestor, layering) — but its rules reference file *does* include `license`/`licenseNot` conditions (regex match against a dependency's declared `package.json` license string — [rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)) and a `dependencyTypes` value of `deprecated` ("the version you're using or the module itself is officially deprecated"). No publish-age, size, or provenance conditions exist anywhere in the reference. | Yes for license+deprecation specifically — `.dependency-cruiser.js/.json` is exactly the "one committed file" shape, but it only reaches 2 of 6 families and its center of gravity is architecture, not supply-chain policy. | **Partial and incidental.** It is the one tool in this survey with a *committable rules file* that reaches into package metadata at all, but license/deprecation are minor conditions bolted onto a graph-shape tool, not the product's purpose. |
| [`lockfile-lint`](https://github.com/lirantal/lockfile-lint) (`5.0.0`, 2026-01-25, 363k weekly DL) | Validates lockfile entry **hosts and URL scheme** against an allowlist (`--allowed-hosts`, `--validate-https`) to catch injected malicious sources. Has a `lockfile-lint.config.js`. Explicitly distinguishes itself from vulnerability scanning and defers to npq for "vetting" individual deps. | Config file exists but is single-purpose (host/scheme allowlisting), not a multi-fact policy. | **No overlap** with the six families — different threat model (supply-chain injection, not package health). |
| [`npm-package-json-lint`](https://github.com/tclindner/npm-package-json-lint) (`10.4.1`, 2026-06-16, 370k weekly DL) | Schema/field linting of your **own** `package.json` (types, casing, required fields) — includes a "valid licenses" rule (checks *your* declared license field is well-formed), nothing about dependency ages or deprecation. Has committable `.npmpackagejsonlintrc.json`. | Committable config, but governs your manifest's own fields, not your dependencies' facts. | **No overlap** — governs the linting target's own package.json, not third-party dependency policy. |
| [`publint`](https://github.com/publint/publint) (`0.3.23`, 2026-08-04, 992k weekly DL) | Lints a package's **own** packaging/export correctness for publishing (browser/node conditions, main/exports mismatches). | n/a | **No overlap.** |
| `are-the-types-wrong` | TypeScript type-resolution checker for a package's own exports — **not found on the npm registry** under that name during this pass (`registry.npmjs.org/are-the-types-wrong` returned not-found); likely published under a scoped or different name. **[unverified]** | n/a | **No overlap**, scope is type-declaration correctness of a single package, not a dependency policy tool regardless. |
| [`npm-check-updates`](https://github.com/raineorshine/npm-check-updates) (`23.0.1`, 2026-08-02, 860k weekly DL) | Version-range upgrade proposals. Beyond pure semver targeting it has real policy-adjacent knobs: `--filter`/`--reject` (name/glob/regex allow-deny), `--no-deprecated` (excludes deprecated packages — **touches one fact family**), and `--cooldown` (minimum publish age before a version is eligible — **touches a second fact family**, and can inherit from npm's native `min-release-age`/yarn's `npmMinimalAgeGate`/pnpm's `minimumReleaseAge`). Config via `.ncurc.{json,yaml,js}`. | The `.ncurc` file is committable and can encode deprecation-exclusion + cooldown — genuinely two facts in one file — but it has **no license knob at all**, and its entire purpose is gating *which upgrade to propose*, not gating *what's allowed to be installed at all* or auditing an already-resolved tree. | **Meaningful partial overlap on 2 of 6 facts (deprecation, publish age), scoped narrowly to the upgrade-selection moment.** Worth naming explicitly as the strongest configuration-file precedent found outside npq. |
| [`taze`](https://github.com/antfu-collective/taze) (`19.17.1`, 2026-08-03, 88,941 weekly DL) | Same upgrade-proposal space as ncu. Has `--maturity-period` (publish-age gate, defaults 7 days, with an allowlist exclude) and `packageMode: 'ignore'` per package — same one fact (publish age) as ncu's cooldown, no license/deprecation checks found in its docs. | Committable config (`taze.config.ts`), but single-fact (age) plus name-based ignore. | **Overlap on 1 of 6 facts (publish age)**, same narrow scope as ncu. |
| [`ni`](https://github.com/antfu-collective/ni) (`@antfu/ni` `30.3.0`, 2026-07-22, 2.5M weekly DL) | Package-manager-agnostic command dispatcher (`ni`/`nr`/`nlx`/`nup`/`nun`, catalog wiring). README confirms: no license/vulnerability/provenance/deprecation/popularity checks of any kind. | n/a | **Confirmed irrelevant, dismissed as expected** — it is a UX tool, not a fact tool. |
| Bundlephobia (web) / `bundle-phobia-cli` / `bundlephobia-tool` / `package-size` | Bundlephobia itself is **web/API only, no first-party CLI**; third-party wrappers exist: `bundle-phobia-cli` (AdrieanKhisbe) supports `--max-size`/`--max-overall-size` and can **fail an install** on a size budget (a real install-time size gate); `bundlephobia-tool` similarly reports "largest deps first" from `package.json` and exits non-zero on analysis failure; `package-size`/`pkg-size` are simpler one-shot lookups. | Size-only, CLI-flag budgets, not a file, not multi-fact. | **Confirms install size is already gate-able standalone**, via third-party wrappers around a first-party API/site — but single-fact, and none of these wrappers were independently verified for maintenance currency this pass. **[unverified: current publish dates/downloads of these specific wrapper packages]** |
| `howfat`, `cost-of-modules`, `npm-why` | `cost-of-modules` ([siddharthkp/cost-of-modules](https://github.com/siddharthkp/cost-of-modules)) reports installed disk size per dependency from `package.json`, no policy/gate feature, reporting only. `howfat` and `npm-why` were not independently confirmed with primary sources this pass. | No | **No policy overlap** — reporting tools, not gates. **[unverified for howfat/npm-why specifics]** |
| [`sandworm-audit`](https://github.com/sandworm-hq/sandworm-audit) (`@sandworm/audit` `1.56.1`, **published 2023-10-24**, 23,411 weekly DL) | Per its README: "Scans your project & dependencies for **vulnerabilities, license, and metadata issues**." Flags include `--license-policy` (custom JSON policy string) and `--fail-on` (JSON string of fail conditions) — genuinely closest to a **multi-fact CI-gateable audit**. Reads from "registry" or "disk" (`--from`), runs over an **already-resolved** project (a lockfile+manifest must exist), not an install-time interceptor. | **No committable file found** — both `--license-policy` and `--fail-on` are inline JSON *strings* passed as CLI arguments in the README's documented usage, not a file path. Deeper docs at docs.sandworm.dev might reveal a file-based option; not verified this pass. **[unverified: whether docs.sandworm.dev adds a config-file mode]** | **Second-closest competitor after npq**, and unlike npq it explicitly reaches license + "metadata issues" (unspecified — README doesn't enumerate whether that means age/deprecation/provenance) in one CI-gateable tool. But it has been **effectively dormant for 3 years** (last publish 2023-10-24, vs. npq's 2026-07-23), and the "one file" property is unconfirmed from the README alone. |
| `socket-cli` (`SocketDev/socket-cli`) | The CLI is open source and wraps the hosted Socket API — per doc 02 §4, "Socket does no local resolution... it uploads manifests, the server does resolution and analysis." The OSS CLI is a thin client to a paid/hosted backend for the actual fact computation (deps.dev-style registry facts, behavioral analysis). | The CLI itself doesn't do fact computation locally, so "committable file" doesn't apply the same way — `socket.yml` configures what gets uploaded/ignored, not a standalone policy engine. | **Not a standalone OSS competitor** — the value (registry-fact computation at scale) sits behind Socket's hosted service, consistent with doc 02's finding that registry-scale fact fetching pushes toward a server business model, not a CLI feature. |
| [`osv-scanner`](https://github.com/google/osv-scanner) (Google, Apache-2.0) | Primarily CVE/advisory matching (OSV database) across 11+ ecosystems and 19+ lockfile formats — but its own README documents **two extra fact families dead-on-target for this ticket**: `--licenses="MIT,Apache-2.0"` (an SPDX allowlist flag, backed by deps.dev license data) and, under its deps.dev integration, explicit **"Package deprecation: Checks if packages are deprecated."** An `osv-scanner.toml` config file exists in the repo root (schema not verified this pass). No publish-age or provenance checks found in the README. | Config file (`osv-scanner.toml`) exists; whether it can express the license allowlist and deprecation check *together* in that file (vs. only as CLI flags) is **[unverified]** — the README demonstrates both features via flags, not confirmed via the TOML schema. | **Real overlap on 2 of 6 facts (license, deprecation) inside a tool whose primary purpose is CVE scanning**, from a major vendor (Google) with presumably strong maintenance — the single most credible "already reaches beyond CVEs" data point found in this survey, but vulnerability-scanning-shaped rather than dependency-policy-shaped, and doesn't touch size/age/provenance/staleness. |
| `syft` + `grype` (Anchore) | Grype's own README: "A vulnerability scanner for container images and filesystems" — vulnerabilities, EPSS/KEV risk scoring, OpenVEX filtering. **Nothing about license, age, or deprecation found in grype's README.** Whether Syft's SBOM output carries license fields, and whether a separate OSS policy-gate layer exists, was **not confirmed from grype's page** — would need Syft's own docs and Anchore's product pages. | **[unverified]** — grype's README gives no evidence either way for a policy-rule-file layer; Anchore's commercial angle ("For commercial support options... contact Anchore") suggests deeper policy tooling may sit behind a paid platform, but this is not confirmed from primary source in this pass. | **Vulnerability-only as far as verified; policy-gate claim unconfirmed [unverified].** |
| OWASP Dependency-Track | Self-hosted (Apache-2.0), OSS, per OWASP's own project page: "a robust, configurable **policy engine**... evaluates the portfolio... against user-configurable security, operational, and license policies," ingesting CycloneDX/SPDX SBOMs and continuously re-checking against live vulnerability feeds. This is a genuine OSS multi-fact policy engine — but it is a **hosted server/dashboard you self-host and feed via CI**, not a CLI a developer runs locally. Policy is configured through its web UI/API, not (per the sources found) a single file a developer commits alongside `package.json`. | Policy lives in the running server's database, not in a git-committed file — the opposite ergonomics from siz's pitch (one file in the repo vs. one running service holding state). | **Real multi-fact policy overlap in spirit (license + security + "operational" policy, CI-gateable via build-fail), but wrong shape** — it's SBOM-ingesting infrastructure, not "one committed file a CLI reads." Confirms the OSS ecosystem already solved multi-fact policy for teams willing to run a server; it has not solved it as a lightweight committable-file CLI. |
| `cyclonedx-npm` (`@cyclonedx/cyclonedx-npm`) | SBOM *generator* only — produces CycloneDX JSON from an npm project, with an experimental `--gather-license-texts` flag for license evidence. It generates data; it enforces nothing itself. | n/a — not a policy tool | **No overlap** — it is the input format a policy engine (like Dependency-Track) would consume, not a policy engine itself. |

---

## 6. ESLint-based approaches — confirmed import-time, not install-time

- **`no-restricted-imports`** (ESLint core, [docs](https://eslint.org/docs/latest/rules/no-restricted-imports)) blocks specific module names from being `import`ed in source code — e.g. banning `lodash` in favor of `lodash-es`. Enforced by the linter at edit/CI-lint time, over **source code**, not `package.json`/lockfile contents.
- **`import/no-restricted-paths`** (eslint-plugin-import, [docs](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md)) restricts imports based on file-system *location* (e.g. no client code importing server-only files) — an internal architecture-boundary rule, not a third-party-package policy tool at all.
- No ESLint plugin was found in this pass that gates **installation** by package facts (license, age, deprecation, provenance). Everything in this family enforces **usage in source code**, which is a categorically different enforcement point from siz's target (blocking `npm install`/`pnpm add` itself, or auditing what's already in the lockfile). Stated explicitly per the ticket's instruction: **all ESLint-based approaches found are import-time, not install-time — none is an install-time competitor.**

---

## Coverage matrix

Rows = the six fact families. Columns = tools with any documented coverage. Blank/dash = no coverage found in primary sources.

| Fact family | npq | license-checker / fork | dependency-cruiser | npm-check-updates | taze | Bundlephobia + CLI wrappers | sandworm-audit | osv-scanner | OWASP Dependency-Track |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **License** | Presence-only (warns if field missing) | **Yes** — SPDX validation + allow/deny, CI-gateable | Regex allow/deny on declared license string | — | — | — | Yes (`--license-policy`) | Yes (`--licenses` SPDX allowlist) | **Yes** — full policy engine |
| **Install size** | — | — | — | — | — | **Yes** — size budgets, install-time fail | — | — | — |
| **Publish age** | Yes — package age < 22d, version maturity < 7d | — | — | Yes — `--cooldown` | Yes — `--maturity-period` | — | Unclear ("metadata issues", unspecified) | — | Via SBOM timestamps, unconfirmed |
| **Deprecation status** | Yes — npm deprecation + archived-repo check | — | Yes — `deprecated` dependencyType | Yes — `--no-deprecated` | — | — | Unclear ("metadata issues") | **Yes** — explicit deps.dev deprecation check | Possible via policy engine, unconfirmed |
| **Provenance/attestation** | **Yes** — full attestation verification | — | — | — | — | — | — | — | — |
| **Maintenance staleness** | Partial — "dormant maintainer" heuristic only | — | — | — | — | — | Unclear | — | — |

---

## Verdict

**No, there is not already a free/OSS CLI where a team commits ONE file expressing a multi-fact policy over their dependencies and gets a CI exit code — but two tools come close enough that siz's differentiation claim needs to be stated precisely, not broadly.**

**npq** ([lirantal/npq](https://github.com/lirantal/npq), actively maintained, published 2026-07-23) is the closest install-time competitor: it already checks 4 of siz's 6 families (license-presence, publish age, deprecation, provenance) in a single tool, and can even run as a standalone audit over an existing project rather than only intercepting installs. What it lacks precisely: (1) no install size signal at all, (2) no graded maintenance-staleness signal (only a binary maintainer-dormancy flag buried in one marshall), (3) and most importantly for the "one committable file" pitch — **its entire configuration surface is environment variables**, one per marshall, with no `.npqrc` or equivalent found in its README. A team cannot open a PR diff and see "here is our dependency policy" the way they could with a `siz.config.json`.

**sandworm-audit** ([sandworm-hq/sandworm-audit](https://github.com/sandworm-hq/sandworm-audit)) is the closest audit-side competitor: it explicitly advertises license + vulnerability + unspecified "metadata issues" checks with configurable fail conditions for CI gating, over an already-resolved project. But it has been dormant since 2023-10-24 (measured 2026-08-05) — three years with no publish — and its policy is passed as inline JSON *strings* on the CLI in the documented usage, not confirmed as a committable file.

Beyond those two, the rest of the landscape is **single- or dual-fact, not multi-fact**: `npm-check-updates` and `taze` each reach two facts (deprecation-or-age) but only to gate *which upgrade to propose*, never to audit or install-gate a whole policy; `dependency-cruiser` reaches license+deprecation but as a minor feature of an import-graph tool with a genuinely committable rules file; `osv-scanner` reaches license+deprecation as a side effect of being a CVE scanner, from a well-resourced maintainer (Google); OWASP Dependency-Track is a real multi-fact OSS policy engine but is server/dashboard-shaped (self-hosted, policy lives in a database via a web UI), not "one file in the repo a CLI reads."

**What a team would have to stitch together today to approximate what siz proposes:** `license-checker-rseidelsohn` (or its named successor) for license, `npm-check-updates --cooldown`/`taze --maturity-period` for publish age, `dependency-cruiser`'s `deprecated` dependencyType or osv-scanner's deprecation check for deprecation, a Bundlephobia CLI wrapper for install size, npq (env-var config) for provenance, and nothing found in this survey for a graded maintenance-staleness signal beyond npq's binary dormant-maintainer flag. That is **five-plus tools, five-plus CLI invocations, five different config surfaces (CLI flags, `.ncurc`, `taze.config.ts`, env vars, `.dependency-cruiser.js`)**, none of which share a schema, a cache, or a single CI step. The seam siz would be filling is real: not the absence of any single fact-check (most facts are checked by *something*), but the absence of one file, one schema, and one exit code spanning all of them — plus the fact that the two tools that get closest (npq, sandworm-audit) are respectively file-less and stale.

---

## Sources

Primary:
- [lirantal/npq README](https://github.com/lirantal/npq/blob/main/README.md) (marshalls list, env-var config, standalone audit mode, `--dry-run`, `--plain`)
- [npq — docs/feature/provenance.md](https://github.com/lirantal/npq/blob/main/docs/feature/provenance.md)
- npm registry API — `registry.npmjs.org/npq`, `/depcheck`, `/knip`, `/license-checker`, `/license-checker-rseidelsohn`, `/dependency-cruiser`, `/lockfile-lint`, `/npm-package-json-lint`, `/publint`, `/npm-check-updates`, `/taze`, `/@antfu/ni`, `/@sandworm/audit` (latest version + publish timestamps, measured 2026-08-05)
- `api.npmjs.org/downloads/point/last-week/<pkg>` for all packages above (measured 2026-08-05)
- [davglass/license-checker README](https://github.com/davglass/license-checker) (`--failOn`, `--onlyAllow`, semicolon delimiters since v17, no config-file policy)
- [RSeidelsohn/license-checker-rseidelsohn README](https://github.com/RSeidelsohn/license-checker-rseidelsohn) (fork rationale, `@npmcli/arborist`, `--clarificationsFile`, self-declared deprecation in favor of `@lizenz/checker`)
- [webpro-nl/knip README](https://github.com/webpro-nl/knip) (scope: unused files/exports/dependencies only)
- [depcheck/depcheck README + repo state](https://github.com/depcheck/depcheck) (archived 2026-06-16, README recommends knip)
- [sverweij/dependency-cruiser rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) (`license`/`licenseNot` conditions, `dependencyTypes` incl. `deprecated`, no age condition)
- [lirantal/lockfile-lint README](https://github.com/lirantal/lockfile-lint) (host/scheme allowlisting, defers to npq for package vetting)
- [tclindner/npm-package-json-lint README](https://github.com/tclindner/npm-package-json-lint) (own-manifest field linting incl. "valid licenses", `.npmpackagejsonlintrc.json`)
- [publint/publint README](https://github.com/publint/publint) (packaging/export correctness only)
- [raineorshine/npm-check-updates README](https://github.com/raineorshine/npm-check-updates) (`--filter`/`--reject`, `--no-deprecated`, `--cooldown`, `.ncurc` config precedence, native PM cooldown inheritance)
- [antfu-collective/taze README](https://github.com/antfu-collective/taze) (`--maturity-period`, `packageMode: 'ignore'`, pnpm/yarn config inheritance)
- [antfu-collective/ni README](https://github.com/antfu-collective/ni) (scope confirmation: PM dispatch only, no fact-checking)
- [sandworm-hq/sandworm-audit README](https://github.com/sandworm-hq/sandworm-audit/blob/main/README.md) (`--license-policy`, `--fail-on`, `--from registry|disk`, "vulnerabilities, license, and metadata issues", no config-file evidence found)
- [google/osv-scanner README](https://github.com/google/osv-scanner) (`--licenses` SPDX allowlist, deps.dev deprecation check, `osv-scanner.toml` present but schema unverified)
- [anchore/grype README](https://github.com/anchore/grype) (vulnerability-only scope as documented; no license/age/deprecation found; policy-gate layer unconfirmed)
- [OWASP Dependency-Track project page](https://owasp.org/www-project-dependency-track/) and [dependencytrack.org](https://dependencytrack.org/) (self-hosted OSS, configurable policy engine incl. license, SBOM ingestion)
- [CycloneDX/cyclonedx-node-npm README](https://github.com/CycloneDX/cyclonedx-node-npm) (SBOM generation only, `--gather-license-texts` experimental)
- [ESLint — `no-restricted-imports` docs](https://eslint.org/docs/latest/rules/no-restricted-imports)
- [eslint-plugin-import — `no-restricted-paths` docs](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md)

Secondary (used only to locate primary sources or fill in undocumented corners; flagged inline as **[unverified]** where the claim rests on this alone):
- Web search summaries surfacing bundle-size CLI wrappers (`bundle-phobia-cli`, `bundlephobia-tool`, `package-size`) and their flags — not independently re-verified against each project's own README in this pass.
- Web search summary of `cost-of-modules` README (siddharthkp/cost-of-modules) — reporting-only tool, no policy feature, treated as reliable enough for a dismissal but not independently fetched.
- `are-the-types-wrong` was not locatable on the npm registry under that exact name during this pass; treated as out of scope rather than mischaracterized.
- `@quicinc/licenselint`, `oss-attribution-generator`, `howfat`, `npm-why`, `socket-cli`'s exact license, and Anchore's policy-gate product boundary (OSS vs. paid) were not independently confirmed with primary sources in the time available for this pass — marked **[unverified]** at point of use above.

Measured locally: none (this document is web-research-only; no local repo measurements were needed for this part, unlike doc 02).
