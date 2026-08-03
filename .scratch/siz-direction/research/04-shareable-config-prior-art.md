# 04 — Shareable / extendable config: prior art

Research findings for ticket `04-shareable-config-prior-art`. Date of research: 2026-08-02.
All claims below are sourced to primary material (official docs, RFCs, release notes, incident postmortems, issue trackers of the owning projects). Secondary write-ups are used only where noted and only for incident chronology.

Vocabulary follows `CONTEXT.md`: **dependency rule**, **guardrail**, **audit**, **allow/deny**, **`siz.config.json`**.

---

## 0. Bottom line up front

Every mature `extends` mechanism has converged on the same four answers, and they are not the answers a naive implementation reaches for:

1. **Resolve relative to the file that wrote the reference**, never to the project root, never to cwd.
2. **Later wins; the extending file wins over everything it extends.**
3. **Arrays replace, they do not append** — in ESLint (legacy), TypeScript, and Prettier alike. The one project that appends (Renovate, for `packageRules`) is also the project whose merge semantics are the most complained-about.
4. **The trust model is: fully trusted, no sandbox, no verification.** Both large npm incidents in the ESLint/Prettier ecosystem (2018, 2025) landed via exactly this channel.

The JSON-only constraint is *survivable* — tsconfig proves a purely declarative JSON `extends` works at scale — but note that **Prettier explicitly does not** offer JSON-level extends, and **ESLint's flat config abolished string-based extends entirely** before partially reintroducing it in a JS-only form. Details and citations below.

---

## 1. ESLint: the canonical case, and the answer it changed

### 1.1 What eslintrc's `extends` actually did

Legacy `.eslintrc` `extends` accepted five kinds of string ([ESLint v8 configuration-files docs](https://eslint.org/docs/v8.x/use/configure/configuration-files)):

| Value | Example |
|---|---|
| Built-in set | `"eslint:recommended"`, `"eslint:all"` |
| Shareable config package | `"airbnb"` → `eslint-config-airbnb` (prefix omittable) |
| Plugin-provided config | `"plugin:react/recommended"` |
| Path to a config file | `"./node_modules/coding-standard/.eslintrc-es6"` |

The resolution rule was actually the *good* part, and is the rule siz should copy:

> "Relative paths and shareable config names in an `extends` property are resolved from the location of the config file where they appear."
> — [ESLint v8 docs](https://eslint.org/docs/v8.x/use/configure/configuration-files)

Resolution is recursive: a base config may itself have `extends`.

### 1.2 What went wrong

The [flat config RFC (`2019-config-simplification`)](https://github.com/eslint/rfcs/blob/main/designs/2019-config-simplification/README.md) is explicit that the problem was **too many overlapping mechanisms**, not `extends` alone. It enumerates the four sources of complexity verbatim:

1. "Resolution behavior of modules (`plugins`, `parser`, `extends`)"
2. "Merging of cascading config files in a directory structure"
3. "Merging of config files via `extends`"
4. "Overriding of configuration via `overrides`"

The RFC's diagnosis of the root cause is the sentence most worth internalising for siz:

> These complexities "arise from `.eslintrc` format of describing **what** should happen rather than **how** it should happen" … "trying to anticipate how users want things to happen and guessing wrong has led to increased complexity."

And the cost of being stuck:

> "Any changes made to any part of `.eslintrc` processing end up affecting millions of ESLint installations, so we have ended up stuck."

The **asymmetry** was the specific killer bug. `extends` resolved from the *config file's* location, but `plugins` resolved from the *end user's project*. A shareable config could therefore not reliably ship its own plugins — hence `eslint-config-airbnb` making users install `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, and `eslint-plugin-react-hooks` by hand. This is [eslint/eslint#3458 "Support having plugins as dependencies in shareable config"](https://github.com/eslint/eslint/issues/3458) and [eslint/eslint#2518](https://github.com/eslint/eslint/issues/2518), open for years. The RFC records the workaround shareable configs were forced into: declare plugins as peer dependencies and either script the install or "ask the user to install them manually."

### 1.3 What flat config does differently

From the RFC and the [migration guide](https://eslint.org/docs/latest/use/configure/migration-guide):

- **Resolution is delegated to the host language.** String module names become direct object references. "It uses the builtin Node.js module resolution system … There is never a question of where the modules will be resolved from." `--resolve-plugins-relative-to` and `--rulesdir` were deleted.
- **`extends`, `overrides`, `env`, `root` all became invalid keys.** Extending means putting configs in an array: "Configs that come later in the array are merged with configs that come earlier in the array."
- **Cascading eliminated.** "Flat config files act as if `root: true` is set." One file governs the project; no automatic merging of files up the tree.
- **Namespace ownership inverted.** Under eslintrc, the plugin package name determined the rule prefix; under flat config, "it is the `plugins` that assigns the name `react`" — the *consumer* names it. Duplicate namespaces pointing at different rule objects throw.

The RFC is honest about the costs it accepted: naming conventions can no longer be enforced, `--print-config` loses usefulness because configs are no longer serializable, and config *authoring* gets harder. Serialization loss also complicates parallel linting and caching.

### 1.4 …and then `extends` came back (partially)

Notable for siz: ESLint did not stay at "no extends." The current [configuration-files docs](https://eslint.org/docs/latest/use/configure/configuration-files) document an `extends` key again, available through `defineConfig` / `@eslint/config-helpers`. It accepts:

- "a string that specifies the name of a configuration in a plugin" (`pluginName/configName`, and "The plugin must be specified in the `plugins` key first")
- a configuration object
- a configuration array

So the string form survives **only as a reference into an already-imported plugin object** — the string never triggers filesystem resolution. That is the design compromise: keep the ergonomics of a name, remove the resolution ambiguity. The docs also carry a warning directly relevant to siz's allow/deny lists:

> "It's recommended to always use a `files` key when you use the `extends` key to ensure that your configuration applies to the correct files."

i.e. an extended config with no scope silently applies to everything. The analogous siz footgun is an extended policy pack whose `deny` list applies to a broader surface than the consumer expected.

---

## 2. Resolution, and what pnpm breaks

### 2.1 The three candidate rules

| Rule | Who uses it | Failure mode |
|---|---|---|
| Resolve from the **referencing config's own location** | eslintrc `extends`, tsconfig `extends` | none serious — this is the correct answer |
| Resolve from the **project root / end-user's `node_modules`** | eslintrc `plugins` | breaks transitive configs under strict layouts |
| Resolve from **cwd** | ESLint globs when `--config` is passed | surprising; ESLint documents the inconsistency rather than fixing it |

TypeScript's statement of the rule is the crispest available, and it is stated twice on the [TSConfig reference](https://www.typescriptlang.org/tsconfig/) for emphasis:

> "All relative paths found in the configuration file will be resolved relative to the configuration file they originated in."

So `"outDir": "./dist"` written inside `configs/base.json` resolves against `configs/`, **not** against the inheriting `tsconfig.json`. For siz this maps directly onto: a glob or a path written in a policy pack means what the pack author meant, wherever the pack is consumed from.

### 2.2 What pnpm's layout breaks

[pnpm's motivation doc](https://pnpm.io/motivation) states the layout:

> "pnpm uses symlinks to add only the direct dependencies of the project into the root of the modules directory."

Transitive packages live under `node_modules/.pnpm/<name>@<version>/node_modules/<name>` and are reachable only from the package that declared them. Contrast with npm/Yarn Classic where "all packages are hoisted to the root of the modules directory," with the consequence that "source code has access to dependencies that are not added as dependencies to the project."

**Consequence for extends:** a resolution rule of "resolve from the project root" works by accident under a hoisted layout and fails hard under pnpm. This is precisely the ESLint plugin bug: the classic symptom is `Cannot find module 'eslint-plugin-x'` thrown during plugin loading, and the ecosystem's workarounds are all bad ones — `public-hoist-pattern[]=*eslint*` in `.npmrc` (which reintroduces the fragility pnpm exists to remove), [`@rushstack/eslint-patch`](https://github.com/relekang/setup-eslint-config) (monkey-patching the resolver), or `strict-peer-dependencies=false` (which hides the install-time warning without fixing the runtime failure). Yarn PnP breaks the hoisting assumption too.

**Rule for siz:** if `siz.config.json` may `extends` an npm package, resolution must start from the directory containing the config file that wrote the reference and walk up from there — i.e. `createRequire(configPath).resolve(...)` semantics, not `require.resolve` from `process.cwd()`. Given siz's config is found by `findUp` from cwd (`src/core/rules.ts:105`), the config path is already in hand (`LoadedRules.path`), so the correct base directory is available for free.

### 2.3 Bare specifiers are underspecified even in TypeScript

The TSConfig reference says only that "The path may use Node.js style resolution," which is what makes `"extends": "@tsconfig/node20/tsconfig.json"` work. But [microsoft/TypeScript#63109 "Clarify tsconfig extends resolution"](https://github.com/microsoft/TypeScript/issues/63109) (open, labelled Docs) argues this is genuinely underspecified, listing divergences from Node: TypeScript normalizes backslash separators inside specifiers and Node does not; Node accepts `node:`, `data:`, `file://` protocols that `extends` does not; "Node has file extension restrictions, tsconfig has not." The issue also reports secondhand that a TypeScript team member acknowledged the `extends` documentation is outdated.

There is also a silent behavioral break on record: a commenter on [microsoft/TypeScript#50403](https://github.com/microsoft/TypeScript/pull/50403) observed that `typescript@4.9.5` "was not restricted by the `exports` from the `package.json` file. It is now with `@typescript@5.0.3`" — i.e. tightening package `exports` enforcement changed which shared configs resolved, across a major.

**Takeaway:** "just use Node resolution" is not a free lunch. It imports the whole `exports`/`imports`/conditions surface as a compatibility obligation. The TypeScript team, with vastly more resources than siz, has an open docs issue admitting they cannot cleanly state their own rule.

---

## 3. Precedence and merging — especially arrays

### 3.1 What each tool chose

**TypeScript** ([TSConfig reference](https://www.typescriptlang.org/tsconfig/), [TS 5.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)):

- "The configuration from the base file are loaded first, then overridden by those in the inheriting config file."
- Arrays **overwrite wholesale**: "`files`, `include`, and `exclude` from the inheriting config file *overwrite* those from the base config file."
- `references` is excluded from inheritance entirely — "the only top-level property that is excluded from inheritance."
- Circularity is disallowed.
- Since 5.0, `extends` may be an array. Precedence: "Writing this is kind of like extending `c` directly, where `c` extends `b`, and `b` extends `a`. If any fields 'conflict', the latter entry wins." Non-conflicting keys merge.
- The docs' own worked example puts the *local* base **last** so it beats the shared strict preset — meaning users must understand "later = stronger" to order their list correctly.

**ESLint (legacy)** — three distinct behaviors for the *same* key, `rules`, which is the clearest cautionary tale in this whole document ([v8 docs](https://eslint.org/docs/v8.x/use/configure/configuration-files)):

1. Adding a rule absent from the base: additive.
2. Bare severity string over an array: **severity is swapped, inherited options survive.** Base `["error", "allow-null"]` + derived `"warn"` → `["warn", "allow-null"]`.
3. Writing an array: **full replacement.** Base `["error", "single", "avoid-escape"]` + derived `["error", "single"]` → `["error", "single"]`; `avoid-escape` is silently gone.
4. Option objects **do not deep-merge**, which the docs flag as the most common surprise: base `{ max: 200, skipBlankLines: true, skipComments: true }` overridden by `{ max: 100 }` yields only `{ max: 100 }`, with both `skip*` flags reverting to `false` — not to the inherited `true`.

Three rules for one key. Users get (3) and (4) wrong constantly, because both are *silent* — nothing errors, the config just quietly means something narrower than intended.

**ESLint (flat)**: "with later objects overriding previous objects when there is a conflict," but merging is per-property, so a `**/*.js` object contributing one global plus a `tests/**` object contributing two yields all three inside `tests`. Arrays-of-configs replaced arrays-as-values as the composition primitive.

**Renovate** — the closest structural analogue to siz (JSON-only policy data, `extends` array): the [config-presets docs](https://docs.renovatebot.com/config-presets/) show presets listed in order and state "Presets can be nested," but **the page does not specify merge semantics at all**, and does not say how `packageRules` arrays combine. That silence is itself a finding: the project with the most siz-like config shape has not managed to write down its own merge rule on the page users are pointed at.

**Prettier**: no merge semantics to specify, because there is no declarative extends (§5).

### 3.2 What users get wrong

The consistent pattern across all of the above:

- **Silent narrowing.** Replacement semantics mean a consumer who writes `"deny": ["lodash"]` to add one entry silently discards the pack's entire deny list. Nothing errors. The policy is now weaker than the team believes it is, which for a *guardrail* is the dangerous direction — the same argument ADR 0001 already used to justify fail-closed parsing of malformed configs.
- **Ordering confusion.** "Later wins" is only obvious once you've been bitten. TypeScript's own docs example exists specifically to teach people to put their local base last.
- **Asymmetric expectations for allow vs deny.** For siz this is sharper than for any tool surveyed. `deny` and `allow` want *opposite* defaults under an inheritance model:
  - `deny` naturally wants **union/append** — a pack denies `lodash`, the project additionally denies `moment`; nobody sane means "replace".
  - `allow` naturally wants **intersection** — a pack allowlists `@ourorg/*`, and a project *widening* it to also permit `react` is a policy weakening that arguably ought to require an explicit gesture.
  Neither is what "replace" gives, and they are not the same rule, so a single uniform array-merge policy will be wrong for one of the two lists. This is the merge decision siz actually has to make, and it does not have prior art to copy because no surveyed tool has a two-list allow/deny predicate under inheritance.

---

## 4. Security and trust

### 4.1 The stated trust model: there isn't one

None of ESLint, Prettier, or TypeScript sandboxes, verifies, or pins an extended config. Extending is `require`/`import` (ESLint flat, Prettier) or filesystem read of a package's file (tsconfig), and the package arrives through the ordinary npm dependency graph with ordinary lifecycle scripts. The [ESLint 2018 postmortem](https://eslint.org/blog/2018/07/postmortem-for-malicious-package-publishes/) "contains no explicit discussion of a trust model for shareable configs" — the guidance is entirely operational (2FA, no password reuse, limit publishers, lockfiles, be careful with auto-merging dependency-upgrade bots).

### 4.2 Incident 1 — eslint-scope / eslint-config-eslint, July 2018

From the [ESLint postmortem](https://eslint.org/blog/2018/07/postmortem-for-malicious-package-publishes/):

- Packages: `eslint-scope@3.7.2` and **`eslint-config-eslint@5.0.2`** — note the second is literally a shareable config package.
- Payload: a `postinstall` script that "downloaded and executed code from `pastebin.com` which sent the contents of the user's `.npmrc` file to the attacker" — i.e. harvesting npm publish tokens to propagate.
- Root cause: maintainer account takeover via credential stuffing. The maintainer "had reused their npm password on several other sites and did not have two-factor authentication enabled."
- Timeline (UTC, 2018-07-12): 09:49 config published → 10:40 eslint-scope published → 11:17 user files the issue → 12:37 npm unpublishes → 18:42 npm revokes all tokens issued before 12:30.

### 4.3 Incident 2 — eslint-config-prettier, July 2025

Reported by the maintainer and multiple vendors; tracked as CVE-2025-54313. Chronology per [Socket](https://socket.dev/blog/npm-phishing-campaign-leads-to-prettier-tooling-packages-compromise) and [StepSecurity](https://www.stepsecurity.io/blog/supply-chain-security-alert-eslint-config-prettier-package-shows-signs-of-compromise):

- Vector: phishing email impersonating npm support, linking the lookalike domain `npnjs.com`; the maintainer entered credentials, surrendering an npm token.
- Malicious versions of `eslint-config-prettier` (8.10.1, 9.1.1, 10.1.6, 10.1.7) plus `eslint-plugin-prettier`, `synckit`, `@pkgr/core`, `napi-postinstall`. Combined ~78M weekly downloads.
- Payload: an `install.js` plus `node-gyp.dll`, executing a DLL on Windows via `rundll32`. Socket's summary: "The attacker published malicious versions with no corresponding commits or PRs on GitHub."
- Window: first malicious publish 15:51 GMT, all removed by 18:40 GMT — under three hours. Yet Dependabot/Renovate auto-picking `latest` meant CI pipelines ingested it inside that window.

**The load-bearing observation:** the single most-downloaded *shareable config* package in the JavaScript ecosystem has been compromised, twice-over in family, in exactly the way the extends channel invites. And in both cases the payload rode the **package install** (`postinstall` / `install.js`), not the config parse. That distinction matters enormously for siz's JSON-only stance and is developed in §5.3.

### 4.4 Renovate's approach: pinning and locality

Renovate is the only surveyed tool whose docs offer trust affordances for presets ([config-presets](https://docs.renovatebot.com/config-presets/)):

- Git-tag pinning: `github>abc/foo:xyz#1.2.3` — "use a specific release of your shared config" rather than tracking a moving default branch.
- Unpinned references follow the preset repo's **default branch**, so upstream edits apply automatically and silently. (Worse than npm semver: no version at all.)
- `local>` keeps resolution inside your own infrastructure.
- HTTP presets are fetched from arbitrary URLs, "so trust in that server is implied."
- Renovate is **deprecating npm-hosted presets**: the docs warn it plans "to drop the npm-based presets feature in a future major release" and recommends a `local` preset instead.

That last point deserves weight. The project whose config is most like siz's, having run an npm-hosted shareable-config mechanism in production for years, is **removing it**.

---

## 5. The JSON-only constraint

### 5.1 Does declarative JSON `extends` work at all?

**Yes — tsconfig is the existence proof.** `tsconfig.json` is JSON(C), has no code execution, supports `extends` by relative path and by bare package specifier, supports arrays of extends since 5.0, supports chained inheritance, and the [tsconfig/bases](https://github.com/tsconfig/bases) repo publishes shared bases (`@tsconfig/strictest` et al.) to npm that are consumed purely declaratively. That is the whole design siz would be copying, and it demonstrably works.

The price tsconfig pays is visible in §2.3 and §3.1: an underspecified resolution rule it has an open docs issue about, and a wholesale-replace array rule that surprises people.

### 5.2 Prettier chose the opposite, deliberately

Prettier's [Sharing configurations](https://prettier.io/docs/sharing-configurations) doc is unambiguous. A shareable config is "just npm packages that export a single prettier config file" — an `index.js` doing `export default config`. Consumption is either `"prettier": "@username/prettier-config"` in `package.json`, or a `.prettierrc` containing the bare package-name string.

But there is **no `extends` key anywhere in Prettier's JSON config**. `.prettierrc` can only name a package *wholesale*; it cannot extend-and-override. To override, the docs require a JS file:

> to "*extend* the configuration to overwrite some properties from the shared configuration, import the file in a `prettier.config.mjs` file and export the modifications"

```js
import usernamePrettierConfig from "@username/prettier-config";
const config = { ...usernamePrettierConfig, semi: false };
export default config;
```

So: **the mechanism is ES-module import plus object spread — not a declarative `extends` field.** Prettier's [configuration doc](https://prettier.io/docs/configuration) also records the philosophy behind its resolution: it "intentionally doesn't support any kind of global configuration," so that copying a project elsewhere preserves identical behavior. Config lookup walks up from the file being formatted.

The lesson for siz: Prettier has a small, flat, closed option set — precisely the case where a declarative merge would be *easiest* — and it still declined to build one, preferring to make users reach for JS. Prettier's option set is much simpler than siz's would become once policy predicates go beyond name globs.

### 5.3 The JSON constraint's real security value is smaller than it looks

ADR 0001 justified JSON over TS as keeping the file "pure declarative data with no code execution — important for a file that CI reads." That reasoning holds for the *config file*, and is correct.

But it does **not** survive contact with npm-hosted extends. Both incidents in §4 executed at **install** time (`postinstall`, `install.js`), not at config-parse time. If `siz.config.json` can `extends: "@ourorg/siz-policy"`, then that package must be in the consumer's `node_modules`, which means it went through `npm install`, which means its lifecycle scripts ran. **The JSON-only property protects the parse and buys nothing at all against the actual observed attack.** Any claim that a JSON-only extends is "safe because there's no code execution" would be false in the way that matters.

There is a genuinely code-free option: **do not resolve from npm.** Renovate's `local>` and `http(s)://` prefixes, and tsconfig's relative-path form, both fetch config *data* without installing a *package*. A relative-path-only extends (`"extends": "./policies/base.json"`, or a path into a repo checkout) never runs anyone's install script and is the only variant where the JSON-only argument fully holds.

---

## 6. Minimum viable JSON-only `extends` for siz

Given siz's config is loaded by `loadRules()` in `src/core/rules.ts` (nearest `siz.config.json` via `findUp` from cwd, returning `{ rules, path }`), the smallest defensible design:

### 6.1 Schema

```jsonc
{
  "$schema": "...",
  "extends": "./policies/base.json",        // string, or array of strings
  "rules": { "allow": [], "deny": [] }
}
```

`extends` is a string **or an array of strings**. Adopt the array form from day one — TypeScript shipped single-string in 2.1 and did not get arrays until 5.0, and the intervening decade of "chain a base config just to combine two presets" (documented as the motivating problem in the [TS 5.0 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)) is avoidable pain.

### 6.2 Resolution rule

> **Every `extends` entry resolves relative to the directory of the config file in which it is written.** Not the project root, not `process.cwd()`.

Concretely:
- `"./x.json"`, `"../x.json"` — path relative to `dirname(configPath)`. Require the `.json` extension (do not copy tsconfig's optional-extension convenience; it is one more resolution branch to specify forever).
- Bare specifier `"@ourorg/siz-policy"` — resolve with `createRequire(configPath)` semantics, so pnpm's strict layout works and the pack's own transitive extends resolve from *its* location. **If v1 ships without npm-hosted packs (see §6.6), reject bare specifiers with a clear error rather than leaving the syntax undefined.**
- Chained: an extended file's own `extends` resolves from *its* directory, recursively. Follows [ESLint v8's rule](https://eslint.org/docs/v8.x/use/configure/configuration-files) verbatim, which is the rule that always worked.
- **Detect and error on cycles**, as tsconfig does ("Circularity between configuration files is not allowed").
- The existing cascade behavior is unchanged: siz still finds one config by walking up, and that single file governs the repo (per `CONTEXT.md`). `extends` composes *within* that file; it does not reintroduce directory cascading. This is flat config's `root: true` lesson — do not have two composition mechanisms.

### 6.3 Merge semantics for lists

Resolve the whole chain left-to-right into a single effective rule set; the extending file is applied last.

For the two arrays, **do not use one uniform rule** — the asymmetry in §3.2 is real:

| List | Semantics | Rationale |
|---|---|---|
| `deny` | **Union (append), always** | Deny-wins is already siz's core predicate (ADR 0001). A silent shrink of the deny list is a silent policy weakening — the fail-open direction ADR 0001 explicitly rejected. Nobody extends a policy pack in order to *un*-deny something implicitly. |
| `allow` | **Replace** (extending file wins if it declares `allow` at all; otherwise inherited) | `allow` is mode-selecting: empty means denylist mode, non-empty means allowlist mode. Unioning allow lists silently *widens* permission, and cannot express "narrow the pack's allowlist." Replace keeps the local file's stated allowlist meaning exactly what it says. |

Un-denying must be **explicit**, not a side effect of writing an array. The minimum affordance is a subtractive key, e.g. `"rules": { "unDeny": ["lodash"] }` applied after the union — a deliberate, greppable, reviewable gesture. (ESLint reached the same place from the other side: it lets a derived config write `"off"` to explicitly disable an inherited rule.)

Document both rules in one table, in the README and in `siz.config.json`'s schema description. ESLint's three-behaviors-for-one-key is the anti-pattern; two clearly-stated rules for two clearly-different lists is acceptable, three implicit ones for one key is not.

### 6.4 Override direction

**Later wins; the extending file wins over everything it extends.** Unanimous across TypeScript ("the latter entry wins"), ESLint flat ("later objects overriding previous objects"), and eslintrc. There is no reason to be original here.

For `["a", "b"]`: `a` then `b` then the local file. Document this with a worked example placing the *local* base last, exactly as the TS 5.0 notes do — it is the single most misordered thing in the prior art.

### 6.5 Trust affordances, minimum

- **Print the provenance.** Whenever rules come from anywhere other than the local file, the guardrail's blocked-notice and any future `siz check` output must name the origin file/package — the existing `LoadedRules.path` field already exists for exactly this messaging, so extend it into a chain.
- **A `--print-config`-equivalent from day one.** Because JSON stays serializable, siz can emit the fully-resolved effective rule set. This is the affordance flat config *lost* and regretted ("`--print-config` loses usefulness since configs aren't serializable"). It is the single cheapest thing that makes inheritance debuggable, and JSON-only is what makes it possible. Ship it in the same release as `extends`, not later.
- **Keep fail-closed.** A malformed *or unresolvable* extends entry must abort, per ADR 0001's reasoning. An unresolvable pack that degrades to "no rules" is the exact failure ADR 0001 designed against.

### 6.6 Scope the v1 to relative paths only

The defensible v1 is **relative-path extends only** — no npm packages, no URLs. It delivers the monorepo case (one `policies/base.json`, per-package configs extending it), needs no resolution algorithm beyond `path.resolve`, is immune to §4's attack class entirely (§5.3), and is forward-compatible: adding bare-specifier support later is additive, whereas removing it is breaking.

Note what this costs: **the network effect the ticket is interested in — "one org writes a policy, every repo inherits it" — is exactly the part relative paths do not deliver.** A relative-path v1 is a deliberate decision to ship the composition mechanism and defer the distribution mechanism. That is a coherent position (it lets siz learn the merge semantics on low-stakes in-repo usage before they become an npm-wide contract), but it should be taken knowingly, not by accident. If the network effect is the actual goal, the honest options are npm-hosted packs *with* the §4 exposure accepted and documented, or Renovate-style `github>`/`http(s)://` fetching of config data with pinning — which avoids install scripts but adds a network dependency, a cache, and an offline story to a tool that currently reads one local file.

---

## 7. What adopting `extends` commits siz to, forever

Stated plainly, because the ticket asks for it and because ADR 0001 already records that `siz.config.json`'s shape "become[s] a contract with user repos."

1. **The resolution rule is permanent.** Once one repo has `"extends": "./x.json"` working, the base directory that path resolves against can never change. TypeScript could not even *document* its own rule without an open issue (§2.3); ESLint changed its answer and needed a compatibility shim (`@eslint/eslintrc`'s `FlatCompat`) plus a three-major-release rollout to do it.
2. **The merge semantics are permanent, and silent when wrong.** A user whose `deny` list quietly stopped applying does not file a bug — they ship a denied package. There is no error to observe. Any later change to append-vs-replace changes the meaning of already-committed policies without changing their text. This is the sharpest instance of the RFC's warning about "describing what should happen rather than how."
3. **A resolver is now a maintained subsystem.** Cycle detection, missing-file errors, malformed-link errors, symlink and Windows path handling (siz's users are on Windows; `CONTEXT.md`/`paths.ts` already distinguishes `%APPDATA%` from `~/.config`), and — if bare specifiers are ever allowed — the whole `exports`/conditions surface plus pnpm, Yarn PnP, and Deno layouts. TypeScript shipped a silent break here across a major (§2.3).
4. **`--print-config` becomes non-optional.** The moment rules come from more than one file, "why was this package blocked?" is unanswerable without a resolved-config dump. That is a permanent output surface with its own format compatibility.
5. **Diagnostics get harder everywhere else.** Every blocked-install message, every future `siz check` finding, and every error message must now name *which* file in the chain is responsible. The single `LoadedRules.path` field becomes a chain everywhere it is threaded.
6. **Every future policy key inherits a merge decision.** The v1 has two lists. A license predicate, an install-size ceiling, a staleness threshold, a provenance requirement — each new key needs its own documented merge rule at the moment it is added, forever, and each is a chance to be inconsistent. The MAP's "Not yet specified" section lists project-level budgets and a vulnerability predicate as fog; both would arrive needing merge semantics.
7. **If npm-hosted packs are ever allowed, siz has taken on a supply-chain position.** It would be telling teams to trust a third party with their dependency policy — while being a tool whose own pitch is fetching trust signals about third-party packages. Renovate, having run that mechanism for years, is deprecating it (§4.4). At minimum siz would owe users pinning guidance and provenance output; the tension between "siz reports provenance about your dependencies" and "siz's own policy arrives via an unpinned npm package" is not resolvable by documentation alone.
8. **This is the surface with the most third-party breakage risk per line of code.** Every point above is a compatibility obligation that outlives the feature's usefulness, in a project that today has ~200 downloads/month and no distribution attempt (per the MAP). The prior art's own conclusion is that this mechanism cost ESLint a multi-year, three-major-release migration and cost TypeScript a decade of single-string `extends`. Neither could reverse the decision cheaply.

---

## Sources

Primary:
- [ESLint RFC — Config File Simplification (`2019-config-simplification`)](https://github.com/eslint/rfcs/blob/main/designs/2019-config-simplification/README.md)
- [ESLint — Configuration Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [ESLint — Configuration Files (current, incl. `extends` via `defineConfig`)](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint v8 — Configuration Files (legacy eslintrc `extends`, resolution, merge rules)](https://eslint.org/docs/v8.x/use/configure/configuration-files)
- [ESLint — Postmortem for Malicious Packages Published on July 12th, 2018](https://eslint.org/blog/2018/07/postmortem-for-malicious-package-publishes/)
- [eslint/eslint#3458 — Support having plugins as dependencies in shareable config](https://github.com/eslint/eslint/issues/3458)
- [eslint/eslint#2518 — Shareable configs with plugin dependencies don't work as expected](https://github.com/eslint/eslint/issues/2518)
- [TypeScript — TSConfig Reference (`extends`)](https://www.typescriptlang.org/tsconfig/)
- [TypeScript 5.0 Release Notes — Supporting Multiple Configuration Files in `extends`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)
- [microsoft/TypeScript#50403 — implementation PR for array `extends`](https://github.com/microsoft/TypeScript/pull/50403)
- [microsoft/TypeScript#63109 — Clarify tsconfig extends resolution (open)](https://github.com/microsoft/TypeScript/issues/63109)
- [Prettier — Sharing configurations](https://prettier.io/docs/sharing-configurations)
- [Prettier — Configuration File](https://prettier.io/docs/configuration)
- [Renovate — Shareable Config Presets](https://docs.renovatebot.com/config-presets/)
- [pnpm — Motivation (node_modules layout)](https://pnpm.io/motivation)
- [tsconfig/bases — shared tsconfig packages on npm](https://github.com/tsconfig/bases)

Incident chronology for the 2025 compromise (vendor reporting; no first-party postmortem published by the maintainer beyond the acknowledgement tweet):
- [Socket — npm phishing campaign leads to Prettier tooling packages compromise](https://socket.dev/blog/npm-phishing-campaign-leads-to-prettier-tooling-packages-compromise)
- [StepSecurity — eslint-config-prettier package shows signs of compromise](https://www.stepsecurity.io/blog/supply-chain-security-alert-eslint-config-prettier-package-shows-signs-of-compromise)

Repo context consulted: `src/core/rules.ts`, `docs/adr/0001-dependency-rules.md`, `CONTEXT.md`, `.scratch/siz-direction/MAP.md`.
Note: `MAP.md` references a `.scratch/dependency-policy/` straw man, which does not exist in the working tree at time of research.
