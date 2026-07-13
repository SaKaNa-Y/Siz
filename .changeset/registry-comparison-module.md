---
"@sakana-y/siz": patch
---

Extract a shared registry-comparison core (`core/compare.ts`) that `siz upgrade` and `siz outdated` both specialize over, so the two commands agree on a project's dependency state by construction. Behavior and the public library API are unchanged.
