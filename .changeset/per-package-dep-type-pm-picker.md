---
"@sakana-y/siz": patch
---

Interactive install now supports marking each package as a dependency or devDependency individually (Ctrl+T in the search box, shown with a [dep]/[dev] badge), and lets you choose the package manager (npm/pnpm/yarn/bun/deno) at install time instead of always using the detected one. Mixed selections install as separate `add` / `add -D` commands.
