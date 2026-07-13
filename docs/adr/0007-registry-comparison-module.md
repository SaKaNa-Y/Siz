# A shared Registry-comparison module, separate from the discovery-only Dependency scan

## Status

accepted

## Context & Decision

`siz upgrade` and `siz outdated` are meant to "agree by construction" on a project's dependencies. The
[Dependency scan](../../CONTEXT.md) already unifies *discovery* (`resolve.discoverProjectDeps` — manifests
+ nearest pnpm catalog + the deduped set of names to query), and the glossary deliberately scopes that
term to **discovery only** ("it fetches nothing itself"; *avoid* "fetch"/"resolve versions"). But one layer
down, the logic that compares each declared range against the registry was **duplicated**:
`upgrade.analyzeDep()` and `outdated.analyzeOutdated()` re-implemented the same front guards (non-registry
protocol → missing package → range-floor `current` → candidate filtering → `latestDiff`) before diverging
on their real questions. The batched fetch (`fetchVersionInfo`) and the semver-range helpers also lived in
`upgrade.ts`, so `outdated.ts` and `resolve.ts` had to import *from `upgrade`* for neutral machinery.

We introduced a new **Registry comparison** module (`src/core/compare.ts`) that owns the batched fetch, the
semver-range helpers (`currentVersionFromRange`, `detectRangePrefix`, `applyPrefix`, `safeDiff`,
`stableCandidates`), the `VersionInfo` type, and a neutral `compareDep(dep, info)` returning either a skip
(`protocol` | `not-found` | `unparseable`) or the facts both commands share (`DepComparison`: range-floor
`current`, `latest`, `latestDiff`, range `prefix`, `currentIsPre`, `candidates`). `upgrade` and `outdated`
became **thin specializers** over those facts — `upgrade` resolves a target under a mode ceiling and
attaches a `proposed` range; `outdated` computes `wanted` from the literal range. The scan's name
collectors (`collectQueryNames`, `collectCatalogNames`) moved to `resolve.ts`, where they belong as part of
the scan's "deduped set of names."

**The hinge:** a `complex` range (e.g. `>=2 <3`, `1.x`) is returned by `compareDep` as a **fact**
(`prefix: 'complex'`), *not* a skip. That single decision is what lets rewrite-safe `upgrade` turn complex
into its own skip while read-only `outdated` happily reports it — without either command re-implementing the
shared guards.

## Considered options (and why the chosen path)

- **New module vs. broadening the Dependency scan.** Folding fetch + analysis into the scan would collapse
  everything into one concept, but it directly contradicts the scan's documented, deliberate "discovery
  only" wording and its avoid-list. We kept the scan pure and named the new middle step **Registry
  comparison**, giving a clean three-layer story: scan (what to query) → comparison (neutral facts) →
  per-command analysis (the specific question).
- **Neutral facts + command-side specializers vs. one parameterized analyzer.** A single analyzer taking a
  mode/strategy argument and returning a union covering both commands would centralize everything, but the
  two questions genuinely differ (target-under-ceiling vs. wanted-from-literal-range; skip-complex vs.
  report-complex), so the union would leak both commands' concerns into one signature. Returning neutral
  facts and letting each command ask its own question keeps the shared core deep and the specializers thin.
- **Moving `fetchVersionInfo` out of `upgrade.ts` vs. leaving it.** Leaving it kept `outdated`/`check`
  importing the neutral fetch *from `upgrade`* — a directional dependency that would repeat when the planned
  `siz check` audit lands. Moving it (and the semver helpers) into `compare.ts` removed the smell entirely.

## Consequences

- `outdated.ts` (and the future `siz check` audit) **no longer depend on `upgrade.ts`**; all three
  specialize the same `compareDep`. The audit drops in as a third specializer with no new discovery,
  fetch, or comparison code.
- The refactor is **behavior-preserving**: existing `upgrade`/`outdated` tests pass unchanged and now
  exercise `compareDep` transitively; a new `test/compare.test.ts` pins the comparison seam directly.
- We deliberately did **not** merge the `planManifests`/`planManifestsOutdated` (and catalog) pairing
  wrappers: they bucket results differently and each command's flatten step is UI-shaped, so a generic
  planner there would be a shallow abstraction. Recorded so a future review doesn't re-suggest it.
- `core/compare.ts` is now the canonical home for `VersionInfo` and the semver-range helpers; the public
  library surface (`src/index.ts`) re-sources them from there, so the exported names are unchanged.
