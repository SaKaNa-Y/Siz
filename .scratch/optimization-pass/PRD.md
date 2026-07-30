# PRD — Optimization pass: one Organize concept, one search, real signals

Status: ready-for-agent

## Problem Statement

Siz has accumulated features that overlap, guess, or quietly do nothing — and one of its advertised entry points returns no results at all.

As a user:

- I have **two ways to save a package** (favorites and bundles) and can't tell which I should be using. Bundles record more (dependency type, version strategy) yet favorites are what the empty search box shows me. My favorites also display a version number that was captured whenever I favorited them and never updates, so `siz list` shows versions that are quietly wrong.
- Once a package is in a bundle, **I can never take it out** — `siz bundle rm` deletes the whole bundle. My only per-package removal is `siz rm <pkg> --fav`, which works on the *other* store.
- Every search result is labelled with a **category siz guessed**: `zod` is shown as `[DevTools]`, `zod-to-json-schema` as `[Backend]`. The label sits ahead of the package name, in the same visual position as facts like `MIT` and `4.6 MB install`, so I read it as if it were true.
- Every result shows me **`quality ▰▰▰▰▰  popularity ▰▰▰▰▰`**. Every result. Always. npm retired the scores that fed those bars and now returns `1.000` for all three fields on every package, so the two most prominent elements on a row carry no information — while the actual weekly download count is already being fetched and thrown away.
- **`siz react form validation` returns nothing.** So does `siz "state management"`. That first query is the first example in `siz -h`. The default command narrows the registry's full-text results down to packages whose *name* fuzzy-matches the whole phrase, so any multi-word query is subtracted to zero, and I have to know to type `siz search` instead.
- Scoped packages — `@types/node`, `@babel/core`, `@tanstack/react-query` — show **no download data at all**, because the bulk endpoint siz uses rejects scoped names.
- `siz upgrade major` and `siz upgrade latest` do exactly the same thing, and `siz --json` with an empty query drops me into an **interactive TUI** instead of failing, which breaks a CI script whose variable came out empty.

Underneath, siz fetches the `/latest` packument for every result row — a request that already contains `deprecated` and `dist.attestations` — and then buys those same two facts a second time from a third-party service.

## Solution

One concept per job, one search that always works, and rows that only show facts.

- **Bundles become the only place packages are saved.** Favorites are removed; existing favorites migrate into a bundle rather than being discarded. The empty search box still opens one flat list — now every saved entry across all bundles, each tagged with its bundle — so the front door stays exactly one level deep. `siz list` prints that same list for scripting, and `siz bundle rm <bundle> [...packages]` finally removes individual entries.
- **Guessed categories are gone**, along with the `category:` qualifier and `--category` filter. Bundles are categorization the user chose, which makes a heuristic taxonomy redundant, and a guessed label contradicts siz's own rule that result signals are facts fetched from a source, never opinions siz forms.
- **One search.** Name affinity re-ranks the registry's full-text results instead of filtering them, so `siz react form validation` returns useful results ranked with the closest name matches first, and `siz pino` still puts `pino` at row one. `siz search` becomes a hidden alias.
- **Weekly download counts replace the dead score bars** — a real popularity fact, from an official npm endpoint, already on the wire for momentum. Scoped packages get a count via npm's single-package endpoint.
- **Deprecation and provenance come from the packument siz already fetches.** The third-party metadata service is demoted to the one fact only it provides cheaply: publish age. Eager signal fetches are bounded to the rows actually on screen.
- Small sharp edges filed off: one `upgrade` level name for "newest overall", consistent version-strategy choices, and `--json`/`--list` without a query failing loudly instead of opening a TUI.

## User Stories

**Saving packages (Organize)**

1. As a siz user, I want one concept for "packages I've saved", so that I never have to decide between favorites and bundles.
2. As an existing siz user, I want my favorites preserved when the concept is removed, so that upgrading siz never loses data I curated.
3. As an existing siz user, I want my migrated favorites to land in a clearly named bundle, so that I can find them immediately after upgrading.
4. As a siz user, I want the empty search box to open every package I've saved across all bundles, so that my saved packages remain the fastest path in the tool.
5. As a siz user, I want each entry in that list tagged with the bundle it came from, so that a flat list doesn't lose the grouping I chose.
6. As a siz user, I want to select several entries from that flat list and act on them together, so that the front door behaves like search results do.
7. As a scripting user, I want `siz list` to print the same flat saved-entry list, so that the interactive front door has a scriptable equivalent.
8. As a scripting user, I want to narrow `siz list` to one bundle, so that I can inspect a single stack without reading the whole store.
9. As a siz user, I want to remove one package from a bundle, so that a typo or an abandoned dependency doesn't force me to delete and rebuild the bundle.
10. As a siz user, I want `siz bundle rm <bundle>` with no package arguments to keep deleting the whole bundle, so that existing muscle memory keeps working.
11. As a siz user, I want removing a saved entry to be independent of uninstalling, so that curating my saved list never touches my project.
12. As a siz user, I want `siz add` to have only two modes — install and record-into-a-bundle — so that the command is predictable.
13. As a siz user, I want `siz rm <pkg>` to mean exactly "uninstall from this project", so that removal has no hidden mode flag.
14. As a siz user, I want a clear error if I use a removed flag such as `--fav`, so that I learn what replaced it instead of getting silent or confusing behavior.

**Search (Discover)**

15. As a siz user, I want a multi-word query like `react form validation` to return relevant packages, so that the tool's own advertised example works.
16. As a siz user, I want a descriptive query like `state management` to return results, so that I don't have to know which of two commands to reach for.
17. As a siz user, I want typing a package name to put that package at the top of the list, so that name-fragment searching still feels precise.
18. As a siz user, I want one search command, so that I never have to choose between name search and full-text search.
19. As a siz user, I want package descriptions shown in results, so that I can tell similarly-named packages apart.
20. As an existing siz user, I want `siz search` to keep working for a release, so that a documented command doesn't break under me without warning.
21. As a scripting user, I want `--json` or `--list` without a query to fail with a clear message and a non-zero exit, so that an empty variable in CI never opens an interactive prompt.

**Result signals (Discover)**

22. As a siz user, I want no category label on results, so that nothing on a row is a guess presented as a fact.
23. As a siz user, I want the always-full score bars removed, so that row space is spent on information that varies between packages.
24. As a siz user, I want each result's weekly download count shown inline, so that I can compare adoption at a glance.
25. As a siz user, I want download counts on scoped packages too, so that `@types/node` and `@babel/core` aren't blank in the column I'm scanning.
26. As a siz user, I want the rising/falling momentum arrow kept where it's available, so that I can still see direction and not just volume.
27. As a siz user, I want to be told plainly that momentum is unavailable for scoped packages, so that a missing arrow doesn't read as "flat".
28. As a siz user, I want deprecation, install size, and license to keep working exactly as they do today, so that this pass costs me no signal I already rely on.
29. As a siz user, I want the deprecation replacement suggestion (`→ replaced by …`) preserved, so that a deprecated package still points me at its successor.
30. As a siz user, I want signals to keep loading progressively and degrade silently, so that the result list never waits on the network.
31. As a siz user, I want siz to make fewer network requests per search, so that searching feels fast and doesn't hammer the registry.
32. As a siz user, I want fewer of siz's facts to depend on a third-party service, so that more of the tool keeps working when that service is down.
33. As a siz user, I want the publish-age and stale (`⚑`) signal kept, so that I can still spot an abandoned package.
34. As a scripting user, I want `--json` to expose the weekly download count, so that I can gate on adoption in a script.
35. As a scripting user, I want the dead `score` fields gone from `--json`, so that I don't build logic on a field that is always `1`.
36. As a scripting user, I want the `--json` contract change called out in the changelog, so that I can adjust before upgrading.
37. As a siz user, I want `--list` and `--json` to still cover every result they print, so that bounding fetches to visible rows doesn't silently shrink scripted output.

**Upgrade and maintain (Manage)**

38. As a siz user, I want one name for the "newest overall" upgrade level, so that I'm not guessing whether `major` and `latest` differ.
39. As a siz user, I want `siz upgrade` with no level to keep meaning "newest overall", so that the default is unchanged.
40. As a siz user, I want the interactive bundle version-policy prompt to offer the same strategies as the `--strategy` flag, so that the interactive path isn't quietly less capable.
41. As a siz user, I want a notice when an explicit `@version` overrides my `--strategy`, so that a pinned entry is never a surprise.
42. As a siz user, I want `--no-rules` described accurately in help, so that it doesn't read as though rule-bypassing is the default.
43. As a siz user, I want `siz help` and `siz version` to keep working, so that the conventional subcommand forms still exist alongside the flags.

**Documentation and trust in the docs**

44. As a siz user, I want the README's Features section to describe what actually ships, so that I can trust the checkmarks.
45. As a siz user, I want the README to stop documenting favorites, categories, and score bars, so that I'm not looking for features that no longer exist.
46. As a contributor, I want the `siz -h` block in the project instructions to match the code, so that the public surface has one source of truth.
47. As a contributor, I want the glossary corrected where it is factually wrong (notably the score entry), so that the shared vocabulary describes reality.
48. As a contributor, I want the Organize track to finally have glossary entries, so that its concepts can't drift into overlap again.
49. As a contributor, I want the reasoning behind each removal recorded as an ADR, so that nobody re-adds score bars or favorites without knowing why they went.

## Implementation Decisions

### Store and the Organize track

- The data store drops the favorites map entirely. Schema goes to **v4** with a non-destructive migration that moves every existing favorite into a bundle (recorded as regular dependencies, tracking latest rather than pinned, since the stored favorite version was a stale snapshot and is not carried over). Category values on favorites are dropped. Migration follows the existing guarded-step chain and never removes a package.
- Favorite mutators (`addFavorite`, `removeFavorite`, `listFavorites`, `setCategory`) are removed from the store and from the library surface. The already-exported-but-unused `removeFromBundle` gets wired to a command.
- The store gains a **flat saved-entry query** returning every bundle entry across all bundles, each carrying its bundle name, with a stable order and an optional single-bundle filter. This one function backs the interactive front door and `siz list`, so both views are the same data by construction.
- `siz bundle rm <bundle>` takes optional trailing package names: with names it removes those entries; with none it deletes the bundle (existing confirm behavior retained). Removing the last entry leaves an empty bundle rather than deleting it implicitly.
- `siz list` renders the flat saved-entry list with a `-b/--bundle <name>` filter. `-c/--category` is removed.
- `siz add` becomes a two-mode multiplexer: default install, `--bundle <name>` record. `--fav` is removed; `siz rm` loses `--fav` and is uninstall-only, which completes the direction ADR 0006 set. Both removed flags produce an explanatory error naming the replacement, rather than being silently ignored by the arg parser.
- The interactive action menu keeps **Install** and **Add to bundle**; the **Favorite** action is removed.
- The empty-box path opens the flat saved-entry list; entries flow into the same action set as search selections.

### Categories

- The categories module is deleted outright, along with the category label on result rows and cards, the client-side category filter in the registry module, the `category:`/`cat:` query qualifier, and the category-carrying fields on stored packages. The qualifier is removed from the query grammar rather than accepted-and-ignored.

### Search

- One search path. The registry module's name filter becomes a **name-affinity re-ranker**: it reorders the registry's results so closer name matches sort first, using the registry's own relevance number as tiebreaker, and **never removes a result**. The `size` parameter continues to bound how many results are fetched.
- `SearchMode` and the mode branch disappear from the registry module, the interactive command, and the print command. Descriptions are always available for display.
- `siz search` remains registered as a hidden alias of the default command for one minor release; the README stops documenting it as a separate command.
- The non-interactive guard is fixed: `--json` or `--list` without a query exits non-zero with a message. It must never fall through to the interactive box.

### Result signals

- The packument projection widens to include `deprecated` and `dist.attestations` alongside `license` and `dist.unpackedSize`. It remains a narrow projection with a process-scoped memo, and the "name present in the map iff the packument resolved" contract is preserved — that contract is what keeps *unknown* distinct from *found nothing*, per ADR 0009.
- **Deprecation** (including the message that feeds replacement-suggestion parsing per ADR 0005) and **provenance** are derived from the packument. The third-party metadata batch is kept **only** for publish age. `✓` therefore means "has a provenance attestation" and no longer covers npm's separate trusted-publisher flag; this narrowing is deliberate and recorded in the new ADR.
- **Weekly download count** becomes a first-class trust-family signal, rendered inline on every row and included in `--json`. It comes from the download data already fetched for momentum, so it adds no request for unscoped packages. Momentum remains derived from the week/month comparison and remains an approximation per ADR 0002.
- **Scoped packages** get a download count via npm's single-package download endpoint, last-week only, with bounded concurrency and the same silent-degrade rules. Momentum stays unavailable for scoped packages (it needs both periods) and that gap is documented rather than papered over.
- npm's `score.quality`, `score.popularity`, and `score.maintenance` are removed from the search result type, from rendering, and from `--json`. The registry's relevance number is retained internally as the re-ranker tiebreaker only, and is documented as an opaque relevance score rather than a 0..1 fraction.
- **Eager signal fetching is bounded to the visible window.** A pure window function decides which result names get eager packument and download fetches (visible rows plus a small prefetch margin); more resolve as the user scrolls, exploiting the existing memo so nothing is fetched twice. Bundle size stays lazy and focus-only per ADR 0008. `--list`/`--json` fetch signals for every result they print — the window applies to the interactive box only.
- Signal families, glyphs, and the informational contract (never block, filter, or reorder) are otherwise unchanged.

### `--json` contract change

| Field | Before | After |
| --- | --- | --- |
| `score.quality` / `score.popularity` / `score.maintenance` | always `1` | removed |
| `score.final` | documented 0..1, actually ~hundreds | removed from output; internal tiebreaker only |
| `downloads` (weekly count) | absent | present when known, absent when not |
| `deprecated`, `publishedAt`, `provenance`, `installSize`, `license`, `replacedBy` | present | unchanged |

Absence continues to mean "not known", consistent with the license signal's three-valued treatment.

### Command-surface cleanups

- The `latest` upgrade level is removed; `major` is the canonical name for "newest overall" and the bare default is unchanged. Level validation and help text updated.
- The interactive bundle version-policy prompt offers all four strategies (latest, exact, caret, tilde), matching `--strategy`.
- Recording a bundle entry with an explicit `@version` while `--strategy` is set prints a notice that the version pinned the entry.
- `--no-rules` help text no longer renders a misleading default.
- `siz help` and `siz version` are kept deliberately.
- The dependency-rules guardrail, the dependency scan, registry comparison, upgrade, outdated, catalogs, and workspace discovery are all untouched by this pass.

### Documentation artifacts

- **ADR 0010** — bundles as the only saved-package store (covers favorites removal, the v4 migration, categories removal, and the flat front door).
- **ADR 0011** — weekly downloads replace npm's score bars, recording the observation that npm's score detail is constant and its relevance number is not a fraction.
- **ADR 0012** — packument as the source for deprecation and provenance, partially superseding ADR 0003, and recording the deliberate narrowing of `✓` to attestation-only.
- **Glossary**: correct the **Score** entry (both halves are currently false), narrow **Provenance**, rework **Momentum** so the count is primary and the arrow derived, add **Download count**, and add the missing **Organize** section with **Bundle**, **Saved entry**, and **Front door**.
- **README**: rewrite the Features section and every affected prose section — search and act, signals, install/uninstall, bundles, commands table, quick start, data sources table. Remove favorites, categories, score bars, and the second search command.
- **Project instructions**: refresh the `siz -h` block and the module map, per the repo's no-drift rule for the help surface.
- One changeset at **minor** (pre-1.0 convention for features and breaking changes), calling out the removed commands, flags, and `--json` fields.

## Testing Decisions

A good test here asserts **externally observable behavior** — what the store returns, what a search yields, which signal facts are derived, what a command dispatches — and never reaches into how it was computed. No test should assert on ANSI-formatted TUI output, on internal call ordering, or on the shape of a memo. Where behavior is a pure transformation, it is tested as a pure function; where it is network-dependent, the network is stubbed at the module boundary and the mapping is asserted.

**Seams (4 existing reused, 0 new modules, 1 new test file):**

1. **Store, at its injected data-file seam** — the existing pattern of a temp directory plus an explicit data-file argument, and `migrate()` exercised against raw objects. Covers: v4 migration of a v3 object containing favorites (entries preserved, category and stale version dropped, bundles untouched); migration idempotency and the non-destructive guarantee; per-entry bundle removal including a name that isn't in the bundle; the flat saved-entry query's ordering, bundle tagging, and single-bundle filter; empty-store behavior. This is the **highest** seam for the Organize change — `siz list`, the front door, and `bundle rm` are thin renderers over it and need no seam of their own.
2. **Registry, at `searchPackages` with a stubbed global fetch** — the existing pattern in the registry tests. Covers: a multi-word query returning every fetched result (the `react form validation` and `state management` regressions, asserted as non-empty); an exact name sorting first; re-ranking never reducing the result count; qualifier handling unchanged; removal of category filtering.
3. **Trust and packument, with stubbed fetch and a mocked metadata batch** — the existing patterns in the trust, size, and license tests. Covers: deprecation and provenance derived from the packument projection; a deprecated package's message still yielding a replacement suggestion; the metadata batch consulted only for publish age; weekly count retained and momentum still derived from both periods; a scoped package receiving a count but no momentum; silent degrade on failure for each source independently; the resolved-vs-never-resolved distinction preserved.
4. **Command dispatch** — the existing pattern of mocking core modules and asserting what the command called. Covers: `runAdd` dispatching install versus bundle-record with no favorite path; the removed flags producing an explanatory error; `runRemove` always building an uninstall command; the non-interactive guard rejecting `--json`/`--list` without a query.

**Two new pure functions, tested as pure functions:**

5. **A downloads formatter in the trust module**, sitting beside the already-tested publish-age formatter. Tested for magnitude thresholds and rounding. This keeps the downloads figure testable without introducing a rendering seam — there is no render test file today and this spec does not add one.
6. **A signal-window function in the packument module** — pure, given a result count, a focus index, a viewport size, and a prefetch margin. Tested for window bounds at the start, middle, and end of a list, and for lists shorter than the viewport. This adds a test file for the packument module (currently covered only indirectly through the size and license tests); it does **not** add a module or an abstraction to the TUI.

**Prior art to follow:** the store tests for temp-file and migration style; the registry tests for stubbed-fetch search assertions; the trust, size, and license tests for progressive-signal mapping and silent degrade; the add and remove tests for command dispatch with mocked core. Deleted alongside the feature: the categories test file, and the favorites-specific cases in the store, add, and remove tests.

**Untested, deliberately:** the interactive command, the search prompt, and the render module — as today. Everything decision-bearing is pushed down into core, where the seams already exist.

## Out of Scope

- The dependency-rules guardrail, the planned `siz check` audit, and license policy rules.
- The dependency scan, registry comparison, upgrade planning, outdated reporting, pnpm catalogs, and workspace discovery — untouched except for removing the redundant `latest` level name.
- Any roadmap item still marked Next / Later / Maybe: non-interactive `--yes` coverage, upgrade `--include`/`--exclude` filters, the interactive uninstall picker, `siz run`, `siz x`, `siz why`, export/import, search history, ships-types and lighter-alternative signals, AI-assisted search, the comparison view, Yarn/Bun catalogs.
- Restoring npm's retired quality/maintenance scores from any other source (for example a third-party scoring API) — this pass removes the dead display, it does not shop for a replacement beyond download counts.
- Momentum for scoped packages (needs two periods per package; the count is the valuable half and the gap is documented instead).
- Recovering npm's trusted-publisher flag now that provenance is attestation-derived.
- A rendering test seam, snapshot tests of TUI output, and end-to-end CLI process tests.
- Bundle size sourcing and its focus-only fetch strategy, which ADR 0008 already settles.
- Adding a category or tag concept to bundle entries as a replacement for heuristic categories.

## Further Notes

- **Evidence behind the removals**, all reproduced against the live registry during the design session: npm's search endpoint returns `quality = popularity = maintenance = 1.000` for every result, with `score.final` in the hundreds; `siz react form validation` and `siz "state management"` both return 0 results while `siz search "state management"` returns 20; the `/latest` packument (~4 kB) carries `license`, `dist.unpackedSize`, `deprecated`, and `dist.attestations`, but no publish time; the abbreviated packument is not a viable substitute (about 1 MB for `zod`, and it carries neither `license` nor `deprecated`).
- **Sequencing**: removal first (store v4, favorites, categories, list, bundle entry removal), then the search collapse, then the signal rewiring, then the small cleanups, then docs. The first three phases touch the same modules, so doing them as one sweep avoids resolving the same conflicts twice. Run the test, typecheck, and lint gates after each phase.
- **Formatting gate**: `pnpm format` fails repo-wide in this checkout from CRLF line endings, and `format:fix` would churn every file. Leave it alone; rely on test, typecheck, and lint.
- The migration is the only irreversible step for users. It should be conservative: preserve every package name, never delete a bundle, and be safe to run twice.
- Fewer requests per search is a stated benefit but not a measured target; no performance budget is being asserted here beyond "bounded to visible rows plus prefetch, and no fact fetched from two providers".
