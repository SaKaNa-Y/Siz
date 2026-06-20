# Project-local dependency rules as an install-time guardrail

## Status

accepted

## Context & Decision

We want teams to be able to commit a dependency policy ("we don't use `lodash`", "only `@ourorg/*` is allowed") and have `siz` honor it. We chose to express this as a **dedicated, committable `siz.config.json`** at the repo root holding `allow` / `deny` glob lists over package *names*, enforced as an **action-time guardrail on the install paths only** (the interactive Install action and `bundle install`). A missing config means no rules; a **malformed config fails closed** (siz aborts rather than letting everything through). The rule-evaluation logic is a pure, IO-free core so a future `siz check` audit can reuse it.

## Considered options (and why the chosen path)

- **Dedicated JSON file vs. a `package.json` `"siz"` field.** We picked a dedicated file: rules are *policy*, conceptually separate from the dependency manifest, and keeping them out of `package.json` avoids format-preservation headaches if siz ever writes them back. JSON (not TS) keeps the file pure declarative data with no code execution — important for a file that CI reads.
- **Guardrail vs. audit.** A guardrail blocks *new* packages at install time; an audit reports on packages *already present*. We shipped the guardrail first (smallest thing that delivers "allow/restrict") and deliberately scoped the audit out to a later `siz check`. The split is the mental model: **rules gate what you add; check reports what you have.** This is why favorites, bundle-records, and `upgrade` are *not* gated — they don't add a new dependency to the project.
- **Fail-closed vs. fail-open on a malformed config.** For a guardrail, fail-open is the dangerous direction: a stray comma would silently disable the team's policy. We fail closed (abort with a parse error), matching the existing `pnpm-workspace.yaml` parse-error convention.
- **Deny-wins semantics.** When both lists match a package, `deny` wins, making it a reliable absolute block and keeping the predicate explainable in an error message.

## Consequences

- The decisions above are hard to reverse once teams commit a `siz.config.json`: the file name, location, schema, and fail-closed behavior become a contract with user repos, so changing them later is a breaking change. That is the reason this is recorded.
- Because installs are interactive-only today, true CI enforcement is *not* delivered by the guardrail — it lands with the future `siz check`. The guardrail's non-zero exit on an all-blocked selection is the only CI signal for now.
