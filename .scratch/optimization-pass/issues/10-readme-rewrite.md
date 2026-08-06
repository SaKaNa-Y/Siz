# 10 — README rewrite

**What to build:** The README describes what siz actually ships, so its checkmarks can be trusted again.

By this point favorites, heuristic categories and the score bars are gone, search is one command, the download count is a headline signal, and two trust facts come from the packument instead of a third party. The README still documents all of the old behavior — including a Favorites section, a Categories section, a second search command, and a data-sources table that attributes deprecation and provenance to the third-party service.

Rewrite the **Features** section (the user's explicit ask) and every prose section the pass touched, keeping the existing three-layer framing — Discover, Organize, Manage — and the Next / Later / Maybe roadmap tags. Anything that moved from shipped to removed should simply disappear rather than being marked as removed; the roadmap items this pass did not touch stay exactly as they are.

Also refresh the project instructions' module map, which still lists the deleted modules and the old search-mode plumbing.

Parent spec: `.scratch/optimization-pass/PRD.md`.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09.

**Status:** done

- [x] The Features section lists only shipped behavior, with the removed features gone rather than annotated
- [x] The Organize track describes bundles as the only saved-package store, the flat cross-bundle saved-entry list, the front door, and per-entry removal
- [x] The Favorites and Categories sections are removed, along with the `category:` qualifier and `--category` from every table and example
- [x] The search section describes one command with name-affinity ranking, and no longer advertises a separate full-text command
- [x] The result-signals sections describe the weekly download count, and the score bars are gone from every sample of output
- [x] The signals prose reflects that `✓` means a provenance attestation
- [x] The data-sources table attributes deprecation, provenance, install size and license to the official registry packument, and the third-party service to publish age only
- [x] The commands table matches the current surface, including `siz list -b`, `siz bundle rm <bundle> [...pkgs]`, and the upgrade levels without `latest`
- [x] Quick start examples all work when run — verify them rather than assuming
- [x] Links to the new ADRs 0010, 0011 and 0012 are added where the relevant behavior is described
- [x] The project instructions' module map matches the current modules
- [x] No sample output in the README shows a category label, a score bar, or a removed flag
- [x] `pnpm lint` passes (docs-only ticket — no changeset needed)
