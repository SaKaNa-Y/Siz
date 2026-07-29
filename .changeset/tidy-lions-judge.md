---
"@sakana-y/siz": patch
---

Add the **license signal** — each search result now shows its declared license inline, so you can judge legal compatibility before installing, not after.

- Shown on **every** row (interactive, `--list`, and a `license` field in `--json`), with the full value on the focused row when a long SPDX expression is clipped.
- Siz **grades nothing**: `MIT` and `GPL-3.0-only` render identically. Whether copyleft is a problem is a fact about your project, not the package.
- A `⚖` glyph marks an **unclear license** — one that can't be resolved from registry metadata at all: none declared, `UNLICENSED`, or `SEE LICENSE IN <file>`. (The SPDX id `Unlicense`, a public-domain dedication, is not flagged.)
- Reads the deprecated license shapes older packages use (`{ "type": "MIT" }`, bare arrays, the legacy top-level `licenses` key), so a plainly-licensed 2013 package isn't misreported as unlicensed.
- **Costs no extra network requests** — the license comes from the same npm packument already fetched for install size, via a new shared packument layer.
- In `--json`, `license` is three-valued and the distinction is deliberate: a **string** when declared, an explicit **`null`** when the package declares none, and **absent** when siz couldn't check. So CI can tell a real finding from a failed lookup — and a slow registry never renders as "no license".
