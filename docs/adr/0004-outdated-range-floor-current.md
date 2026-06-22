# `siz outdated` reports "Current" as the range floor, not the installed version

## Status

accepted

## Context & Decision

`siz outdated` is a read-only, non-interactive report of dependencies that are behind the
registry, intended to be run in CI (`--json`, `--exit-code`). To report anything it needs a notion
of a dependency's **current** version — the baseline that "Wanted" and "Latest" are compared
against. There are two candidates: the **installed** version (what `npm outdated` reports, read
from `node_modules` / the lockfile) or the **range floor** (the lowest version satisfying the
`package.json` range, e.g. `^18.2.0` → `18.2.0`).

We report **Current = range floor**, computed by the existing `currentVersionFromRange`
(`core/upgrade.ts`, which uses semver `minVersion`). The command reads only `package.json`
(and `pnpm-workspace.yaml`) — it never touches `node_modules` or any lockfile. This is the same
meaning of "current" that `siz upgrade` already uses, so the two commands agree by construction.

## Considered options (and why the chosen path)

- **Range floor vs. installed version.** The headline use case is a CI gate, which frequently runs
  on a **fresh checkout before `install`** — exactly the situation where there is no `node_modules`
  and a lockfile may not even exist. An installed-version reading would make the command fail (or
  report nothing) in its primary use case. The range floor is a pure function of `package.json`, so
  it always works and is deterministic. It also answers the question siz actually asks — *"is my
  **declared range** behind the registry?"* — rather than *"are my installed bytes stale?"*.
- **Reading lockfiles to recover the installed version.** Rejected on scope and fragility: it would
  mean parsing four formats with different shapes and lifecycles — `pnpm-lock.yaml` (v9 YAML),
  `package-lock.json`, `yarn.lock`, and the **binary** `bun.lockb` — and still degrade to nothing
  pre-install. Not worth it for a v1 report. A future `--installed` flag could layer this on without
  changing the default.
- **A second, divergent meaning of "current".** Rejected: `siz upgrade` already defines current as
  the range floor. Introducing an installed-version meaning in `outdated` would put two definitions
  of the same word in one tool, which the glossary ([CONTEXT.md](../../CONTEXT.md)) exists to prevent.

## Consequences

- `siz outdated` **diverges from `npm outdated`** whenever the lockfile has moved ahead of the range
  floor (e.g. range `^18.2.0`, installed `18.3.1`): npm shows `18.3.1` as Current, siz shows
  `18.2.0`. This is documented in the README's **Outdated report** section so it isn't a surprise.
- The command works on a fresh CI checkout with no install step — the property that makes the
  `--json` / `--exit-code` gate usable.
- "Current" has a single, consistent meaning shared by `siz upgrade` and `siz outdated`, recorded as
  a glossary term in CONTEXT.md.
