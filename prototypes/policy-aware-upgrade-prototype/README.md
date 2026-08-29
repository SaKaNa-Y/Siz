# Policy-aware upgrade prototype

Throwaway prototype for **“11 — Should upgrading be policy-aware?”**.

Three deliberately different interaction models share one route through the `?variant=` query parameter:

- `A` — Inline Signals: annotate every target and preserve the current multiselect.
- `B` — Severity Gate: keep permitted targets selectable and move error targets into a blocked section.
- `C` — Evidence Review: inspect one target at a time and require an explicit one-run override.

The prototype covers clean-to-error transitions, current and target violations, accepted baseline debt that is no worse or worse, warnings, unknown target facts, `siz outdated`, and the proposed `name@version` facts contract. Everything is stubbed; it never reads or writes a project manifest and never contacts the registry.

Run it with:

```sh
pnpm prototype:policy-aware-upgrade
```

Then open <http://127.0.0.1:4179/?variant=A&view=upgrade&scenario=mixed>.

This code is intentionally disposable. It must not be promoted directly into the product.
