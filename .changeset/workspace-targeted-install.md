---
"@sakana-y/siz": patch
---

Install into a specific workspace from interactive search. When you choose **Install** in a monorepo — where more than one `package.json` exists under the current directory (skipping `node_modules`, `dist`, and `.git`) — Siz now asks which package to install into and runs your package manager in that package's directory, so the dependency lands in the right workspace. Projects with a single `package.json` are unaffected (no extra prompt).
