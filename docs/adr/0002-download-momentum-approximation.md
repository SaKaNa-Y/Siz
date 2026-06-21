# Download-trend momentum as a two-call approximation

## Status

accepted

## Context & Decision

The Discover track's [[trust-aware discovery]] surfaces health facts inline on search results. We wanted to add **momentum** — whether a package is gaining or losing download traction — as the next trust signal, since npm's static `score.popularity` already covers raw popularity but says nothing about *direction over time*.

npm exposes no trend value directly. The only public source is the download-counts API (`https://api.npmjs.org/downloads/...`), separate from the search and metadata sources behind the existing signals. We chose to **approximate momentum from two bulk point calls** — `last-week` and `last-month` totals — and derive the direction locally:

```
recentDaily   = weekly / 7
baselineDaily = (monthly - weekly) / 23      // the ~3 weeks before this one
pctChange     = recentDaily / baselineDaily - 1
rising  : pctChange > +0.20  (and monthly ≥ 1000)
falling : pctChange < -0.20  (and monthly ≥ 1000)
otherwise: no glyph (flat / unknown)
```

Both directions render (`↑` green, `↓` red); flat shows nothing. The thresholds are named constants (`MOMENTUM_THRESHOLD`, `MOMENTUM_MIN_DOWNLOADS`). The fetch mirrors the trust-signal fetch: session-memoized, short timeout, single attempt, silent degrade — momentum never blocks search and never reranks results.

## Considered options (and why the chosen path)

- **Two bulk point calls vs. per-package range calls.** The accurate approach is one `range/last-month` request per package (30 daily points → real slope). But that fans out to ~20 concurrent requests per result page, breaking the "one batched attempt" philosophy the trust fetch established. Two bulk calls cover a whole 20-result page regardless of size, at the cost of precision. We accepted the approximation: momentum is a coarse "rising/falling" hint, not a metric, so a proxy is good enough.
- **Excluding the recent week from the baseline.** `last-month` *includes* the `last-week` window, so comparing `week/7` against `month/30` dilutes the recent spike into its own baseline and dampens the signal. Subtracting the week (`(monthly - weekly) / 23`) gives a cleaner before/after split using the same two numbers — no extra request.
- **Volume floor.** Tiny packages swing wildly on a handful of downloads (12 → 20 is +67%). Without a floor the signal is actively misleading, screaming "rising" louder than React. A 1,000/month floor suppresses the noise while still surfacing genuinely-small-but-growing tools — exactly what a discovery CLI should reward.
- **Both directions vs. positive-only.** Unlike [[provenance]] (positive-only `✓`), momentum shows both `↑` and `↓`: a package losing traction fast is precisely the kind of health warning trust-aware discovery exists to give.

## Consequences

- **Scoped packages (`@scope/pkg`) get no momentum.** npm's *bulk* download endpoint rejects scoped names, and we deliberately don't fall back to per-package calls for them (it would reintroduce the fan-out we rejected). Scoped results simply show no momentum glyph — consistent with how every trust signal degrades to silence. This is the most surprising user-visible gap and the main reason this is recorded.
- The trend is **approximate**: it can disagree with a hand-computed slope, especially near the threshold. It is informational only — it never filters, blocks, or reorders results — so an occasional wrong arrow is low-stakes.
- The thresholds and floor are tunable constants, but they are a *judgment* about what counts as a real trend; changing them shifts how many arrows appear and is a perceptible behavior change.
