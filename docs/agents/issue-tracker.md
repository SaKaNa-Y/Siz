# Issue tracker: GitHub Issues

GitHub Issues in [`SaKaNa-Y/Siz`](https://github.com/SaKaNa-Y/Siz/issues) are the single source of truth for issues, PRDs, maps, research, status, and discussion. Keep local Markdown for durable project documentation only; `.scratch/` is not an issue tracker.

## Conventions

- One independently actionable work item per issue.
- A PRD or map is a `tracking` issue with a checklist linking its child issues.
- Use GitHub's open/closed state instead of a `Status:` line.
- Express dependencies with real issue references such as `Blocked by: #123`.
- Put findings, decisions, and conversation history in issue comments.
- Claim work with a GitHub assignee.
- Apply the repository labels documented in `triage-labels.md`.

## Publish to the issue tracker

1. Search open and closed issues for an existing equivalent.
2. Create or update the GitHub issue in `SaKaNa-Y/Siz`.
3. Add the appropriate triage and work-type labels.
4. Link blockers and the tracking issue with GitHub issue numbers.
5. Return the issue URL as the durable reference.

The command-line path is `gh issue create --repo SaKaNa-Y/Siz`; use `gh issue edit` for later body, label, assignee, or state changes.

## Fetch a ticket

Read its full body and comments with `gh issue view <number> --repo SaKaNa-Y/Siz --comments`. Treat the GitHub copy as authoritative if old commits contain a former local copy.
