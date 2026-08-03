# 02 — What would auditing the transitive tree actually cost?

Research findings for wayfinder ticket `02-transitive-audit-feasibility`.
Date: 2026-08-02. Sources are primary (official docs, format specs, library source/READMEs) except where marked.

---

## 1. Reading the resolved package set out of a lockfile

### Per-format verdict

| Format | Shape | Library | Verdict |
| --- | --- | --- | --- |
| `pnpm-lock.yaml` | YAML, `packages:` + `snapshots:` | `@pnpm/lockfile.fs` (first-party, renamed from `@pnpm/lockfile-file`) | **Library available**, or trivially hand-rolled — siz already depends on `yaml` |
| `package-lock.json` | JSON, `packages:` keyed by node_modules path | none needed — it is JSON | **Hand-rolled, trivial** |
| `yarn.lock` v1 | custom syml-ish text | `@yarnpkg/lockfile` (frozen, last publish v1.1.0 ~8y ago) | **Library available but unmaintained** |
| `yarn.lock` berry (v2+) | YAML-ish syml, comma-split keys | `@yarnpkg/parsers` (`parseSyml`) — first-party, handles v1 *and* berry | **Library available, maintained** |
| `bun.lock` | JSONC | none first-party; any JSONC parser | **Hand-rolled, undocumented schema** |
| `bun.lockb` | proprietary binary | none | **Infeasible** without shelling out to `bun` |

### Detail and caveats

**pnpm.** The pnpm team's own answer to "is there a module for parsing pnpm-lock.yaml" points at `@pnpm/lockfile.fs` (`readWantedLockfile(pkgPath, opts)`), plus `@pnpm/lockfile.types` and the format spec at `pnpm/spec`. But the honest read is that for a *read-only* consumer this is overkill: the file is plain YAML and siz already ships `yaml` as a dependency. From siz's own lockfile (`lockfileVersion: '9.0'`):

```yaml
packages:
  '@babel/generator@8.0.0-rc.6':
    resolution: {integrity: sha512-6mIzgVK8...==}
    engines: {node: ^22.18.0 || >=24.11.0}
```

The key *is* `name@version` — the resolved set is `Object.keys(lock.packages)` with a scope-aware split on the last `@`. Two traps: lockfile versions 5.x / 6.x / 9.x differ in key naming, and pnpm creates a distinct entry per unique peer-dependency combination, so the same version can appear multiple times with a peer hash suffix (`foo@1.0.0(bar@2.0.0)`) — you must dedupe.

**npm.** `package-lock.json` is JSON with `packages` mapping node_modules paths (`""` = root, `"node_modules/foo"`, `"node_modules/foo/node_modules/bar"`) to entries. `lockfileVersion` is `1` (npm 5–6), `2` (npm 7–8), or `3` (npm 9+). **Critically: npm's docs state that `bin, license, engines, dependencies, optionalDependencies` are copied straight from each package's `package.json` into its lockfile entry.** For npm projects the license signal is therefore *already in the lockfile* — zero network. No other lockfile format does this.

**Yarn.** `@yarnpkg/lockfile` is frozen (dev moved to the Berry repo) and has a well-known CRLF failure mode (`SyntaxError: Unknown token 3:1 in lockfile`, worked around by stripping `\r`) — relevant here, since this repo already has a CRLF footgun in its format gate. The maintained path is `parseSyml` from `@yarnpkg/parsers`, which reads both formats; Berry's own `LegacyMigrationResolver.ts` distinguishes them by testing for a `__metadata` key. Berry adds protocol prefixes a consumer must branch on: `npm:`, `workspace:`, `patch:`.

**Bun.** Bun v1.2 made the text `bun.lock` the default; it is JSONC (comments + trailing commas), with top-level `lockfileVersion`, `workspaces`, `packages`. The schema is **not documented** — Bun's own blog post shows exactly one example, a git dependency, and never enumerates the tuple slots:

```jsonc
"packages": {
  "uWebSocket.js": ["uWebSockets.js@github:uNetworking/uWebSockets.js#6609a88", {}, "uNetworking-uWebSockets.js-6609a88"],
}
```

Registry-sourced entries serialize differently, and nothing authoritative describes how. `bun.lockb` is a proprietary binary format with no public parser — the only sane handling is to detect it and tell the user to run `bun install --save-text-lockfile`.

### Is there one library for all of them?

`snyk-nodejs-lockfile-parser` (Apache-2.0, ~55k weekly downloads) is the closest: dep-graph output for `package-lock.json` v2/v3, `yarn.lock`, and `pnpm-lock.yaml` 5.x/6.x/9.x; legacy dep-tree for `package-lock.json` and yarn v1/v2. **No Bun support.** Its output is shaped around Snyk's dep-graph model rather than a neutral one, and it carries version-detection, aliasing (`npm:` prefix), workspace and cycle handling that siz would inherit whole. Nx has an equivalent set of parsers but they live inside `@nx/js` and are not published standalone.

**Realistic verdict for siz:** four separate ~50–150-line readers, sharing a `{ name, version }[]` output type, is less code and less risk than adopting `snyk-nodejs-lockfile-parser` — *if* the only thing wanted is the flat resolved set. If the actual dependency *graph* (who pulled what in, for a `siz why`) is wanted, that flips: graph reconstruction is where the format-specific pain concentrates, and hand-rolling four of those is a different order of work.

---

## 2. Volume — the multiplier

### Measured, on real repos on this machine (2026-08-02)

Direct = `dependencies` + `devDependencies` in the root `package.json`; resolved = entries under `packages:` in `pnpm-lock.yaml`.

| Repo | Direct | Resolved | Multiplier |
| --- | ---: | ---: | ---: |
| `Siz` (this repo) | 20 | 334 | **17x** |
| `npmx.dev` | 106 | 2208 | 21x |
| `vitejs/devtools` | 68 | 1778 | 26x |
| `config-inspector` | 47 | 1316 | 28x |
| `node-modules-inspector` | 44 | 1597 | 36x |
| `ghfs` | 30 | 1298 | 43x |
| `devtools-1` | 45 | 1919 | 43x |
| `devframe` | 20 | 1647 | 82x |
| `json-render` | 20 | 2412 | **121x** |

**The number that matters is not the ratio, it is the absolute: a mid-size JS app resolves to 1300–2500 packages.** The ratio varies wildly (17x–121x) because it is dominated by how few direct deps happen to be declared; the absolute count is remarkably stable, because everyone's build toolchain is the same size. Siz itself is the outlier at 334 precisely because it is a lean CLI with no framework and no bundler-adjacent toolchain.

Caveat: these counts include devDependencies, and in JS repos the dev toolchain dominates the tree. A production-only tree is typically a small fraction. That distinction matters a lot for a license audit (you generally care about what ships) and less for a supply-chain audit (build-time code executes on your machine).

### Cross-checks against published research

- The "dependency amplification" study across 500 projects in 10 ecosystems puts npm's *mean* transitive:direct amplification at **4.32x**, well below what I measured. That study is project-level and likely production-scoped; my numbers are dev-inclusive. Both can be true.
- "Small World with High Risks" (arXiv 1902.09217) found the average npm *package* reached ~80 transitive dependencies by 2018 — a per-package figure, not per-project, so not directly comparable.
- Secondary sources describing practice put a 50-dep `package.json` at 500–1500 installed, and 3000+ for large enterprise projects — consistent with what I measured.

### What that costs siz today

`src/core/packument.ts` does one `GET registry.npmjs.org/<pkg>/latest` per package at `PACKUMENT_CONCURRENCY = 8` with a 4 s timeout. At a realistic 120 ms per request:

- 20 search rows → ~0.3 s. Fine. This is what it was designed for.
- 2000 resolved packages → **2000 / 8 × 120 ms ≈ 30 s**, and ~2000 HTTP requests against a public registry from a CLI, per run, per developer, on every CI job.

Raising concurrency to 32 brings it to ~7.5 s, which is survivable but starts to look like abuse of a free service. There is no bulk-manifest endpoint on `registry.npmjs.org`.

**A second, easily-missed problem:** `packument.ts` fetches `/latest`. For a transitive audit that is the wrong version — you need the manifest of the *resolved* version (`/<pkg>/<version>`), because the license or the deprecation status of `lodash@3.10.1` in your tree is not the license or status of `lodash@latest`. The existing module cannot be pointed at the transitive tree without changing its URL shape and its cache key from `name` to `name@version`. That is small in lines and large in meaning: the search-row cache and the audit cache are not the same cache.

---

## 3. Lockfile sourcing vs reading `node_modules`

| | Lockfile | `node_modules` |
| --- | --- | --- |
| Requires install | No | **Yes** |
| Works in CI pre-install | Yes | No |
| Gives license/engines | Only npm's format | **Yes, all of them** — it's reading real `package.json` files |
| Gives install size | No | Yes (measurable on disk) |
| Gives publish date / deprecation / provenance | No | **No** — registry-only facts |
| Format churn risk | High (4 formats × N versions) | Low (it's just `package.json`) |
| Reflects reality | The intent | What is actually there |

The decisive asymmetry: **only npm's lockfile carries `license`.** I verified this on siz's own file — `grep -ci license pnpm-lock.yaml` returns **0**. pnpm entries carry `resolution.integrity`, `engines`, `hasBin` and nothing else. So lockfile sourcing gets you the *set* of packages and essentially nothing about them; you then need 2000 registry fetches anyway. Reading `node_modules` gets you the set *and* the license *and* the size for free, with no network at all.

### How pnpm's layout complicates the `node_modules` read

Measured on this repo:

```
node_modules/            → 18 entries  (exactly the direct deps, all symlinks)
node_modules/.pnpm/      → 274 real package directories
pnpm-lock.yaml packages: → 334 entries
```

Three consequences:

1. **A naive recursive walk of `node_modules/*/package.json` under pnpm returns only the direct dependencies.** Transitive packages are not there. This is not a depth problem you can fix with a deeper glob — the tree is strict and non-hoisted by design. A tool written against npm/yarn's hoisted layout silently produces a *direct-only* answer on pnpm rather than an error, which is the worst failure mode available.
2. The real packages live in `node_modules/.pnpm/<name>@<version>/node_modules/<name>/`, with `+` substituted for `/` in scoped names (`@babel+parser@8.0.0-rc.6`). Readable, but it is a pnpm-specific code path — and pnpm has changed this layout before.
3. **274 on disk vs 334 in the lockfile.** The lockfile is a superset: it records optional and platform-specific packages (this is Windows) that were never installed here. So the two sources genuinely disagree about what "your dependencies" means, and neither is wrong.

Yarn Berry with PnP has no `node_modules` at all, which removes the option entirely for that configuration.

**This is exactly why pnpm shipped `pnpm licenses list`.** The contributor who added it did so specifically because tools like `license-checker` walk `node_modules` and cannot handle pnpm's layout, and cannot separate output per package in a monorepo. Its JSON output includes `name`, `version`, `path` (into `node_modules/.pnpm/...`), `license`, `author`, `homepage`. That command already exists, is first-party, is monorepo-aware, and requires no network — which is a meaningful competitive fact for any siz license audit that goes transitive.

---

## 4. What existing full-tree tools actually do

- **`license-checker`** (and the maintained fork `license-checker-rseidelsohn`) reads the **installed tree on disk**. The original used `read-installed`; the fork uses `@npmcli/arborist` — the same library that backs `npm ls`. It reads each package's `package.json`, validates against `spdx`, and on failure falls back to text-matching `LICENSE`/`LICENCE`/`COPYING`/`README`, marking guesses with `*`. Requires a completed install. Single project root only; monorepos need a wrapper. Does not handle pnpm's layout.
- **`npm ls`** reads the installed tree by default, and explicitly reports "the logical dependency tree, based on package dependencies, not the physical layout of your `node_modules` folder". `--all` recurses (depth `Infinity`); `--package-lock-only` switches the source to `package-lock.json` and ignores `node_modules` entirely. So npm ships both sourcing strategies behind a flag — a useful precedent, and confirmation that neither is strictly better.
- **`pnpm licenses list`** — installed store, `--prod`/`--dev`/`--no-optional`/`--json`/`--long`. Reports the manifest `license` field, with `licenseContents` only as a fallback when the manifest doesn't say.
- **`socket.dev`** takes the opposite route: **it does no local resolution at all for npm.** The CLI globs for manifest + lockfile pairs (`package.json`, `package-lock.json`, `pnpm-lock.yaml`, …), respecting `.gitignore` and `socket.yml` ignores, uploads *only those files*, and the server does the resolution and analysis. Ecosystems without a checked-in file describing the tree (Gradle, sbt, Bazel, Conda) get a local `socket manifest <x>` pass first, emitting `.socket.facts.json`. Socket also ships a "missing lockfile" alert, because without one the tree isn't pinned.

**The pattern:** every tool that reports *package-intrinsic facts* (license, files) reads the disk. Every tool that reports *registry-intrinsic facts* (advisories, publish behaviour, maintainer signals) has a server. **No widely-used tool fetches per-package registry metadata for a 2000-package tree from the client.** Socket didn't build a server because it's a company; it built one because that is where the shape of the problem pushes you.

---

## 5. Caching

**Is it feasible?** Yes, and the precedent is strong.

- npm's own cache is `_cacache` (`~/.npm/_cacache`; `%LocalAppData%/npm-cache` on Windows), a content-addressable store under `content-v2/sha512`, accessed through `pacote`, with integrity verification on both insert and extract. The `cacache` library is usable standalone and exposes `get`/`put`/`ls`/`rm`/`verify`, with HTTP metadata (including ETags) held in the index entry.
- `pacote` additionally takes a `packumentCache` Map for in-process reuse — "it's unlikely to change within a single command" — which is precisely the model `src/core/packument.ts` already implements.

**What invalidates it — and why the answer is unusually good here.** The cache key for a transitive audit is `name@version`, and **a published npm version is immutable**: `lodash@4.17.21`'s license, `unpackedSize`, and publish timestamp will never change. That makes the vast majority of entries cacheable *permanently*, which is a far better position than the search path (keyed on `latest`, which moves).

The mutable exceptions, and what they cost:

| Fact | Mutable? | Invalidation |
| --- | --- | --- |
| `license`, `dist.unpackedSize`, publish date | No — immutable per version | Never (cache forever) |
| **Deprecation** | **Yes** — `npm deprecate` mutates a published version | TTL, hours-to-days |
| Provenance / attestations | Effectively no | Never |
| Unpublish (rare, ≤72h window) | Yes | TTL |
| Advisories, if ever added | Yes, continuously | TTL, hours |

So: a JSON-or-cacache file under siz's existing config dir (`core/paths.ts` — `%APPDATA%\siz` / `~/.config/siz`), keyed `name@version`, storing the immutable projection forever and deprecation behind a short TTL, is straightforward. The **second** run of an audit on an unchanged tree is then near-instant and offline. Only the first is 30 seconds.

Two real costs. First, size: 2000 entries per project, overlapping heavily across projects, so a shared cache grows to tens of thousands of entries on a working developer's machine — small in bytes, but it needs an eviction story and a `siz cache clean`. Second, and more importantly: **a cold cache in CI is the normal case, not the exception.** CI is where a policy gate actually runs, and CI starts cold unless the user configures cache restoration. Caching fixes the local developer's experience and does approximately nothing for the use case that motivates the feature.

---

## Bottom line

**A transitive audit is a plausible later increment for siz *if and only if* it sources facts from disk rather than from the registry. If it needs registry facts for the whole tree, it is a different product.**

The split falls exactly along which facts are wanted:

- **License, install size, engines, declared metadata** — these live in each package's `package.json`, which is already on disk after an install. A transitive license audit is a *plausible later ticket*: read the tree (four lockfile readers, or `node_modules` with a pnpm-specific path, or shell out to `pnpm licenses list --json`), read the manifests, zero network, ~1–2 s for 2000 packages. This is a real feature and it is in reach. It is also a crowded room — `license-checker` and `pnpm licenses list` already occupy it, so siz's contribution would have to be the *policy layer over* the result, not the result.
- **Publish age, deprecation, provenance, momentum, advisories** — these exist only at the registry, and at 1300–2500 packages per project there is no client-side way to get them that isn't ~2000 HTTP requests per run. Caching makes the second local run free and leaves CI, the case that matters, unchanged. Doing this properly means a server that pre-computes registry facts — which is Socket's business model, not a CLI feature. That is **a different product**, and it is worth saying plainly that it is a different product with a hosting bill and an on-call rotation, not a bigger ticket.

Two things sharpen the map's existing "direct dependencies" decision rather than overturning it:

1. **Direct-vs-transitive is not the real axis; disk-facts-vs-registry-facts is.** Siz's differentiated signals (provenance, publish age, deprecation, momentum) are *precisely* the registry-only ones. The facts that scale to the full tree are the commodity ones. Charting's instinct to start at direct deps happens to be the only scope where siz's actual differentiators are affordable — that is worth recording as the reason, because it is a stronger reason than "start small".
2. **The existing `packument.ts` is not the seed of this.** It is keyed on package name and fetches `/latest`; a transitive audit needs `name@version` and `/<pkg>/<version>`. The map's "fact reuse and caching between search and audit" fog patch should graduate knowing these are two different caches with two different invalidation stories — the search cache is session-scoped and inherently stale-tolerant, the audit cache is on-disk and mostly immutable.

If the transitive question is ever reopened, the cheapest honest version is: **`siz audit --transitive` for license only, sourced from disk, with a clear error when there is no install and a clear error on `bun.lockb`.** Everything past that is a server.

---

## Sources

Primary:
- [npm Docs — `package-lock.json`](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json) (lockfileVersion semantics, `packages` shape, license/engines/bin copied from package.json)
- [npm Docs — `npm ls`](https://docs.npmjs.com/cli/v11/commands/npm-ls) (`--all`, `--json`, `--package-lock-only`, logical vs physical tree)
- [npm Docs — `npm cache`](https://docs.npmjs.com/cli/v11/commands/npm-cache) and [npm/cacache](https://github.com/npm/cacache) (`_cacache`, content-addressable, integrity, index metadata/ETags)
- [pacote](https://www.npmjs.com/package/pacote) (`packumentCache`)
- [pnpm Docs — `pnpm licenses`](https://pnpm.io/cli/licenses) and [pnpm discussion #5690](https://github.com/orgs/pnpm/discussions/5690) (why it exists: license-checker can't read pnpm's node_modules)
- [pnpm discussion #7034](https://github.com/orgs/pnpm/discussions/7034) (`@pnpm/lockfile.fs`, lockfile spec, `@pnpm/lockfile.types`)
- [`@pnpm/lockfile.fs`](https://www.npmjs.com/@pnpm/lockfile.fs) (rename from `@pnpm/lockfile-file`, `readWantedLockfile`)
- [Bun Docs — Lockfile](https://bun.com/docs/pm/lockfile) and [Bun blog — text lockfile](https://bun.com/blog/bun-lock-text-lockfile) (JSONC, top-level keys, the single documented example, `--save-text-lockfile` migration)
- [`@yarnpkg/lockfile`](https://www.npmjs.com/package/@yarnpkg/lockfile) and [yarnpkg/berry discussion #4491](https://github.com/yarnpkg/berry/discussions/4491) (`parseSyml`, `__metadata` version detection, v1 package frozen)
- [snyk/nodejs-lockfile-parser README](https://github.com/snyk/nodejs-lockfile-parser/blob/main/README.md) (exact format/version coverage; no Bun)
- [davglass/license-checker](https://github.com/davglass/license-checker) and [license-checker-rseidelsohn](https://github.com/RSeidelsohn/license-checker-rseidelsohn) (`read-installed` → `@npmcli/arborist`, SPDX + text-match fallback, `*` for guesses)
- [Socket CLI docs — `socket scan`](https://docs.socket.dev/docs/socket-scan) and [manifest file detection](https://docs.socket.dev/docs/manifest-file-detection-in-socket) (uploads manifests + lockfiles, server-side resolution, `socket manifest` for non-lockfile ecosystems)

Research literature:
- ["Small World with High Risks: A Study of Security Threats in the npm Ecosystem"](https://arxiv.org/pdf/1902.09217) (~80 transitive deps per average package by 2018)
- Dependency-amplification study across 500 projects / 10 ecosystems (npm mean 4.32x, Maven 24.70x) — surfaced via search; treat the exact figure as secondary until the paper is read directly.

Measured locally on 2026-08-02 (`F:\Github_Project\*`): direct/resolved counts for 9 repos; `node_modules` vs `.pnpm` entry counts for `Siz`; `grep -ci license pnpm-lock.yaml` = 0.

Code read: `F:\Github_Project\Siz\src\core\packument.ts` (concurrency 8, 4 s timeout, name-keyed memo, `/latest` URL).
