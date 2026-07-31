# `add` / `rm` mean install / uninstall; favoriting moves to `--fav`

## Status

accepted — partially superseded: favorites (and with them `--fav`) were removed when bundles became the only saved-package store, completing the direction this ADR set. `siz add` is now a **two**-way multiplexer (install / `--bundle`) and `siz rm` is uninstall-only with no mode flag. The verb remap itself stands; only the `--fav` half below is historical.

## Context & Decision

Originally `siz add <pkg>` **favorited** a package and `siz rm <pkg>` **removed a favorite** — neither touched `package.json`. That made favorites the "front door" of the Organize track, but it clashed with the muscle memory every npm user brings: in npm/pnpm/yarn/bun and in [`ni`](https://github.com/antfu-collective/ni) (which siz cites as an inspiration), `add` **installs** and `remove`/`rm` **uninstalls**.

We chose to **realign the verbs with that convention**: `siz add <pkg>` now installs into the current project (delegating to the detected package manager) and `siz rm <pkg>` uninstalls. Favoriting — still a first-class Organize feature — moves behind a **`--fav` flag** on both commands (`siz add react --fav`, `siz rm react --fav`). `add` becomes a three-way, mutually-exclusive multiplexer: default **install**, `--fav` **favorite**, `--bundle <name>` **record into a bundle**.

This is a **breaking change** to the two most prominent commands.

## Considered options (and why the chosen path)

- **Remap `add`/`rm` vs. keep them for favorites and add new install verbs (`siz i` / `siz un`).** Keeping favorites on `add`/`rm` would be non-breaking, but it permanently cedes the most intuitive verbs to a niche feature and makes install — the thing users reach for most — the awkwardly-named one. We took the one-time break while the CLI is pre-1.0 and few users are affected, rather than carry the mismatch forever.
- **`--fav` flag vs. a `fav` subcommand.** A flag keeps `add`/`rm` as the single entry points and is symmetric with the existing `--bundle` flag; it also reads as "add, but to favorites." A `fav` subcommand was cleaner in isolation but multiplied the command surface.
- **ni-style detect-and-run vs. full interactive parity.** The interactive **Install** action (arrived at via search) prompts for a package manager and a confirm. A direct `siz add react` is a different context — the user already committed by typing it — so it silently detects the PM and runs, echoing the command, with a workspace picker only when a monorepo makes the target genuinely ambiguous. (A non-interactive `--yes` for scripts is planned separately.)
- **Guardrail on `add`, not on `rm`.** Install is now a package **entering the project**, so the dependency-rules guardrail applies to it (and it gains `--no-rules`), extending ADR 0001's "rules gate what you add" to a third install path. Uninstall never adds a package, so it is not gated.
- **Uninstall orthogonal to favorites.** `siz rm react` uninstalls but does **not** remove the favorite; `siz rm react --fav` removes the favorite but does not uninstall. Coupling them would make `--fav` half-redundant and blur two concepts the glossary keeps separate.
- **Version specifiers pass through.** `siz add react@18` / `@scope/pkg@1.2.3` flow verbatim to the PM; a scope-aware `parseSpec` splits the bare name for name-keyed logic (rules, favorites, bundles). A bundle entry with an explicit `@version` is pinned `exact`; a favorite drops the version (favorites track the name only).

## Consequences

- The verb remap is hard to reverse once users relearn it — that, plus its surprise value ("why does `add` install when favorites was the front door?"), is why it is recorded here.
- No PM-level uninstall builder existed; `buildRemoveCommand` (via `resolveCommand(agent, 'uninstall', …)`) is the only net-new primitive. Installs reuse the existing interactive Install machinery through a shared `install-runner`.
- Scripts and docs that assumed `siz add` = favorite must add `--fav`. Announced via a `minor` changeset (pre-1.0 breaking-change convention).
