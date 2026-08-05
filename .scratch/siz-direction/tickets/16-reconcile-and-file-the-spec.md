# 16 — Write and file the spec

Labels: `wayfinder:task`
Status: open
Claimed by: —
Blocked by: 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 17, 18

## What to do

The destination ticket. Turn everything this map decided into a spec and issues someone can pick up and build.

- Read the map's **Decisions so far** and write the spec from those decisions only. An earlier attempt at this spec was written before the research ran and has been deleted; do not reconstruct it from memory or from a summary. Anything not recorded in a closed ticket is not decided.
- Scope the spec to what the route settled. Tickets 08, 09, 10, 11 and 12 each decide whether a capability is in, deferred, or dropped — carry those verdicts, including the negative ones, so the spec states its own boundaries.
- Break the work into tracer-bullet issues: each a complete path through every layer, verifiable on its own, sized for one context window, with correct blocking edges. Prefactoring first.
- Carry the distribution work items from ticket 14 and the CI packaging decision from ticket 12 into the plan as real work items, rather than leaving them as intentions.
- Check that no issue touches files owned by the still-open `optimization-pass` issues 06–10, which land independently.
- Set the triage status to `ready-for-agent`. That is the point at which the work becomes grabbable.

## Code facts already established

Worth not re-discovering; verify each still holds before relying on it.

- `core/resolve.ts` already exposes the shared discovery front-half (nearest manifest, workspace-aware members when recursive, nearest pnpm catalog, deduped query names) that `upgrade` and `outdated` both use. Its docstring names a `siz check` audit as an intended third consumer, so the audit needs no new discovery code.
- `core/compare.ts` is the shared registry-comparison core (ADR 0007) — the precedent for "one neutral core, two commands specialising it".
- The natural test seam for a policy engine is a pure function taking dependencies **plus pre-fetched facts**, mirroring how `buildOutdatedReport(deps, versions)` takes an injected version map. That keeps every predicate testable with plain objects and no network.
- `core/packument.ts` fetches `registry.npmjs.org/<pkg>/latest`, memoized per process, and its map contract is load-bearing: a name is present **iff** its packument resolved, which is how "declares no license" stays distinct from "never found out". Any facts layer should inherit that contract rather than flatten it.
- That module is keyed on package **name** and always fetches `/latest`. Anything needing facts about a *specific* version (an upgrade target, a lockfile-resolved package) needs `name@version` against `/<pkg>/<version>` — a second cache with a different invalidation story, and the immutable one of the two.
- Facts for install size and license already share a single packument request per package, so adding predicates over them costs no new network traffic.

## What would resolve this

A filed spec with numbered issues, all `ready-for-agent`, that a fresh agent can implement without reading this map.

When this closes, the map is done: nothing remains to decide before someone goes and builds.
