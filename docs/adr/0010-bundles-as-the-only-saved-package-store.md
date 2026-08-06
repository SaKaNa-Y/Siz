# Bundles are the only saved-package store; favorites and guessed categories are removed

## Status

accepted

## Context & Decision

Siz had **two ways to save a package**. Favorites were a flat name→record map keyed in the data file; bundles were named groups with a dependency type and a version strategy per entry. Bundles recorded strictly more, yet favorites were what the empty search box opened, so the richer concept was the hidden one and a user's first question on saving anything was "which of these am I supposed to use?". The overlap also leaked into the command surface: `siz add --fav` versus `siz add --bundle`, and a `siz rm --fav` that removed a favorite while bare `siz rm` uninstalled — two stores reached through mode flags on the same two verbs. Per-package removal existed only for the store nobody was steered toward: `siz bundle rm` deleted the whole bundle.

A favorite also carried two fields that were quietly wrong. Its **version** was a snapshot taken at the moment of favoriting and never refreshed, so `siz list` printed versions that drifted stale by design. Its **category** was a heuristic label siz guessed from the package's name and keywords — `zod` shown as `[DevTools]`, `zod-to-json-schema` as `[Backend]` — rendered in the same row position as fetched facts like `MIT` and `4.6 MB install`, so it read as if it had a source.

We **removed favorites and heuristic categories, and made bundles the only place packages are saved.** Three parts:

1. **Schema v4 migrates, it does not discard.** A guarded `v3 → v4` step moves every favorite into a bundle named `favorites` (`FAVORITES_BUNDLE`), recorded as a regular dependency with `strategy: 'latest'`. The stale version snapshot and the guessed category are dropped rather than carried over — carrying the version forward would have converted a stale snapshot into a real pin, which is worse than losing it. An entry already present in the bundle wins, so a second run is a no-op. `migrate()`'s invariant is narrowed from "never drops anything" to **"never drops a package"**: a step may retire the *fields* of a retired concept, deliberately and documented at the step.
2. **The front door becomes a flat cross-bundle list.** `listSavedEntries({ bundle? })` returns every entry across every bundle, each tagged with the bundle it came from, ordered by bundle then package name. One function backs both the empty-box path and `siz list`, so the two views are the same data by construction rather than by discipline.
3. **Per-entry removal exists.** `siz bundle rm <bundle> [...packages]` removes named entries (reporting names that were not there) and keeps deleting the whole bundle when given none. Removing the last entry leaves an **empty bundle** rather than deleting it implicitly.

The categories module, the `category:`/`cat:` query qualifier, the `--category` filter, and the category label on rows and cards are deleted outright — the qualifier removed from the grammar rather than accepted-and-ignored.

## Considered options (and why the chosen path)

- **Collapse favorites into a "default" bundle and keep the favorites API as an alias.** The tempting non-breaking path, and rejected on both halves. It keeps every line of favorites code alive under a new name — the mutators, the type, the render branch, the `--fav` flags — so the duplication the change exists to remove survives with a nicer label; and it ships a bundle whose defining capability (`siz bundle install <name>` installing all of it) is one nobody wants for a lint-of-everything-I-ever-liked list. Deleting outright cost exactly one thing: a level of navigation, since favorites *were* the flat list. That is what the cross-bundle saved-entry query buys back, which is why 1 and 2 above are one decision and not two.
- **Drop favorites without migrating them.** Cheapest, and unacceptable: the favorites map is the only user-curated data siz stores. Losing it on upgrade would be silent and unrecoverable.
- **Migrate favorites into the bundle as pinned entries at their stored version.** Rejected — the stored version is precisely the field that was wrong. `latest` tracking is what a favorite always meant in practice.
- **Delete favorites but leave `siz rm --fav` accepted as a no-op** (or let cac report "Unknown option"). Rejected: a removed flag that silently succeeds is worse than an error, and a bare parser error teaches nothing. Removed flags are caught in `commands/removed-flags.ts` **before** cac parses argv, so the message names the flow that replaced them.
- **Keep heuristic categories as an organizing axis on bundle entries.** Rejected twice over. Bundles *are* categorization, chosen by the user, which makes a guessed taxonomy redundant; and a guessed label contradicts siz's own rule that a result signal is a fact fetched from a source, never an opinion siz forms. A user-supplied tag concept on entries is deliberately out of scope rather than a replacement.
- **Delete the bundle when its last entry is removed.** Rejected: an empty named bundle is a meaningful thing to hold open while you rebuild it, and implicit deletion makes `bundle rm <b> <pkg>` occasionally do something much larger than it says.

## Consequences

- **Breaking**, announced with a `minor` changeset (pre-1.0 convention): `--fav` is gone from `add` and `rm`, `siz list -c/--category` is gone, the `category:` qualifier is gone, and the favorite mutators (`addFavorite`, `removeFavorite`, `listFavorites`, `setCategory`) and `FavoritePackage` leave the library surface. `listSavedEntries` and `FAVORITES_BUNDLE` are exported in their place.
- This **completes the direction ADR 0006 set**: `siz add` is now a two-way multiplexer (install / `--bundle`) and `siz rm` is uninstall-only with no mode flag. ADR 0006's `--fav` half is marked historical there.
- The v4 migration is the only **irreversible** step for a user, which is why it is conservative: preserves every name, never deletes a bundle, safe to run twice. `test/store.test.ts` pins the migration against raw v3 objects and asserts idempotency.
- The already-exported-but-unused `removeFromBundle` is finally wired to a command; it reports `{ removed, missing }` so the command can name entries that were not there instead of failing or lying.
- `siz list` and the empty-box front door are now thin renderers over one store query, which is why neither needed a test seam of its own — the store's seam covers both.
- The glossary gained an **Organize** section (Bundle, Saved entry, Front door). Its absence is part of how the two stores drifted into overlap in the first place.
