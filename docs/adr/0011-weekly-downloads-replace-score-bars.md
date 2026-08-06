# Weekly download counts replace npm's retired score bars

## Status

accepted

## Context & Decision

Every siz result row led with `quality ▰▰▰▰▰  popularity ▰▰▰▰▰` — bars rendered from the `score.quality` / `score.popularity` / `score.maintenance` fields of npm's search response, and also emitted in `--json`.

**npm no longer computes those numbers.** Reproduced against the live endpoint during the design session: `registry.npmjs.org/-/v1/search` returns `quality = popularity = maintenance = 1.000` for **every package, on every query**. This is invisible from the code — the parsing is correct, the rendering is correct, and the bars look plausible — so the observation is recorded here rather than left to be rediscovered. The two most prominent elements on a row carried no information and could not vary.

The same response's `score.final` was documented in siz as a 0..1 fraction. It is not: observed values run into the **hundreds**. It is an opaque relevance number whose scale npm does not specify.

Meanwhile siz was already calling npm's download API for every result, to derive the momentum arrow (ADR 0002) — and throwing the underlying **count** away.

We **replaced the score bars with the weekly download count**, and removed the score fields entirely:

- The count is a first-class trust-family signal, rendered inline on every row (interactive, `--list`) and present in `--json` as `downloads`, humanized by magnitude (`812`, `1.5k`, `340k`, `12.3M`). It adds **no request** for unscoped names — it is the number momentum was already computing over.
- **Scoped packages** (`@types/node`, `@babel/core`) previously showed nothing, because npm's bulk downloads endpoint rejects scoped names. They now get a last-week count from the single-package endpoint, bounded concurrency, same silent-degrade rules. Momentum still needs two periods per package and stays unavailable for them — a count but never an arrow.
- `score.quality`, `score.popularity`, `score.maintenance` and `score.final` are **removed** from `SearchResult`, from rendering, and from `--json`. The relevance number survives only internally, as `searchScore`: the last tiebreaker in name-affinity ranking, after term coverage and the match tiers. It is destructured off before `--json` is serialized.
- A count siz never learned renders **nothing, not a zero** — the same unknown-vs-finding distinction ADR 0009 draws for the license.

## Considered options (and why the chosen path)

- **Leave the bars in place.** Rejected once the constant was confirmed: they are decoration that reads as a measurement, occupying the row's most valuable space. A row of full bars on every package actively misleads — it looks like unanimous approval rather than an absent metric.
- **Keep the score fields in `--json` as constants** (write `1` and let consumers ignore them). Rejected: a field that is always `1` invites scripts to be built on it, and the breakage is then silent and permanent. Removing it is a one-time, loud, changelog-able break — a `minor` changeset under the pre-1.0 convention. Absence already means "not known" everywhere else in the `--json` contract.
- **Source replacement quality/maintenance scores from a third-party scoring API.** Rejected and put explicitly out of scope. This pass removes a dead display; shopping for a new grader is a separate decision with its own dependency and its own editorial exposure (siz reports facts, it does not grade). The download count is a *fact*, which is why it is an acceptable occupant of that space.
- **Expose `score.final` as a documented relevance number instead of removing it.** Rejected: it is unspecified, unstable, not comparable across queries, and useful only for the one thing siz does with it internally. Publishing it would make an npm implementation detail part of siz's public shape.
- **Show the count only for unscoped packages** (where it is free) and leave scoped names blank. Rejected: `@types/node` and `@babel/core` are exactly the packages a user scanning an adoption column wants a number for, and a blank cell in a populated column reads as "unpopular", not "not fetched".
- **Fetch two periods for scoped packages too, to give them an arrow.** Rejected for now: it doubles the per-scoped-name request count for the derived half of the signal. The count is the valuable half; the gap is documented in the glossary rather than papered over.

## Consequences

- **Breaking for `--json` consumers**: the `score` object and `searchScore` are gone, `downloads` is new (absent, never `0`, when unknown). Called out in the changeset.
- `SearchResult.score` is removed from the **library** type, and `fetchDownloadTrend` is renamed `fetchDownloadSignals` — it now returns a level as well as a direction.
- Fixed a latent bug uncovered in the same fetch: npm chooses its downloads response *shape* by name count, so a single-name request answers with a bare object rather than a name-keyed map. A lone unscoped result was silently losing both its count and its arrow. Both shapes are normalized in one place, which also subsumes what the scoped path would otherwise duplicate.
- The count formatter is a **pure function** beside the existing publish-age formatter, tested for magnitude thresholds and rounding — so the figure is testable without introducing a render seam (there is still no render test file, deliberately).
- The glossary's **Score** entry is retired-in-place: it now records that the numbers were constant and that what remains is an internal tiebreaker. Keeping the entry rather than deleting it is what stops the bars from being re-added by someone reading old screenshots.
- Anyone reintroducing a score display must first re-check the live endpoint. If npm ever revives the metric, this ADR is the thing to supersede.
