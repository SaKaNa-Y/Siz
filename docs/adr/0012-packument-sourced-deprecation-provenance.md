# Deprecation and provenance come from the packument; the hosted aggregator keeps only publish age

## Status

accepted — **partially supersedes ADR 0003**. That ADR routed *all three* trust facts (deprecation, publish date, provenance) plus upgrade resolution and bundle install through `fast-npm-meta`'s hosted endpoint. Deprecation and provenance no longer go there. ADR 0003 stands for what remains: publish age, upgrade version lists, and bundle latest-version resolution.

## Context & Decision

Siz was **buying the same facts twice**. ADR 0008 and ADR 0009 established a per-result packument fetch (`registry.npmjs.org/<pkg>/latest`) behind `core/packument.ts`, read for install size and license. That manifest also carries `deprecated` and `dist.attestations` — yet the deprecation flag and the provenance mark were fetched a *second* time, from the third-party aggregator ADR 0003 introduced. Two providers, one fact each, per package, per search.

We **derive deprecation and provenance from the packument** and consult the metadata batch for **publish age alone** — the one trust fact the version manifest does not carry (`/latest` has no publish time). Three consequences of the shape:

**1. Two sources, parallel and independently degrading.** `fetchTrustSignals()` fires the packument fetch and `getLatestVersionBatch(..., { metadata: true })` together. A dead packument still leaves the age; a dead batch still leaves deprecation and provenance. A name appears in the returned map **iff at least one source resolved** — the same resolved-vs-never-resolved contract ADR 0009 pins for the license, widened to two providers.

**2. `✓` narrows to attestation-only.** Provenance previously meant *either* a signed attestation *or* npm's separate `trustedPublisher` flag, folded together by the aggregator. The packument exposes only the former. Rather than keep a second request alive to recover the second flag, we **narrowed the mark**: `✓` now means "has a provenance attestation" — one fact, from one source, that a user can verify themselves against the registry. Trusted-publisher is publisher *identity*; attestation is build *evidence*. They were never the same claim, and merging them under one glyph was the aggregator's convenience, not a considered decision. Recovering the flag is explicitly out of scope.

**3. The memo holds the in-flight promise, not just the settled value.** Size, license and trust all start in the same tick. A value-only memo has all three miss and fire their own request — precisely the double-buying this layer exists to prevent. Memoizing the promise is what makes "one packument per package per process" true rather than aspirational.

Deprecation still feeds replacement-suggestion parsing per ADR 0005; the message is read off the manifest instead of the aggregator, and nothing downstream changed.

## Considered options (and why the chosen path)

- **Keep both sources and just accept the duplication.** Rejected: it is a per-result request for facts already on the wire, and it makes two more of siz's signals fail when a third-party personal service is down — the exposure ADR 0003 flagged as its own main consequence.
- **Go the other way: drop the packument and take everything from the aggregator.** Tempting for request count (one batch beats N packuments) but impossible — `fast-npm-meta` exposes no `license` (ADR 0009) and no `unpackedSize`, so the packument fetch cannot go away. Given it stays, the aggregator's deprecation and provenance are the redundant half.
- **Use the abbreviated packument** (`registry.npmjs.org/<pkg>` with the `application/vnd.npm.install-v1+json` accept header) instead of `/latest`, to get publish times (`time`) from the same document and retire the aggregator entirely. **Rejected on measurement**: it is roughly **1 MB for `zod`**, versus ~4 kB for `/latest`, and it carries neither `license` nor `deprecated` — so it would be a far larger download that still does not cover the facts siz needs, forcing `/latest` to be fetched anyway. Trading 4 kB for 1 MB per result row to avoid one batched request is a bad trade at any result count.
- **Fetch the full packument** (no accept header) for `time` plus everything else. Rejected for the same reason, more so: larger still, with full dependency maps per version, memoized for the process lifetime.
- **Keep `trustedPublisher` by leaving a reduced aggregator call in place for it.** Rejected: it preserves the request this change exists to remove, in order to keep a flag whose meaning was already conflated with attestation under a single glyph. If publisher identity is worth surfacing later it deserves its own mark and its own decision, not a shared `✓`.
- **Serialize the two sources** (packument first, batch only for names still missing a fact). Rejected: it turns two parallel latencies into a sum, and independent degradation is easier to reason about than a fallback chain.

## Consequences

- **Breaking**: the provenance mark's meaning narrows. A package that was trusted-publisher-only, with no attestation, loses its `✓`. Announced in a `minor` changeset. Provenance remains **positive-only** — absence renders nothing, since adoption is low enough that flagging it would be noise.
- One fewer provider behind two signals. Deprecation, the replacement suggestion, provenance, install size and license now all derive from **one memoized request per package**; among the trust signals only publish age costs a separate (third-party) call.
- `core/packument.ts`'s projection widened to `license` / `licenses`, `deprecated`, `dist.unpackedSize`, `dist.attestations`. It stays a **narrow** projection deliberately: real packuments carry full dependency maps and these are held for the process lifetime.
- The stale (`⚑`) signal is unchanged, and so is its failure mode — a short timeout, no retry, silent absence — because its source did not move.
- ADR 0003's consequence list is now narrower in scope but not weaker: upgrade and bundle install still depend on the hosted service, and still surface failure rather than degrading silently.
- The glossary's **Provenance** entry is narrowed to the attestation, and explicitly names `trustedPublisher` as no longer covered — the drift this ADR is most likely to suffer is someone quietly folding it back in.
