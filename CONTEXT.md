# Siz

`siz` is a CLI for discovering, favoriting, and installing npm packages. This glossary fixes the language used across its three tracks — Discover, Organize, Manage.

## Language

### Discover

**Trust signal**:
A health/maintenance fact about a package, surfaced inline on a search result so the user can judge it before installing. The v1 set is deprecation status, publish age, and provenance — all read from a single batch metadata call.
_Avoid_: health badge, quality indicator (those overlap with npm's existing `score.*` bars)

**Trust-aware discovery**:
The Discover-track capability of attaching [[#trust-signal|trust signals]] to search results. It is purely informational — it never blocks or filters; it only informs the choice to install.

**Provenance**:
Verifiable evidence (npm's signed attestation) that a published package was built from the source it claims. Distinct from `trustedPublisher`, which is npm's separate flag for publisher identity. Treated together as the v1 "provenance" trust signal. **Positive-only**: a green `✓` shows when either is present; absence renders nothing (adoption is still low, so flagging its absence would be noise).

**Score** (existing):
npm's own relevance/quality/popularity/maintenance numbers (0..1) returned by the search endpoint and rendered as bars. A trust signal is NOT a score — scores come from search; trust signals come from the metadata call.

**Stale**:
A package whose latest version was published more than **2 years** ago. Renders the `⚑` glyph. Fresher packages show no age glyph (the exact "published Xago" text still appears in the focused row's detail). Stale is a prompt to look closer, never a block.

**Deprecated**:
A package whose registry metadata carries a non-empty `deprecated` message. Always renders the `⚠` glyph; the message shows in the focused row's detail.
