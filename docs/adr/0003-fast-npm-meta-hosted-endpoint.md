# Version & metadata resolution via fast-npm-meta's hosted endpoint

## Status

accepted — **partially superseded by ADR 0012**: deprecation and provenance now come from the npm packument siz already fetches per result, so the hosted aggregator is consulted for **publish age** alone among the trust signals. Upgrade resolution and bundle install still go through it, and everything below still describes them.

## Context & Decision

Three Siz features need registry data the npm search endpoint doesn't return: **trust signals** (deprecation, publish date, provenance), **upgrade resolution** (full version lists per package), and **bundle install** (latest version of each entry). We resolve all three through [`fast-npm-meta`](https://github.com/antfu/fast-npm-meta), calling its batch functions (`getLatestVersionBatch`, `getVersionsBatch`, `getLatestVersion`) **without overriding `apiEndpoint`** — so they hit the library's default API, **`https://npm.antfu.dev/`**, a third-party service maintained by antfu that mirrors and aggregates the npm registry. Package search (`registry.npmjs.org/-/v1/search`) and download-trend momentum (`api.npmjs.org/downloads`) talk to official npm endpoints directly; only the metadata/version path goes through the hosted aggregator.

## Considered options (and why the chosen path)

- **`fast-npm-meta`'s hosted API vs. calling `registry.npmjs.org` directly.** The raw registry exposes this data only per-package (a full document fetch per name) and not in the shape we want; getting deprecation + publishedAt + provenance + version lists for 20 results would be 20+ requests and a lot of parsing. `fast-npm-meta` returns exactly that shape for a `+`-joined batch in **one** request (`?metadata=true`), which is why the existing trust/upgrade/bundle code is small. We accepted the external dependency for that leverage.
- **Default endpoint vs. self-hosting.** `fast-npm-meta` accepts an `apiEndpoint` option, so the service is overridable — but the library speaks its **own** aggregation protocol (`/versions/<pkgs>`, `?metadata=true`, `+`-joined batches), not the registry protocol, so you can't simply repoint it at `registry.npmjs.org`. Truly dropping the hosted hop means self-hosting that API or reimplementing the fetches against the registry. We chose the zero-config default for now and documented the override path.

## Consequences

- Siz carries a **runtime dependency on a third-party personal service** (`npm.antfu.dev`) for trust signals, upgrades, and bundle resolution. If it's slow or down, those features degrade — trust glyphs silently don't appear (short timeout, single attempt, no retry); upgrade/bundle surface the failure. Core search is unaffected (official registry).
- Swapping providers later is a non-trivial change (protocol mismatch with the raw registry), which is why this is recorded.
- This is documented user-facing in the README's **Data sources & network** section so the dependency isn't a surprise — the lack of that disclosure is what prompted this ADR.
