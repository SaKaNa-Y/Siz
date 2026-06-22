# Siz

`siz` is a CLI for discovering, favoriting, and installing npm packages. This glossary fixes the language used across its three tracks — Discover, Organize, Manage.

## Language

### Discover

**Trust signal**:
A health/maintenance fact about a package, surfaced inline on a search result so the user can judge it before installing. The v1 set is deprecation status, publish age, and provenance — all read from a single batch metadata call.
_Avoid_: health badge, quality indicator (those overlap with npm's existing `score.*` bars)

**Trust-aware discovery**:
The Discover-track capability of attaching [[#trust-signal|trust signals]] to search results. It is purely informational — it never blocks or filters; it only informs the choice to install.

**Provenance**:
Verifiable evidence (npm's signed attestation) that a published package was built from the source it claims. Distinct from `trustedPublisher`, which is npm's separate flag for publisher identity. Treated together as the v1 "provenance" trust signal. **Positive-only**: a green `✓` shows when either is present; absence renders nothing (adoption is still low, so flagging its absence would be noise).

**Score** (existing):
npm's own relevance/quality/popularity/maintenance numbers (0..1) returned by the search endpoint and rendered as bars. A trust signal is NOT a score — scores come from search; trust signals come from the metadata call.

**Stale**:
A package whose latest version was published more than **2 years** ago. Renders the `⚑` glyph. Fresher packages show no age glyph (the exact "published Xago" text still appears in the focused row's detail). Stale is a prompt to look closer, never a block.

**Deprecated**:
A package whose registry metadata carries a non-empty `deprecated` message. Always renders the `⚠` glyph; the message shows in the focused row's detail.

**Momentum** (download trend):
The direction of a package's recent download volume — **rising** (`↑`, green) or **falling** (`↓`, red) — derived from npm's download API, a separate source from the metadata behind the other [[#trust-signal|trust signals]]. It is a [[#trust-signal|trust signal]], not a [[#score|score]]: `score.popularity` is npm's static popularity number, momentum is *change over time*. **Approximate by design** (a two-call proxy, see ADR 0002) and **two-sided** (unlike positive-only [[#provenance|provenance]], both directions show). Suppressed below a download-volume floor (too noisy) and **unavailable for scoped packages** (`@scope/pkg`), which the bulk download endpoint rejects — those simply show no momentum glyph. Flat/unknown renders nothing.
_Avoid_: "popularity" (that is the existing [[#score|score]]), "downloads" (we show direction, not a count).

### Manage

**Dependency rule**:
A project's committed policy about which packages may enter it, declared in [[#siz-config-json|`siz.config.json`]] as `allow` / `deny` glob lists over package **names** (not versions). A rule says nothing about *how* a package is installed — only *whether* it may be. Reused by both the [[#guardrail|guardrail]] and the future [[#audit|audit]].
_Avoid_: "lockfile", "constraint" (versions are out of scope), "permission" (these are project-level, not user-level).

**Guardrail**:
The Manage-track enforcement of [[#dependency-rule|dependency rules]] at the moment a package would **enter the project** — i.e. the install paths only (the interactive Install action and `bundle install`). It blocks denied packages before install; it does not touch favorites, bundle records, or upgrades. Distinct from the [[#audit|audit]], which inspects packages already present.
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

**`siz.config.json`**:
The project-local, committable file (nearest one, walking up from the working directory) that holds a project's [[#dependency-rule|dependency rules]]. A single root file governs the whole repository, including every workspace. Distinct from the user-global data store in the config dir, which holds favorites and bundles. Absent file ⇒ no rules; malformed file ⇒ siz fails closed (aborts) rather than permitting everything.
