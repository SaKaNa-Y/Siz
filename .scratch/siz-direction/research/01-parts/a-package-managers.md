# 01a — Package-manager-native policy enforcement

Research question: how much of siz's proposed bet — a committable policy file over package facts (license, install size, publish age, deprecation, provenance/attestation, maintenance staleness), enforced in CI as an audit and at install time as a gate — is already available natively in the package managers, so a team that installs nothing new already has it?

Date: 2026-08-05. Primary sources only (official docs, changelogs, GitHub release notes); secondary sources used only to locate a primary source, and always cited alongside it. Claims not traceable to a primary source are marked **[unverified]**.

---

## 1. pnpm

pnpm is the most-developed case, because release-age and build gating are actively being expanded (v10.16 → v11.x, 2025–2026), and because settings now live in one committable file, `pnpm-workspace.yaml`. As of pnpm v11, only auth/registry settings are read from `.npmrc`; everything else — including all settings below — is workspace-file or global-config only ([pnpm Docs — Settings](https://pnpm.io/settings)). Since v11, `package.json`'s `pnpm` field is also no longer read: "Settings must be defined in `pnpm-workspace.yaml` instead" ([pnpm Docs — package.json](https://pnpm.io/package_json)). That is a meaningful shift toward siz's committable-file model — pnpm got there first, for its own settings.

### Release-age / trust family (`pnpm-workspace.yaml`, "Dependency Resolution" settings group)

| Setting | Added | Default | What it enforces |
| --- | --- | --- | --- |
| `minimumReleaseAge` | v10.16.0 | **1440** (minutes) since v11, **0** before | Minimum minutes since publish before pnpm will install a version — direct or transitive. Blocks fresh releases outright, not by warning. |
| `minimumReleaseAgeExclude` | v10.16.0 (glob support v10.17.0, per-version/`\|\|` disjunction v10.19.0) | `undefined` | Name/glob/version exemptions from the age rule. |
| `minimumReleaseAgeIgnoreMissingTime` | v11.0.0 | `true` | Skip the age check when registry metadata lacks a `time` field (private registries/mirrors). |
| `minimumReleaseAgeStrict` | v11.0.0 | `true` if `minimumReleaseAge` explicitly set, else `false` | Whether pnpm fails resolution (true) or silently falls back to an older, non-conforming version (false) when nothing in range is old enough. |
| `trustPolicy` | v10.21.0 | `off` | `no-downgrade` blocks install if a package's trust level (trusted-publisher > provenance > nothing) has decreased vs. a prior release, judged by publish date not semver. |
| `trustPolicyExclude` | v10.22.0 | `[]` | Name/version exemptions from the trust check. |
| `trustPolicyIgnoreAfter` | v10.27.0 | `undefined` (minutes) | Skip trust check for packages older than N minutes (predates provenance-era publishing). |
| `trustLockfile` | v11.3.0 | `false` | If true, skip re-verifying `minimumReleaseAge`/`trustPolicy` against every existing lockfile entry on install — a performance/trust tradeoff, not a policy widening. |
| `blockExoticSubdeps` | v10.26.0 | `true` since v11.0 (part of the v11 "secure by default" bundle) | Transitive deps must resolve from a trusted registry, workspace link, or trusted git host; direct deps may still use git/tarball URLs. |

Sources: [pnpm Docs — Dependency Resolution settings](https://pnpm.io/settings/dependency-resolution), [pnpm Docs — Mitigating supply chain attacks](https://pnpm.io/supply-chain-security), version/history cross-checked against [pnpm 11.0 release blog](https://pnpm.io/blog/releases/11.0), [pnpm 10.17](https://pnpm.io/blog/releases/10.17), [pnpm 10.19](https://pnpm.io/blog/releases/10.19), [pnpm 11.3](https://pnpm.io/blog/releases/11.3), [pnpm 11.9](https://pnpm.io/blog/releases/11.9), [pnpm/pnpm releases](https://github.com/pnpm/pnpm/releases).

**Assessment against the six fact families:** `minimumReleaseAge`/`trustPolicy` are exactly siz's "publish age" and "provenance" families, already shipped, on by default since v11, and committable. This is the single biggest overlap with siz's proposed bet in the entire PM landscape — pnpm ships an install-time *gate*, not just a report, and it is on by default. `blockExoticSubdeps` is a supply-chain-shape control (dependency *source*, not a fact about the package) — related but not one of siz's six families.

### Build-script gating ("Build" settings group — v11 rewrite)

`onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies` were **removed in v11**, replaced by a single `allowBuilds` map (`{ pkg: true | false }`); an automated codemod (`pnpx codemod run pnpm-v10-to-v11`) migrates old config. Unlisted packages are "disallowed by default and treated as unreviewed" ([pnpm Docs — Build settings](https://pnpm.io/settings/build)).

- `strictDepBuilds` (v10.3.0, default `true`): non-zero exit if any dependency has an unreviewed build script — this is the CI-gateable knob.
- `dangerouslyAllowAllBuilds` (v10.9.0, default `false`): global opt-out that runs every dependency's lifecycle scripts unreviewed, "both now and in the future."
- `verifyDepsBeforeRun` (default `install`): checks `node_modules` freshness on `pnpm run`/`pnpm exec`; not a policy gate, a staleness guard.

`allowBuilds` lives in `pnpm-workspace.yaml` (or is auto-appended there by `pnpm approve-builds` / `--allow-build`), so it is committable. This is a capability/execution-surface gate (what code may run at install time), not one of siz's six fact families, but it is adjacent to "maintenance staleness" in spirit (unreviewed = unknown).

### Dependency-graph shaping

- **`overrides`** (root-only, `pnpm-workspace.yaml`): force a version anywhere in the graph, including peers; supports `npm:` aliases, parent-scoped selectors (`qar@1>zoo`), and (v11.13.0+) "convergence overrides" (`"pkg@": "1.2.3"` rewrites only edges whose declared range already permits it). A value of `-` removes a dependency. This is pnpm's mechanism for acting on an audit finding (pin away from a bad version) but is not itself a policy *check*.
- **`packageExtensions`**: patches missing `dependencies`/`peerDependencies`/`peerDependenciesMeta` onto third-party manifests. Compatibility shim, not policy.
- **`allowedDeprecatedVersions`**: mutes deprecation *warnings* for named packages/ranges. This does not enforce anything about deprecation — it is the opposite, an escape hatch to silence the one deprecation signal pnpm surfaces during install.
- **`peerDependencyRules`** (`ignoreMissing`, `allowedVersions`, `allowAny`): silences peer-dependency warnings. Not a policy gate over package facts; purely peer-range noise control. Facts are workspace/manifest-local (ranges, package names) — no registry facts involved. ([pnpm Docs — Peer dependencies](https://pnpm.io/settings/peer-dependencies))

### `pnpm audit`

Since v11: hits the bulk advisories endpoint (`/-/npm/v1/security/advisories/bulk`), matches by **GHSA**, not CVE (the bulk endpoint omits CVEs). Config lives in `pnpm-workspace.yaml` under an `audit:` block (v11.16.0+): `audit.level` (default `low`) and `audit.ignore` (GHSA id list) — **this is committable**, unlike npm/yarn's CLI-flag-only audit-level. `pnpm audit --fix` writes `overrides` (or, with `--fix=update`, rewrites the lockfile directly) and, if `minimumReleaseAge` is set, appends the fix version to `minimumReleaseAgeExclude` so the patch isn't itself blocked by the age gate. `pnpm audit signatures` (v11.1.0+) verifies ECDSA registry signatures and exits 1 on an invalid or (for a key-publishing registry) unsigned package. ([pnpm Docs — audit](https://pnpm.io/cli/audit))

This is vulnerability auditing (a distinct, older concern), not license/size/deprecation/staleness — but the `audit:` block precedent (committable severity threshold + ignore list) is exactly the shape siz's own policy file would need, and pnpm already ships one for CVEs/GHSAs.

### License and install size — direct answers

- **License:** pnpm enforces nothing about license values. What it *does* ship is `pnpm licenses list` (JSON output with `name`, `version`, `path`, `license`, `author`, `homepage`), a first-party **read-only reporting command**, built specifically because generic tools like `license-checker` can't walk pnpm's `.pnpm` store layout or handle monorepos ([pnpm Docs — `pnpm licenses`](https://pnpm.io/cli/licenses), [pnpm discussion #5690](https://github.com/orgs/pnpm/discussions/5690)). No allow/deny list, no install-time gate, no config file entry for permitted licenses. **Answer: no enforcement, yes reporting.**
- **Install size:** No command, no setting. `pnpm sbom`, `list`, `outdated`, `why`, `licenses`, `peers`, `view` are the "review dependencies" command group; no size-threshold command exists. **Answer: no.**
- **Provenance/attestation:** Partial. `trustPolicy` treats provenance as one tier of evidence in its trust-level comparison (trusted-publisher > provenance > none), and `pnpm audit signatures` verifies registry ECDSA signatures/attestations. There is no standalone "require provenance" toggle independent of the trust-level comparison. **Answer: yes, but folded into `trustPolicy`, not a discrete provenance-required flag.**

### Committability summary for pnpm

Everything above except auth/registry lives in `pnpm-workspace.yaml`, which is committed to the repo by convention ("Because `pnpm-workspace.yaml` is committed to the repository..." — [pnpm Docs — Settings](https://pnpm.io/settings)). This is the strongest committable-policy story of any PM surveyed: release-age gating, trust-level gating, build-script allowlisting, and audit severity/ignore-lists are all one shared, version-controlled file, enforced natively at `pnpm install` time. It runs at install-time; there is no separate `pnpm check`/audit-only mode for `minimumReleaseAge` or `trustPolicy` (the "check" *is* running install, which is only CI-gateable in the sense that CI runs install).

---

## 2. npm (CLI 10/11)

### Release-age gating — arrived Feb 2026, materially behind pnpm

`min-release-age` landed in **npm CLI 11.10.0** (Feb 11, 2026, PR [npm/cli#8965](https://github.com/npm/cli/pull/8965)) as an `.npmrc`/CLI config: "if set, npm will build the npm tree such that only versions that were available more than the given number of days ago will be installed" (unit: **days**, vs. pnpm's minutes) ([docs.npmjs.com/cli/v11/using-npm/config](https://docs.npmjs.com/cli/v11/using-npm/config)). Default `null` (opt-in, unlike pnpm's on-by-default-since-v11 posture).

- **`before`** (pre-existing, longer-standing): absolute-date cutoff, "will rebuild the npm tree such that only versions that were available on or before the `--before` time get installed." `min-release-age` is documented as "a complement to `before`" — a relative-days convenience on top of the same absolute-date mechanism; when both are set in one source, `before` wins.
- **`min-release-age-exclude`** landed later, in **npm CLI 11.17.0 / config-v10.11.0** (June 11, 2026) — glob-matched package exemptions, non-cascading to that package's own deps.
- Both are standard `.npmrc`/config settings, so they can live in a **project `.npmrc`, which is committable** (project-scope `.npmrc` is checked into repos routinely, unlike user/global scope) — but note npm's own docs warn (separately, on the `npmrc` page) that npm now "warns when unknown configuration keys are defined in `.npmrc`" starting 11.2.0, so an org relying on this must pin CLI versions org-wide or risk silent no-ops on older npm (a real gap noted by third parties: **[unverified]** exact wording, but confirmed behaviorally — "If you're running a version of npm older than 11.10, it will silently ignore the new config value," per third-party writeups cross-referencing the PR).

Sources: [npm CLI v11.10.0 release](https://github.com/npm/cli/releases/tag/v11.10.0), [docs.npmjs.com/cli/v11/using-npm/config](https://docs.npmjs.com/cli/v11/using-npm/config) (verified `min-release-age`, `min-release-age-exclude`, `before`, `audit-level`, `engine-strict` definitions and defaults directly on this page).

### `npm audit` / `npm audit signatures`

- `npm audit`: exits 0 if nothing found; failure threshold is controlled by **`audit-level`** (default `null`; `info|low|moderate|high|critical|none`) — explicitly "does not filter the report output, it simply changes the command's failure threshold" ([docs.npmjs.com/cli/v11/commands/npm-audit](https://docs.npmjs.com/cli/v11/commands/npm-audit)). This is a **CLI-flag/config setting**, and if placed in a committed `.npmrc`, is committable; there is no dedicated audit-policy block in `package.json` the way pnpm has `audit:` in `pnpm-workspace.yaml`.
- `npm audit signatures`: verifies registry ECDSA signatures (`ecdsa-sha2-nistp256` only) and **"will also verify the provenance attestations of downloaded packages."** With `--include-attestations --json`, adds a `verified` array containing full sigstore DSSE bundles. This is npm's answer to provenance/attestation — real, but a manual/CI-invoked check, not an install-time gate (a compromised-but-signed... or unsigned... package still installs via plain `npm install`; only running `audit signatures` afterward catches it).

### Overrides, engine-strict, license

- **`overrides`** (root `package.json` field): forces a version anywhere in the graph, including a fork or a security patch; "are only considered in the root `package.json` file" so a dependency cannot impose policy on its consumers. Same shape as pnpm's — a remediation mechanism, not a policy check.
- **`engine-strict`** (default `false`): refuses install if a package's `engines` field is incompatible with the running Node; overridable with `--force`. Adjacent to policy but not one of the six fact families.
- **License:** confirmed **no enforcement whatsoever**. `license` in `package.json` is pure metadata — "so that people know how they are permitted to use it" — with SPDX recommended but not validated at install or publish time; only the *legacy object/array shape* (`license: {type,url}`, `licenses: [...]`) draws any pushback, and that pushback is "deprecated" labeling, not a rejection ([docs.npmjs.com/cli/v11/configuring-npm/package-json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)). Contrast: npm *does* refuse to publish a `private: true` package — proving npm is capable of hard publish-time refusal when it chooses to, it simply never chose to for license.
- **Allow/deny list of package names:** none found. `overrides` substitutes packages; `os`/`cpu`/`libc` support a `!`-prefixed deny syntax but that gates *platforms*, not package identity or facts.

### Verdict for npm on siz's six families

License: no. Install size: no mechanism found (no `npm ls --size` or equivalent). Publish age: yes, since 11.10.0, opt-in, `.npmrc`-committable. Deprecation: no dedicated gate — `npm deprecate` only *sets* the flag on publish; nothing in npm CLI refuses to *install* a deprecated package (compare to pnpm's `allowedDeprecatedVersions`, which exists purely because deprecation *warnings* already fire on install — an npm-inherited behavior — and pnpm needed a way to mute them; npm itself has the same warning-not-gate behavior). Provenance/attestation: yes, via `npm audit signatures`, but as a separate invoked check, not a default install gate. Maintenance staleness (as distinct from publish age of the *installed* version): not found as a distinct concept in npm's docs.

---

## 3. yarn (Berry / v4) — constraints

Yarn's **constraints** engine is the closest thing to a genuine policy *language* among all PMs surveyed, but its query surface is narrower than the marketing suggests.

### Two engines

- **Legacy**: Prolog, `constraints.pro`, "still supported but should be considered deprecated" per the current docs (docs moved to the v3 site — I could not pull specific predicate names from the current docs; anything about `gen_enforced_dependency` etc. would need the v3 site directly and is **not verified here**).
- **Current**: JavaScript, `defineConstraints`/`defineConfig` in `yarn.config.cjs` at the repo root, typed via `@yarnpkg/types` ([yarnpkg.com/features/constraints](https://yarnpkg.com/features/constraints)).

### Queryable surface — the critical finding

The docs are explicit: the JS engine "currently supports two main targets": **workspace dependencies** and **arbitrary `package.json` fields**. Explicitly *not yet* supported (flagged "PRs welcome"): **transitive dependencies** and **project structure**.

**This directly answers the research question's sharpest sub-question: a constraint cannot see registry-sourced facts — no license, no publish date, no deprecation flag, no unpacked size — because it cannot even see transitive dependencies, let alone reach out to the registry for metadata about them.** The API surface demonstrated in the docs (`Yarn.dependencies()`, `Yarn.dependencies({ident})`, `Yarn.workspaces()`, `dep.update(range)`, `workspace.set('engines.node', ...)`) is entirely local: it reads and rewrites your own workspaces' manifests and their declared dependency ranges. Peer dependencies are visible as `dependency.type === 'peerDependencies'`, again a manifest field, not a registry fact.

So: **yarn constraints could, in principle, be siz's policy *engine* shape (declarative JS rules, `--fix` semantics, workspace-wide enforcement) — but today it has zero access to any of siz's six fact families**, because none of them exist in a workspace manifest or lockfile; they are all registry-only or disk-only (install size) facts. Building "license must be MIT or Apache-2.0" as a yarn constraint is not possible without a plugin that separately fetches and injects that data into the graph yarn constraints can see — which is exactly the gap a tool like siz could fill, but yarn itself does not.

### Audit and supply-chain settings

- **`yarn npm audit`**: direct-deps-by-default; `-A/--all` and/or `-R/--recursive` for full project; `--environment production` excludes devDependencies; severity levels `info|low|moderate|high|critical`; non-zero exit on any report found regardless of `--json` ([yarnpkg.com/cli/npm/audit](https://yarnpkg.com/cli/npm/audit), [yarnpkg.com/features/security](https://yarnpkg.com/features/security)). Explicitly **not run automatically on install** — "should rather be performed in a cron task."
- **`npmAuditExcludePackages`** / **`npmAuditIgnoreAdvisories`** (`.yarnrc.yml`, both default `[]`): glob-matched package/advisory exclusions — same committable-ignore-list shape as pnpm's `audit.ignore`.
- **`npmMinimalAgeGate`** — Yarn's `minimumReleaseAge` equivalent, **Berry 4.10.0+**, `.yarnrc.yml`, minutes (duration-string support advertised but has a known parsing bug for day-suffixes per [yarnpkg/berry#6991](https://github.com/yarnpkg/berry/issues/6991) — **[unverified]** whether fixed as of this writing). Exemptions via `npmPreapprovedPackages`. This puts Yarn roughly level with pnpm on release-age gating, slightly behind on maturity (pnpm's has three more releases of refinement: prerelease handling, lockfile-trust interaction, exclude-glob support).
- **`approvedGitRepositories`**: allowlist of git URL globs — "Yarn will block any git dependency whose normalized repository URL doesn't match one of these patterns." This *is* a genuine allow-list mechanism, just scoped to git-sourced deps, not registry packages generally.
- **`enableScripts`** (default `false`): blocks third-party `postinstall`; workspace's own scripts still run.
- **`enableHardenedMode`**: "Yarn will query the remote registries to validate that the lockfile content matches the remote information," auto-enabled on GitHub PRs from public repos — a supply-chain integrity check, not one of siz's six families.
- **`packageExtensions`**: same compatibility-shim role as pnpm's version; explicitly *only* for adding missing fields, not rewriting existing ones (use `resolutions` for that).

All of the above (`.yarnrc.yml`, `yarn.config.cjs`) are project-root files intended to be committed — same committability story as pnpm.

### License / size / deprecation / provenance for yarn

Nothing found for license enforcement, install-size limits, or deprecation gating in constraints, `.yarnrc.yml`, or the audit command — same gap as npm and pnpm. `npmPublishProvenance` exists as a *publish*-side setting (whether Yarn generates provenance when *you* publish), not a *consumption*-side provenance-verification gate; I did not find a Yarn equivalent to `npm audit signatures` or pnpm's `trustPolicy` for *verifying* provenance on install — **[unverified]**, worth a follow-up check directly against `yarnpkg.com/cli/npm/audit` and the security features page for anything named after signatures/attestations, which the fetched content did not surface.

---

## 4. bun

Bun ships a smaller but structurally similar set, all in `bunfig.toml`, which is committable (project-root file).

- **`install.minimumReleaseAge`** — Bun 1.3, **seconds** (vs. pnpm's minutes, npm/yarn's days/minutes), default `null` (disabled, opt-in — same posture as npm, unlike pnpm's on-by-default). Companion **`install.minimumReleaseAgeExcludes`** (default `[]`, package-name array, no glob support noted). Applies to all deps, direct and transitive; existing lockfile entries are unaffected — only new resolutions are filtered. Known rough edges: a `bunx`/global-bunfig no-op bug reported open at [oven-sh/bun#30748](https://github.com/oven-sh/bun/issues/30748) and [#22679](https://github.com/oven-sh/bun/issues/22679) — **the feature exists but has documented gaps in enforcement completeness**, unlike pnpm's which has had three minor releases of hardening. Sources: [bun.com/docs/runtime/bunfig](https://bun.com/docs/runtime/bunfig).
- **`bun audit`** — introduced **Bun 1.2.15**, npm-audit-compatible (sends installed package+version list to the npm registry), `--audit-level`, `--prod`, `--ignore <CVE-ID>` (note: CVE, not GHSA, unlike pnpm's post-v11 GHSA-only stance), `--json`. Exit 0/1 on found/not-found. No auto-fix. Packages from non-default registries are skipped entirely — a real gap for anyone using a private registry/proxy. Source: [bun.com/docs/pm/cli/audit](https://bun.com/docs/pm/cli/audit).
- **`trustedDependencies`** (`package.json` field, committable): Bun is "default-secure" — lifecycle scripts (`preinstall`/`install`/`postinstall`/`prepare`) run only for packages explicitly listed, or in Bun's own curated built-in allowlist for popular packages (esbuild, sharp, etc. — exact list **[unverified]**, not enumerated in fetched docs). `bun pm trust <pkg>` writes to this field. Scope is non-transitive: trusting `packageA` does not trust scripts belonging to `packageA`'s own dependency `packageB`. `install.ignoreScripts` (default `false`) is the global kill switch, overriding `trustedDependencies` entirely.
- **`install.security.scanner`** (`bunfig.toml`, `[install.security]` block): pluggable install-time scanner package (e.g. Socket's, per the Bun 1.3 blog and Socket's own integration post) that can **cancel installation** on fatal findings. This is the one genuine install-time *gate* mechanism found in Bun beyond release-age — but it delegates the actual policy logic to an external, non-standardized scanner package; bun itself defines only the plug interface, not policy content. Structurally this is the shape Socket already occupies for the whole ecosystem (see companion research doc `02-transitive-audit-feasibility.md`, §4) rather than something native to bun.
- **No license or install-size command or setting found** — same gap as every other PM. No allow/deny list of package names by identity (only the security-scanner hook and `trustedDependencies` for script execution).

---

## 5. deno (brief)

Deno's relevance to siz is narrower — its policy surface is a *runtime capability* model, not a package-selection or fact-based gate.

- Deno's default posture is no I/O access at all; npm packages loaded via `npm:` specifiers are exempt from permission checks **at import/load time**, but once their code executes it is fully subject to `--allow-read`/`--allow-net`/`--allow-env`/etc., same as any other Deno code ([docs.deno.com/runtime/fundamentals/security](https://docs.deno.com/runtime/fundamentals/security/)).
- Lifecycle/postinstall scripts for npm deps are **not run by default**; `--allow-scripts` (CLI) or `deno approve-scripts` (interactive) opt in per package. In a workspace, `deno.json`'s `allowScripts` "must be defined at the workspace root, so the security policy is consistent across all packages" — this makes Deno's script-approval list **committable** (`deno.json`), matching Bun's `trustedDependencies` shape.
- Deno's model constrains *what code can do at runtime* (filesystem, network, env, subprocess), not *which package versions/licenses/ages may be present* — it is orthogonal to all six of siz's fact families. It is the strongest **capability**-based gate of the five PMs, but answers a different question entirely (blast radius if compromised, not "is this package acceptable to depend on").
- No native audit/license/size command was found for Deno in the sources checked. **[unverified further]** — did not check `deno info`/`deno outdated` for size-adjacent output.

---

## Summary table

| Fact family | pnpm | npm | yarn (Berry) | bun | deno |
| --- | --- | --- | --- | --- | --- |
| **License** | No — `pnpm licenses list` reports only, no gate, no allow/deny | No — metadata only, unvalidated even for legacy shapes | No — not in constraints' reach (workspace-only), no report command found | No — no command or setting found | No — not applicable to its model |
| **Install size** | No — no command or setting | No | No | No | No |
| **Publish age / release recency** | **Yes** — `minimumReleaseAge`, on by default since v11.0, committable in `pnpm-workspace.yaml`, exclusions + strict/lenient modes | Partial — `min-release-age`/`before`, opt-in, since 11.10.0 (Feb 2026), `.npmrc`-committable, exclude-list added later and less mature | Partial — `npmMinimalAgeGate`, Berry 4.10.0+, `.yarnrc.yml`-committable, has an open duration-parsing bug | Partial — `install.minimumReleaseAge`, Bun 1.3, `bunfig.toml`-committable, opt-in, has open enforcement-gap issues (bunx/global config) | No |
| **Deprecation** | Partial — warns on install (inherited npm-registry behavior); `allowedDeprecatedVersions` only *mutes* the warning, doesn't gate | Partial — warns on install via `npm deprecate` metadata; no install-blocking gate | **[unverified]** — not found in fetched docs; likely inherits npm's warn-only behavior since it reads the same registry metadata | **[unverified]** — not found | No |
| **Provenance / attestation** | Partial — `trustPolicy` (`no-downgrade`) treats provenance as a trust tier and can gate on its *regression*, not its *absence per se*; `pnpm audit signatures` verifies signatures | Partial — `npm audit signatures --include-attestations` verifies sigstore bundles, but as a separate invoked check, not a default install gate | **[unverified]** — no signature/attestation-verification command found in fetched docs (only publish-side `npmPublishProvenance`) | No dedicated attestation verification found; `install.security.scanner` can enforce arbitrary policy incl. provenance, but only via a third-party scanner package | No |
| **Maintenance staleness** (repo/maintainer inactivity, as distinct from single-version publish age) | No — not a distinct concept from `minimumReleaseAge` | No | No | No | No |

**Bottom line:** the one fact family where "a team that installs nothing new already has it" is **substantially true today** is publish-age gating — all four JS package managers now ship *some* version of it, pnpm's is the most mature and is on by default, and it is genuinely install-time-enforced and committable everywhere. Provenance/attestation is *partially* covered by npm and pnpm, but as either a separate CLI-invoked check (npm) or folded into a broader trust-regression policy (pnpm), not a discrete "require provenance" toggle. **License, install size, deprecation-as-a-gate, and maintenance staleness are uncovered by every package manager surveyed** — license and size have first-party *reporting* (pnpm's `licenses list`) but zero enforcement anywhere; deprecation only ever warns, never blocks; maintenance staleness (as opposed to single-version publish age) does not exist as a native concept at all. This is the gap siz's policy-file bet would actually be filling — not release-age, which the ecosystem has now converged on natively, but the other five families, especially license and staleness, where nothing native exists to enforce, only to report or not even that.

---

## Sources

Primary — pnpm:
- [pnpm Docs — Settings (pnpm-workspace.yaml)](https://pnpm.io/settings)
- [pnpm Docs — package.json](https://pnpm.io/package_json) (removal of `pnpm` field reading since v11)
- [pnpm Docs — Dependency Resolution settings](https://pnpm.io/settings/dependency-resolution) (`minimumReleaseAge` family, `trustPolicy` family, `overrides`, `packageExtensions`, `allowedDeprecatedVersions`)
- [pnpm Docs — Build settings](https://pnpm.io/settings/build) (`allowBuilds`, `strictDepBuilds`, `dangerouslyAllowAllBuilds`, `verifyDepsBeforeRun`, removed v10 build settings)
- [pnpm Docs — Mitigating supply chain attacks](https://pnpm.io/supply-chain-security)
- [pnpm Docs — Peer dependencies settings](https://pnpm.io/settings/peer-dependencies)
- [pnpm Docs — `pnpm audit`](https://pnpm.io/cli/audit)
- [pnpm Docs — `pnpm licenses`](https://pnpm.io/cli/licenses) and [pnpm discussion #5690](https://github.com/orgs/pnpm/discussions/5690)
- [pnpm 11.0 release blog](https://pnpm.io/blog/releases/11.0), [10.17](https://pnpm.io/blog/releases/10.17), [10.19](https://pnpm.io/blog/releases/10.19), [11.3](https://pnpm.io/blog/releases/11.3), [11.9](https://pnpm.io/blog/releases/11.9), [pnpm/pnpm GitHub releases](https://github.com/pnpm/pnpm/releases)

Primary — npm:
- [docs.npmjs.com — `npm audit`](https://docs.npmjs.com/cli/v11/commands/npm-audit)
- [docs.npmjs.com — npm config reference](https://docs.npmjs.com/cli/v11/using-npm/config) (`min-release-age`, `min-release-age-exclude`, `before`, `audit-level`, `engine-strict` — definitions/defaults verified directly)
- [docs.npmjs.com — `.npmrc`](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc)
- [docs.npmjs.com — package.json reference](https://docs.npmjs.com/cli/v11/configuring-npm/package-json) (license field is metadata-only, `private`/`engines`/`devEngines` enforcement contrast, `overrides`, `os`/`cpu`/`libc` deny syntax)
- [npm/cli PR #8965 — add min-release-age](https://github.com/npm/cli/pull/8965) and [npm/cli v11.10.0 release](https://github.com/npm/cli/releases/tag/v11.10.0)

Primary — yarn:
- [yarnpkg.com/features/constraints](https://yarnpkg.com/features/constraints) (JS `defineConstraints`/`yarn.config.cjs`; explicit "two main targets" scope statement; transitive deps and project structure explicitly out of scope)
- [yarnpkg.com/configuration/yarnrc](https://yarnpkg.com/configuration/yarnrc) (`npmAuditRegistry`, `npmAuditExcludePackages`, `npmAuditIgnoreAdvisories`, `approvedGitRepositories`, `npmPreapprovedPackages`, `enableStrictSsl`, `enableHardenedMode`, `enableScripts`, `packageExtensions`)
- [yarnpkg.com/cli/npm/audit](https://yarnpkg.com/cli/npm/audit) and [yarnpkg.com/features/security](https://yarnpkg.com/features/security)

Primary — bun:
- [bun.com/docs/runtime/bunfig](https://bun.com/docs/runtime/bunfig) (`install.minimumReleaseAge`, `install.minimumReleaseAgeExcludes`, `install.ignoreScripts`, `install.security.scanner`, `install.frozenLockfile`)
- [bun.com/docs/pm/cli/audit](https://bun.com/docs/pm/cli/audit)
- [oven-sh/bun#30748](https://github.com/oven-sh/bun/issues/30748), [oven-sh/bun#22679](https://github.com/oven-sh/bun/issues/22679) (documented enforcement gaps in `minimumReleaseAge`)

Primary — deno:
- [docs.deno.com/runtime/fundamentals/security](https://docs.deno.com/runtime/fundamentals/security/)
- [docs.deno.com/runtime/fundamentals/node](https://docs.deno.com/runtime/fundamentals/node/) (npm postinstall scripts gated behind `--allow-scripts`)

Secondary (used only to locate/cross-check primary sources, not as basis for claims): [Socket.dev — npm introduces minimumReleaseAge](https://socket.dev/blog/npm-introduces-minimumreleaseage-and-bulk-oidc-configuration); [craigory.dev — Locking down dependency installs across npm, pnpm, yarn, and bun](https://craigory.dev/blog/2026-05-29/package-manager-release-cooldown/); [charpeni.com — Protecting Against Compromised Packages with Minimum Release Age](https://charpeni.com/blog/protecting-against-compromised-packages-with-minimum-release-age); [Medium — Yarn 4.10 Adds a Release-Age Gate](https://medium.com/@roman_fedyskyi/yarn-4-10-adds-a-release-age-gate-for-safer-dependency-management-765c2d18149a); [Socket.dev — Bun 1.3 security scanner API](https://socket.dev/blog/socket-integrates-with-bun-1-3-security-scanner-api).
