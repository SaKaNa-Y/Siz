# Deprecation replacement suggestions are parsed from the message, not curated

## Status

accepted

## Context & Decision

The roadmap line "Smart replacement suggestions for deprecated or heavier packages" fused two problems with different data sources. We split them and shipped only the **deprecated** half: when a deprecated package's message names a successor, the Discover track surfaces it as `→ replaced by X`.

The replacement is **parsed from the `deprecated` message siz already fetches** (in the single `getLatestVersionBatch(..., { metadata: true })` call behind every [[trust signal]]) — *not* from a curated alternatives map, and *not* verified against the registry. A pure `parseReplacement(message, selfName)` helper extracts names only from explicit replacement triggers ("use X", "replaced by X", "migrate to X", an `npmjs.com/package/X` URL) or a back-tick/quoted name in that context; it validates the npm-name shape, drops version-only tokens (`v3`, `^2.0.0`) and the package's own name, handles enumerations (`use \`date-fns\` or \`dayjs\``), and returns `[]` rather than guess. It is **informational only** — it reuses the existing `⚠` glyph (no new glyph), renders in the focused-row detail / `--list`, and adds a `replacedBy` array to `--json`. It never blocks, filters, reorders, or offers an action.

## Considered options (and why the chosen path)

- **Parse the message vs. a curated map.** A curated `moment → dayjs` style map would cover deprecated packages whose message names no successor, but it is **editorial** — siz's opinion, not a fact about the package — and it rots (recommended successors drift) and carries ongoing maintenance. Parsing reflects exactly what the maintainer wrote, needs no new data source, and degrades silently like the other signals. We chose parsing, and deliberately reserved the curated, opinionated map for the separate planned **lighter-alternative** feature (the "heavier packages" half), keeping editorializing out of the deprecation signal.
- **Parse-and-verify on the registry vs. parse only.** Confirming each candidate exists on npm would cut false positives further, but adds a network round-trip per deprecated result — breaking the "one batched attempt, silent degrade" philosophy the trust fetch established. We chose high-confidence parsing with no extra call: misses are acceptable, false positives are minimized by requiring explicit trigger context and a strict name shape.
- **Informational vs. actionable.** Every existing trust signal is purely informational (see [[CONTEXT.md]]). Letting the user swap to the suggested package from the search box would be useful but breaks that contract and adds interaction to the prompt. We kept v1 informational and left an actionable swap as a future follow-up.

## Consequences

- **Packages whose message names no clear successor show no suggestion** — most famously `moment`, whose message describes legacy status without naming one replacement. This is the most surprising user-visible gap and the main reason this is recorded: the absence is intentional (honest over editorial), not a bug.
- The parse is **high-confidence but not exhaustive**: unusual phrasings are missed, and a bare enumerated continuation (`use foo and bar`) keeps only the trusted first token unless the rest is quoted. Since the output is informational, a miss is low-stakes.
- "Which package is leaner?" guidance is explicitly **out of scope** here and deferred to the curated lighter-alternative feature — a different kind of claim (siz's recommendation vs. the maintainer's).
