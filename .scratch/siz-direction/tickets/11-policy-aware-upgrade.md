# 11 — Should upgrading be policy-aware?

Labels: `wayfinder:prototype`
Status: open
Claimed by: —
Blocked by: 05, 06

## Question

`ncu` and `taze` compare version numbers. Nothing tells you that the upgrade you are about to accept introduces a package that just got deprecated, changed its license, or tripled in install size. That gap is where Manage and Govern meet, and it may be the most immediately useful thing on this map — it pays off on every upgrade rather than only at install.

- Does the upgrade list annotate, warn, or refuse? Refusing means a policy can block a security patch; annotating means people click past it.
- Does `siz outdated` carry the same annotation, and does it affect its exit code?
- What does a row look like when the *current* version is fine and the *target* violates policy? Versus when both violate?
- **A hard constraint in the existing code.** `core/packument.ts` fetches `registry.npmjs.org/<pkg>/latest`, so siz has facts for the **latest** version only. Judging an arbitrary upgrade target needs per-version manifests — `name@version` keys against `/<pkg>/<version>` — which is a different fetch shape, a different cache key, and a second invalidation story. Verify this still holds, then decide: does it kill the feature, restrict it to latest-only upgrades, or justify the extra fetching?
- **This ticket owns that decision for a second consumer.** Ticket 02's research found that any registry-sourced transitive audit needs the same version-keyed layer, and ticket 17 is blocked on this answer. So the version-keyed-facts call is worth more than it looks: it is not just about annotating upgrade rows. Weigh it as an architectural decision with two dependents, and note that `name@version` is immutable and therefore cacheable forever (unlike `/latest`), which cuts the other way and makes the version-keyed layer the *more* cacheable of the two.
- If facts for the target cannot be fetched, does the upgrade proceed silently?

## What would resolve this

A prototype of the annotated upgrade and outdated rows for the cases above, reacted to and iterated — ending in a decision on annotate-versus-block, whether `outdated` participates, and an explicit answer to the per-version-facts constraint (including "defer until the fetch layer supports it", which is a legitimate outcome).
