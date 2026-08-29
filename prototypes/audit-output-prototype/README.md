# Audit output prototype

Throwaway prototype for **“06 — What does the audit look like, and when does it fail?”**.

Three radically different audit interfaces are available on one route through the `?variant=` query parameter:

- `A` — Manifest Ledger
- `B` — Policy Brief
- `C` — Diagnostic Stream

Each variant can render a clean project, a small failing project, a legacy repository with 40 findings, and a total registry outage. Terminal, JSON, and exit-policy views are all stubbed; no registry requests or project files are touched.

Run it with:

```sh
pnpm prototype:audit-output
```

Then open <http://127.0.0.1:4178/?variant=A>.

This code is intentionally disposable. It must not be promoted directly into the product.
