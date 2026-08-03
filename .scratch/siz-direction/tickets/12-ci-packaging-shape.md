# 12 — How does the audit get into someone's CI?

Labels: `wayfinder:grilling`
Status: open
Claimed by: —
Blocked by: 06

## Question

CI tools spread by copied workflow files, not by terminal demos. If the govern surface is the spearhead, its distribution channel is a workflow snippet — and that is a design decision, not a marketing afterthought.

- A published GitHub Action, or a documented three-line workflow snippet using the CLI? An Action is discoverable in the marketplace but is a second artifact to version and release.
- If an Action: does it live in this repo or its own, and how does its release ride the existing Changesets pipeline (which currently publishes one npm package)?
- Does it comment on the PR, annotate lines, or just pass/fail? Annotating requires emitting a specific format and knowing file positions.
- What is the recommended failure posture for a first-time adopter — fail the build, or warn only until they have a baseline?
- Does anything need to change in the CLI itself to make CI use pleasant (quieter output when not a TTY, an annotation output mode, a summary format)?
- Are non-GitHub CIs a consideration at all, or is GitHub-only an acceptable v1?

## What would resolve this

A decision on Action-versus-snippet, where it lives and how it releases, the PR-feedback shape, the recommended adopter posture, and any CLI changes CI use requires. If an Action is chosen, it becomes a work item in the final spec rather than a vague intention.
