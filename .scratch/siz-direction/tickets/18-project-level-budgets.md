# 18 — Does the policy get project-level budgets?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 07

## Question

Ticket 05 fixed the boundary and excluded budgets from the rule vocabulary; it did not decide whether siz ever grows them. The test 05 established:

> **A rule judges one package in isolation; a budget judges the set.** If evaluating it requires knowing about any package other than the one being judged, it is not a rule.

So: does siz ever express aggregate ceilings — total install size, count of unmaintained dependencies, an allowed licence *mix* — and if so, in what shape?

- Is there a real use for a budget that the per-package rules do not already serve? "No 20MB packages" and "under 300MB total" are different policies; is the second one anybody's actual ask?
- What does a budget violation *say*? A rule violation names a package and a remedy. A budget violation names the project and answers no question about what to remove — which is why 05 kept it off ticket 06's reporting path.
- Budgets are audit-only by construction: "would adding this push us over" needs the whole tree, which destroys the install path's latency. Does an audit-only feature break the dual-mode symmetry ticket 01 identified as siz's actual differentiation, and is that acceptable for one feature?
- If they ship, they get their **own top-level block**, never a key inside `rules` — 05 reserved that space so `rules` stays uniformly per-package with one grammar and one verdict shape. Is that still right, or does a budget want to reuse `severity` / `ignore` / `scope`?
- Nobody sets an aggregate budget from zero; they set it at current-plus-headroom. So a budget is a ratchet by nature. Does ticket 07's baseline mechanism generalise to it, or does a budget need its own?

## Boundary with ticket 10

Ticket 10 asks whether siz is *allowed* to pick numbers — an aggregate ceiling is meaningless until someone chooses one, so 10 governs whether siz may ship a default or a starter budget. **This ticket decides existence and shape**; 10 decides whether siz supplies any opinion inside it. Neither subsumes the other, but 18 should not re-litigate 10's rule.

## What would resolve this

A yes or no, with the shape if yes: the block, the set of budgets, the violation output, the ratchet story, and the release it lands in. "No, and here is the ask we would need to see first" is a fully acceptable outcome and should be recorded as such — the boundary 05 drew is already useful on its own, and the reserved namespace costs nothing to leave empty.

## Provenance

Graduated from the map's **Not yet specified** patch "Project-level budgets" (2026-08-05) once ticket 05 settled the rule vocabulary the patch was waiting on.
