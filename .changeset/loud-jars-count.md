---
"@sakana-y/siz": minor
---

Weekly download counts replace npm's retired score bars on every search result.

npm now returns a constant `1.000` for `quality`, `popularity` and `maintenance` on every package, so the `quality ▰▰▰▰▰  popularity ▰▰▰▰▰` bars were structurally always full. They are gone from interactive rows, `--list` output and result cards, and in their place each row leads with the package's weekly download count (`250.1M/wk`, `1.5k/wk`) — a fact you can actually compare.

Unscoped packages get the count from the download data siz already fetched for the `↑`/`↓` momentum arrow, at no extra request. Scoped packages (`@types/node`, `@tanstack/react-query`), which npm's bulk endpoint rejects and which previously showed nothing, now get a last-week count from its single-package endpoint with bounded concurrency — so they show a count, though still never an arrow. Counts load progressively and degrade silently like every other result signal, and a count siz couldn't fetch renders nothing rather than a misleading zero.

Along the way this fixes a latent bug in the download fetch: npm picks its response shape by name count, so a request for exactly one package comes back as a bare object rather than a name-keyed map. A lone unscoped result — the last chunk of any odd-sized search — was silently losing its data, which is why the `↑`/`↓` arrow sometimes went missing. Both shapes are now normalized.

**Breaking (`--json`):**

- **Added** `downloads` per result — present when known, absent (never `0`) when not.
- **Removed** the `score` object (`final`, `quality`, `popularity`, `maintenance`) and the `searchScore` field. The three score numbers are constants upstream; the registry's relevance number survives only inside siz, as the last tiebreaker in name-affinity ranking.

Library consumers: `SearchResult.score` is removed from the type, and `fetchDownloadTrend()` is renamed `fetchDownloadSignals()` — it now returns a count as well as a trend. A pure `formatDownloads()` is exported alongside `formatPublishAge()`.
