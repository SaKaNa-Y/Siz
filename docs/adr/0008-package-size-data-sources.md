# Package-size signal: two data sources, eager install + lazy bundle

## Status

accepted

## Context & Decision

The **size signal** shows a package's weight before install — its *install size* (own unpacked-on-disk bytes) and *bundle size* (minified+gzipped ship weight including transitive deps). Neither number is available from the sources Siz already uses: the npm **search** endpoint returns no `dist`, and the hosted **`fast-npm-meta`** aggregator (ADR 0003) exposes deprecation/provenance/publish-date but **no size fields**. So — unlike download momentum, which reused an official npm endpoint with 128-name batching — size cannot ride an existing batched call. It needs new, per-package sources.

We take size from **two** places, each matched to its cost:

- **Install size** → the npm **packument**, `registry.npmjs.org/<pkg>/latest` → `dist.unpackedSize`. Official, universal, one field. Fetched **eagerly** for every visible result (one request per package, bounded concurrency) and shown inline on every row, in `--list`, and as an `installSize` field in `--json`.
- **Bundle size** → **Bundlephobia** (`bundlephobia.com/api/size`). Third-party, slow (it builds the bundle server-side), and rate-limited. Fetched **lazily — only for the focused row** in interactive search — and shown in that row's detail. It is **never** fetched in `--list`/`--json`.

Both degrade silently (short timeout, single attempt, session-scoped memo), exactly like the trust signals.

## Considered options (and why the chosen path)

- **One number vs. two.** Install size and bundle size answer different questions (on-disk footprint of this package vs. browser-ship weight of it *and* its deps). We show both, clearly labelled, rather than collapse them into one misleading figure.
- **Eager bundle size for all rows.** Rejected: ~20 Bundlephobia requests per result set trips its rate limit and returns mostly-empty data. Scoping bundle size to the focused row bounds it to ~1 request per navigation and keeps it useful.
- **Bundle size in `--json`.** Rejected for the default path: a `--json` over 20 results would fire 20 Bundlephobia calls in a CI/scripting context — the worst place for a slow, rate-limited third party. Non-interactive output stays install-size only, so it is fast and dependency-light. (A future opt-in flag could add it if demand appears.)
- **Extend `fast-npm-meta` upstream.** Out of scope — not our service to change, and it wouldn't cover Bundlephobia's bundle math anyway.

## Consequences

- Siz adds **two new data sources** beyond the trio in ADR 0003: a per-package **official** packument fetch (install size, all rows) and a per-package **third-party** Bundlephobia fetch (bundle size, focused row only). This narrows ADR 0003's "all registry-shaped metadata goes through one batched `fast-npm-meta` call" to *version/trust* metadata; size is intentionally out of that batch because the data simply isn't there.
- Install size costs N packument requests per result set (bounded concurrency, memoized). Bundle size adds ~1 Bundlephobia request per focused row. Both are background/lazy and never block the list; when either service is unreachable the corresponding number just doesn't appear.
- A **heavy** threshold (`HEAVY_INSTALL_BYTES`, ~1 MB) is an editorial constant (like `STALE_YEARS`) that renders a glyph past the line — and defines the "heavy" notion the planned *lighter-alternative suggestion* feature will reuse.
- Documented user-facing in the README's **Data sources & network** table so the new endpoints aren't a surprise.
