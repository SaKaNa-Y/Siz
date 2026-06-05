---
"@sakana-y/siz": patch
---

Workspace-aware manifest discovery for `siz upgrade -r` and the install workspace picker. When a workspace is declared — pnpm's `packages:` in `pnpm-workspace.yaml`, or an npm/yarn `workspaces` field (array or `{ packages: [...] }`) — Siz now scans only the declared members (plus the root), instead of every `package.json` under the directory. A stray `package.json` in `examples/`, `fixtures/`, `templates/`, or `docs/` is no longer treated as a workspace member, so it matches what `pnpm`/`npm`/`yarn install` actually link. Negation globs (`!packages/internal/**`) are honored. Repos with no workspace definition keep the previous brute-force behavior, so a plain folder of projects is unaffected.
