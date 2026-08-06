# Siz

`siz` is a CLI for discovering, saving, and installing npm packages. This glossary fixes the language used across its three tracks — Discover, Organize, Manage.

## Language

### Discover

**Name affinity**:
How closely a package's *name* matches the query terms — how many terms it covers first, then how well each matched (exact, prefix, substring, fuzzy subsequence). It is a **ranking** input only: it reorders the registry's results (with the registry's own relevance as the tiebreaker) and never removes one, which is why every query returns what the registry found. There is exactly one search — names and descriptions are both matched by the registry — so there is no search *mode* and no name-only view.
_Avoid_: "name filter", "name search", "name mode" (all describe the removed behavior, where a multi-word query could subtract its way to zero results).

**Result signal**:
The umbrella term for any fact siz attaches inline to a search result to help the user judge it *before* installing — the parent of [[#trust-signal|trust signals]] (health), [[#size-signal|size signals]] (weight), and [[#license-signal|license signals]] (legal). All result signals share the same contract: purely informational (never block, filter, or reorder), fetched outside the search endpoint, and degrade silently when unavailable. What distinguishes the families is the *kind* of fact, not the mechanism.

**Trust signal**:
A **health/maintenance** fact about a package (one family of [[#result-signal|result signal]]), surfaced inline on a search result so the user can judge it before installing. The set is deprecation status, publish age, provenance, [[#download-count-weekly|weekly download count]], and [[#momentum|momentum]]. Distinct from a [[#size-signal|size signal]], which is about *weight*, not health.
_Avoid_: health badge, quality indicator (both read as a graded verdict siz does not form)

**Trust-aware discovery**:
The Discover-track capability of attaching [[#trust-signal|trust signals]] to search results. It is purely informational — it never blocks or filters; it only informs the choice to install.

**Provenance**:
Verifiable evidence (npm's signed attestation) that a published package was built from the source it claims — read as the presence of `dist.attestations` on the packument. Distinct from `trustedPublisher`, npm's separate flag for publisher identity, which the signal **no longer covers**: since deprecation and provenance moved onto the packument, `✓` means *attested*, one fact from one source, rather than either-of-two from a hosted aggregator. **Positive-only**: a green `✓` shows when an attestation is present; absence renders nothing (adoption is still low, so flagging its absence would be noise).

**Score** (retired):
npm's quality/popularity/maintenance numbers, once returned by the search endpoint and rendered as bars. The registry retired them — it now returns a constant `1.000` for all three on every package — so siz no longer parses, renders, or emits them; the [[#download-count-weekly|weekly download count]] took their place on the row. What remains is the endpoint's **relevance number** (`searchScore`), and it is strictly internal: the last tiebreaker in [[#name-affinity|name-affinity]] ranking, never shown and never in `--json`.
_Avoid_: talking about "the score bars" as a current feature, or "popularity" as something siz displays.

**Stale**:
A package whose latest version was published more than **2 years** ago. Renders the `⚑` glyph. Fresher packages show no age glyph (the exact "published Xago" text still appears in the focused row's detail). Stale is a prompt to look closer, never a block.

**Deprecated**:
A package whose latest-version manifest carries a non-empty `deprecated` message (read from the packument siz already fetches per result). Always renders the `⚠` glyph; the message shows in the focused row's detail.

**Replacement suggestion**:
The successor package name(s) a [[#deprecated|deprecated]] package's own message points users to (`→ replaced by X`), extracted (high-confidence only) from that message. It is a fact *about the message* — what the maintainer named — never an opinion siz forms; a deprecated package whose message names no successor shows none. Informational, like every [[#trust-signal|trust signal]]: it never blocks, filters, or acts. **Distinct** from the planned *lighter-alternative suggestion* (a curated, editorial map of leaner swaps for heavy packages) — that is siz's recommendation, this is the maintainer's. See ADR 0005.
_Avoid_: "alternative", "recommendation" (those are the editorial, curated feature, not this).

**Download count** (weekly):
A package's **last-week download total** from npm's download API — the adoption fact that took over the row space npm's retired [[#score|score]] bars occupied. Shown on **every** result row (interactive, `--list`, and the `--json` `downloads` field), humanized by magnitude (`812`, `1.5k`, `340k`, `12.3M`). A [[#trust-signal|trust signal]] like [[#momentum|momentum]], and from the same source: unscoped names get the count out of the bulk response momentum already needs, scoped names get it from the single-package endpoint. **A count siz never learned renders nothing, not a zero** — the same unknown-vs-finding distinction the [[#unknown-license|unknown license]] draws.
_Avoid_: "popularity" (that is the retired [[#score|score]]), "download count" alone (say *weekly* — the period is part of the fact).

**Momentum** (download trend):
The direction of a package's recent download volume — **rising** (`↑`, green) or **falling** (`↓`, red) — derived from npm's download API, a separate source from the metadata behind the other [[#trust-signal|trust signals]]. It is a [[#trust-signal|trust signal]] about *change over time*, and distinct from the [[#download-count-weekly|weekly download count]] it is computed alongside: one is a level, the other a direction. **Approximate by design** (a two-call proxy, see ADR 0002) and **two-sided** (unlike positive-only [[#provenance|provenance]], both directions show). Suppressed below a download-volume floor (too noisy) and **unavailable for scoped packages** (`@scope/pkg`), for which only the single-period count is fetched — those show a count but never an arrow. Flat/unknown renders nothing.
_Avoid_: "popularity" (that is the retired [[#score|score]]), "downloads" (that is the [[#download-count-weekly|count]]; momentum is direction).

**Size signal**:
A **weight/cost** fact about a package (one family of [[#result-signal|result signal]]), surfaced inline so the user can weigh how heavy a package is before installing. Two members: [[#install-size|install size]] and [[#bundle-size|bundle size]]. A size signal is about how much a package *costs to add*, never about its health (that is a [[#trust-signal|trust signal]]). Like every result signal it is informational — it never blocks, filters, or reranks. See ADR 0008.
_Avoid_: "trust signal" (that is health), "weight" alone (ambiguous — say install vs bundle).

**Install size**:
A package's **own unpacked-on-disk size** — the `dist.unpackedSize` of its latest version, read per-package from the npm packument (`registry.npmjs.org/<pkg>`). It is *this package only*, excluding its dependencies, and it is what lands in `node_modules` for the package itself. Shown inline on every result (interactive rows, `--list`, and the `--json` `installSize` field). A package past an editorial **heavy** byte threshold also renders a `heavy` glyph — the same "heavy" notion the planned *lighter-alternative suggestion* feature reuses.
_Avoid_: "bundle size" (that is the browser-ship figure including deps), "download size" (that is the compressed tarball, a different number).

**Bundle size**:
A package's **minified + gzipped browser-ship weight, including its transitive dependencies** — the figure reported by [Bundlephobia](https://bundlephobia.com). Distinct from [[#install-size|install size]] on two axes: it counts dependencies, and it measures the *shipped* (min+gzip) bytes, not the on-disk unpacked bytes. Because it is slow to compute and rate-limited upstream, it is fetched **lazily, only for the focused row** in interactive search, and is **never** part of `--list`/`--json` output (which stays fast and CI-safe). See ADR 0008.
_Avoid_: "install size" (that excludes deps and measures on-disk unpacked bytes).

**License signal**:
A **legal** fact about a package (one family of [[#result-signal|result signal]]): the license it declares, surfaced inline so the user can judge compatibility before installing. It is about *permission to use*, never about health (a [[#trust-signal|trust signal]]) or cost (a [[#size-signal|size signal]]). Siz reports the declared value **verbatim and passes no judgement on the terms** — whether copyleft is a problem is a fact about the *consuming project*, not about the package, so that judgement belongs to the user (and to the planned *license policy rule*). The one thing siz does flag is an [[#unclear-license|unclear license]]. Like every result signal it is informational: never blocks, filters, or reranks. See ADR 0009.
_Avoid_: "trust signal" (that is health), "license check"/"compliance" (siz reports, it does not audit or approve), "license type" (the value may be an expression, not a single type).

**Unclear license**:
A declared-license value that **cannot be resolved from registry metadata alone** — none declared, `UNLICENSED`, or deferred to a file via `SEE LICENSE IN …`. Renders the `⚖` glyph. These differ legally but are identical in what they ask of the user: go read something outside the registry. It is **not** a judgement about the terms — `GPL-3.0-only` is perfectly clear, and the SPDX id `Unlicense` (a public-domain dedication) is clear too, despite resembling `UNLICENSED`.
_Avoid_: "undeclared license" (`UNLICENSED` and `SEE LICENSE IN …` *are* declarations), "missing license" (covers only one of the cases), "bad"/"restrictive license" (that would be the editorial judgement siz declines to make).

**Unknown license** (absence of data):
The state where siz **never learned** a package's license — the packument request failed, timed out, or has not returned yet. Strictly distinct from an [[#unclear-license|unclear license]], which is a *finding*. Unknown is the absence of a finding and renders **nothing at all**: no text, no glyph. Conflating the two would let one slow network call flag every result on screen as having no license. See ADR 0009.
_Avoid_: "no license" (that is a finding, not missing data).

### Manage

**Dependency rule**:
A project's committed policy about which packages may enter it, declared in [[#siz-config-json|`siz.config.json`]] as `allow` / `deny` glob lists over package **names** (not versions). A rule says nothing about *how* a package is installed — only *whether* it may be. Reused by both the [[#guardrail|guardrail]] and the future [[#audit|audit]].
_Avoid_: "lockfile", "constraint" (versions are out of scope), "permission" (these are project-level, not user-level).

**Guardrail**:
The Manage-track enforcement of [[#dependency-rule|dependency rules]] at the moment a package would **enter the project** — i.e. the install paths only (the interactive Install action, the direct `siz add` install, and `bundle install`). It blocks denied packages before install; it does not touch bundle records, upgrades, or uninstalls (`siz rm` — removing a package never adds one). Distinct from the [[#audit|audit]], which inspects packages already present.
_Avoid_: "lint", "check" (that is the audit); "filter" (it blocks, it does not reorder or hide search results).

**Allow / deny** (rule semantics):
The two glob lists of a [[#dependency-rule|dependency rule]]. **Deny always wins**: a package is permitted when `(allow is empty OR the name matches some allow pattern) AND the name matches no deny pattern`. Empty `allow` means denylist mode (everything permitted except `deny`); non-empty `allow` means allowlist mode.

**Audit** (`siz check`, planned):
The Manage-track capability of **reporting** [[#dependency-rule|dependency-rule]] violations across a project's *existing* dependencies, regardless of how they got there — the counterpart to the install-time [[#guardrail|guardrail]]. Shares the same rule-evaluation core. Not yet built.

**Outdated report** (`siz outdated`):
The Manage-track, **read-only and non-interactive** report of dependencies whose registry `latest` is ahead of their [[#current-range-floor|current]] version. A sibling of the [[#audit|audit]] (both *report*, never mutate): it never writes a `package.json` or installs anything — it is the inspect-only counterpart to the interactive `siz upgrade`, reusing the same version-fetch and discovery core. Each entry is shown as **Current / Wanted / Latest** (Latest = the registry's `latest` dist-tag; Wanted = the highest version still satisfying the declared range).
_Avoid_: "upgrade" (that writes), "check" (that is the [[#audit|audit]]).

**Current** (range floor):
A dependency's "current" version in siz is the **lowest version satisfying its `package.json` range** (e.g. `^18.2.0` → `18.2.0`), derived from the declared range — **not** the installed version in `node_modules`/a lockfile (which is what `npm outdated` reports). Shared by `siz upgrade` and the [[#outdated-report|outdated report]], so both agree; it also lets the report run on a fresh checkout before install. See ADR 0004.
_Avoid_: "installed version", "resolved version" (those imply reading `node_modules`/the lockfile).

**Dependency scan**:
The Manage-track **discovery step** shared by `siz upgrade`, the [[#outdated-report|outdated report]], and the planned [[#audit|audit]]: a project's manifests (the nearest `package.json`, or the workspace members when recursive) plus the nearest pnpm catalog, and the **deduped set of upgradable names** to query the registry for. **Discovery only** — it fetches nothing itself; the single batched registry request happens after. Keeps the three commands agreeing on *what a project's dependencies are* by construction.
_Avoid_: "fetch", "resolve versions" (the scan names *what* to query; the batched metadata call does the fetching).

**Registry comparison**:
The neutral, per-dependency comparison of a declared range against the registry's published versions — the middle step shared by `siz upgrade` and the [[#outdated-report|outdated report]] (and the planned [[#audit|audit]]). It runs *after* the [[#dependency-scan|dependency scan]]'s single batched fetch and computes only the facts both commands share: the range-floor [[#current-range-floor|current]], the `latest` dist-tag, the bump levels, the range's leading operator, and the candidate versions. Each command then **specializes** these facts into its own question — `upgrade` resolves a target under a mode ceiling (and skips ranges too complex to rewrite in place), `outdated` takes the highest version satisfying the literal range (and *reports* complex ranges, since it never rewrites). A range being **complex** is a *fact* the comparison returns, not a skip — that is what lets read-only `outdated` and rewrite-safe `upgrade` diverge without duplicating the shared guards. Lives in `core/compare.ts`. See ADR 0007.
_Avoid_: "scan" (that is [[#dependency-scan|discovery]]-only — it names *what* to query; comparison consumes the fetched data), "resolve" (that is `upgrade`'s target resolution, one specialization of this).

**`siz.config.json`**:
The project-local, committable file (nearest one, walking up from the working directory) that holds a project's [[#dependency-rule|dependency rules]]. A single root file governs the whole repository, including every workspace. Distinct from the user-global data store in the config dir, which holds bundles. Absent file ⇒ no rules; malformed file ⇒ siz fails closed (aborts) rather than permitting everything.
