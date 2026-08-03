# 10 — Is siz allowed to have opinions?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 05

## Question

`CONTEXT.md` is emphatic: every result signal is a fact fetched from a source, never a verdict siz forms. The heuristic category labels were deleted for exactly this reason, and ADR 0005 draws a careful line between the successor a *maintainer* named and a swap *siz* would recommend. Several things on this map walk straight into that rule.

- **Remediation.** When a package fails policy, may siz suggest what to do? Naming the maintainer's stated successor is clearly a fact. A curated "use `dayjs` instead of `moment`" map is clearly an opinion. Is the second one allowed, and if so what makes it different from the deleted category labels?
- **Editorial thresholds.** Siz already ships a "heavy" install-size threshold and a 2-year staleness line — both editorial numbers presented as facts. Is that a precedent that legitimises more, or an inconsistency to be contained?
- **Default policies.** Would siz ever ship a recommended starter policy? That is an opinion in config form — and it is also the difference between a tool you can adopt in a minute and one that requires you to write a policy from scratch first.
- **Project-level budgets.** "Your project has 14 unmaintained dependencies" is a fact; "that is too many" is a judgement. Where does a budget sit, given the user set the number?
- **`--fix`.** Automated remediation is opinion plus action. In or out, permanently or for now?

## Why it is on the route

The answer constrains at least three fog patches (budgets, remediation depth, `--fix`) and it is a **domain rule** question, not a feature question — which is why it belongs on the map rather than in a spec. If the answer is "no opinions, ever", several attractive features die here and the positioning gets sharper for it.

## What would resolve this

A stated rule, general enough to apply to the next feature that tests it, with the existing editorial thresholds either justified or flagged as debt — and a specific verdict on remediation, starter policies, budgets, and `--fix`. Destined for `CONTEXT.md` and probably its own ADR.
