# 06 — What does the audit look like, and when does it fail?

Labels: `wayfinder:prototype`
Status: open
Claimed by: —
Blocked by: 05

## Question

An audit's output *is* its interface: a report nobody can read gets piped to `/dev/null`, and an exit code that fires at the wrong time gets disabled in CI. Both are best judged by looking at something concrete rather than by discussing them.

- What does the terminal output look like for a small clean project, a small failing project, and a legacy repo with 40 findings? The third is the one that decides whether people keep the command.
- How are findings grouped — by manifest, by package, by check, by severity?
- How much does each row show: the fact, the limit, the rule that decided, the origin?
- What is the summary line?
- **When does it exit non-zero?** Errors only, by default, with no flag? Or is failing opt-in the way `siz outdated --exit-code` is? One argument for the asymmetry: outdated dependencies are a normal state of a healthy repo, a policy violation is not — so a report should exit `0` and a gate should not. Worth testing against both outputs side by side rather than accepting on the strength of the sentence.
- What is the JSON shape, and what does a consumer need to tell a real finding from a failed lookup?
- Do the existing result-signal glyphs appear here, or is the audit its own visual language?

## What would resolve this

A rough rendered prototype of the three cases above (a stub is fine — no real fetching needed), reacted to and iterated, ending in an agreed output shape, an agreed JSON contract, and a settled exit-code rule with its rationale. Link the prototype from this ticket rather than pasting it.
