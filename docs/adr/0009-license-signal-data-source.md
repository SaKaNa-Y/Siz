# License signal: from the packument, shared with install size, and three-valued

## Status

accepted

## Context & Decision

The **license signal** shows a package's declared license before install — the legal family of result signal, alongside trust (health) and size (weight). Like size, the number is not available from the sources siz already had: the npm **search** endpoint returns no license, and the hosted **`fast-npm-meta`** aggregator (ADR 0003) exposes `deprecated` / `provenance` / `publishedAt` / `engines` / `integrity` but **no license field**. So the license cannot ride the batched `getLatestVersionBatch({ metadata: true })` call that backs every trust signal.

It comes instead from the npm **packument** (`registry.npmjs.org/<pkg>/latest` → `license`) — which siz was *already fetching* for install size (ADR 0008). Three decisions follow.

**1. One packument fetch, shared by two families.** Rather than give the license its own request, the packument fetch and its memo moved into `core/packument.ts`, which returns a narrow `PackageManifest` projection. `core/size.ts` derives `installSize` from it; `core/license.ts` derives the license. Enabling the license signal therefore added **zero** network requests. The projection is deliberate: real packuments carry full dependency maps, and these are memoized for the process lifetime.

**2. Report verbatim; classify nothing.** Siz shows `MIT` and `GPL-3.0-only` identically, with no permissive/copyleft/proprietary tiering and no color coding by permissiveness. Whether copyleft is a problem is a fact about the *consuming project*, not about the package — siz has no standing to rule on it, and a red glyph on AGPL would be a legal opinion it cannot support. The single flag it does raise is the **unclear license** (`⚖`): the license cannot be resolved from registry metadata at all — none declared, `UNLICENSED`, or `SEE LICENSE IN <file>`. That is a mechanical property of the metadata, not a view on the terms, and it maps to a concrete user action (go read something).

**3. Unknown is not undeclared.** The signal is three-valued, and the third value is the whole point:

| State | Representation | Renders |
| --- | --- | --- |
| Declared | `{ license: 'MIT' }` | `MIT` |
| Resolved, none declared | `{ license: null }` | `⚖ no license` |
| Never resolved | **no map entry** | nothing at all |

A name appears in `fetchLicenses()`'s map **iff its packument resolved**. In `--json` this surfaces as a string, an explicit `null`, or an omitted key respectively — so a CI consumer can tell "this package declares no license" from "siz could not check".

## Considered options (and why the chosen path)

- **Add the license to `TrustSignals`.** Rejected on two counts. Mechanically it can't work — `fast-npm-meta` has no license field, so there is nothing to add it to. Conceptually `CONTEXT.md` already scopes *trust signal* to health facts and warns against using it as an umbrella; a license is legal, not a measure of maintenance.
- **A second, independent packument fetch in `core/license.ts`.** Structurally tidier (each family fully self-contained, zero churn in `size.ts`) but it would have doubled packument traffic — two identical GETs of the same URL per package, per search. The shared layer keeps the families separate at the *module* boundary while sharing the *request*.
- **Widen `fetchInstallSizes` to return both facts.** The cheapest diff, and one request — but it would leave the size module owning a legal fact, blurring the family boundary the glossary draws. Extracting a neutral layer beneath both costs a little more and keeps each family honest.
- **Classify by permissiveness** (permissive / copyleft / proprietary, glyph-colored per tier). Rejected: siz would ship a legal opinion it can't stand behind, and the classification is only meaningful relative to a project's own policy. The taxonomy properly belongs to the planned *license policy rules*, where the **user** supplies the allow/deny lists — exactly as the existing dependency-rules engine does for names.
- **Treat `UNLICENSED` and `SEE LICENSE IN …` as ordinary licenses** (no glyph, since something *was* declared). Rejected: literal, but the user's next action for those is identical to the no-license case, so the distinction buys nothing at the point of decision.
- **Ignore the deprecated license shapes** (`{ type }`, bare arrays, the top-level `licenses` key). Rejected: the packages using them are old, hence also the ones already flagged `⚑ stale`, and reporting a plainly-MIT 2013 package as unlicensed is the worst possible failure for a signal whose job is legal accuracy. Verification against the live registry found `pause-stream` shipping `license: ["MIT", "Apache2"]` — a shape not in npm's documentation at all.
- **Collapse unknown into undeclared** (omit the key in both cases, as `installSize` does). Rejected — see the consequence below. `size.ts` may conflate them only because no glyph rides on its absence.

## Consequences

- `core/packument.ts` is now a shared foundation: any future signal readable from a version manifest (e.g. the planned *ships-types* signal, via `types`/`typings`) can join it for free. `core/size.ts` no longer owns a fetch; `fetchBundleSize` (Bundlephobia) is unchanged and still local, being a different endpoint.
- **The tri-state is a correctness invariant, not a nicety.** If a timeout were rendered as "no license", one slow registry response would print `⚖ no license` down the entire result list — siz accusing every package of granting nothing when it simply never asked. `test/license.test.ts` asserts `map.has(name) === false` for an unresolved package specifically to pin this.
- `--json` gains a `license` key that is three-valued (`string` | `null` | absent). This is a **public contract**: consumers distinguishing the cases depend on `null` and absence meaning different things.
- The `⚖` glyph's meaning is deliberately narrow, so it must not drift. Adding a "restrictive license" warning later would silently convert a factual signal into an editorial one; that belongs behind explicit user policy instead.
- `trustLegend()` was renamed `signalLegend()`, since it renders glyphs for all three families and naming it after one invited exactly the umbrella drift `CONTEXT.md` warns about.
- The SPDX id `Unlicense` (public-domain dedication) must never be matched as `UNLICENSED` (no rights granted) — they are near-opposites, and real packages use the former. The comparison is exact-match on the whole trimmed value, never a prefix or substring test.
- Documented user-facing in the README's **Data sources & network** table, noting that the license adds no request beyond install size's.
