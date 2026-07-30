# 04 — One search: rank, don't filter

**What to build:** Every query returns results, and the closest name matches come first.

Today `siz react form validation` — the first example in `siz -h` — returns **zero** results, as does `siz "state management"`, because the default command narrows the registry's full-text results down to packages whose *name* fuzzy-matches the whole phrase. Both commands issue the identical registry request; one then subtracts.

After this ticket there is one search. Name affinity **re-ranks** the fetched results so closer name matches sort first, using the registry's own relevance number as the tiebreaker, and never removes a result. `siz pino` still puts `pino` at row one; `siz react form validation` returns useful packages. Descriptions are always available for display, since there is no longer a mode that hides them. `siz search` stays registered as a hidden alias for one minor release so a documented command doesn't break without warning.

Separately, `--json` or `--list` without a query now exits non-zero with a clear message instead of falling through into the interactive box — a CI script whose variable came out empty must never get a TUI.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** 03 — Remove heuristic categories.

**Status:** ready-for-agent

- [ ] `siz react form validation` returns a non-empty result set
- [ ] `siz "state management"` returns a non-empty result set
- [ ] An exact name match sorts first for a single-token query
- [ ] Re-ranking never reduces the number of results returned by the registry
- [ ] The result count requested by `-n/--size` still bounds how many results are fetched
- [ ] The search mode concept is removed from the search path, the interactive command and the print command
- [ ] Descriptions are shown for results
- [ ] `siz search <query>` still works as a hidden alias and is no longer advertised as a separate command
- [ ] `siz --json` and `siz --list` with no query exit non-zero with a message stating a query is required, and never open the interactive box
- [ ] Search tests cover the two zero-result regressions as non-empty assertions, exact-name-first ordering, and count preservation, using the existing stubbed-fetch pattern
- [ ] The `siz -h` block, examples and per-command help in the project instructions reflect one search command
- [ ] A changeset is authored at `minor` describing the unified search and the non-interactive guard fix
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass (leave `pnpm format` alone)
