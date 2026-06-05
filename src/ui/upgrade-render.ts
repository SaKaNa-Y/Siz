import ansis from 'ansis'

import type { DiffLevel, UpgradePlan, UpgradePlanItem } from '../core/upgrade.ts'

/** Color a version by how big the bump is: red/major, yellow/minor, green/patch. */
function colorForDiff(level: DiffLevel): (s: string) => string {
  switch (level) {
    case 'major':
    case 'premajor':
      return ansis.red
    case 'minor':
    case 'preminor':
      return ansis.yellow
    case 'patch':
    case 'prepatch':
      return ansis.green
    default:
      return ansis.cyan
  }
}

/**
 * `1.2.3 → ^1.5.0`, with the proposed version tinted by bump severity. Uses
 * `ansis.gray` (foreground, closes with `\x1b[39m`) rather than `ansis.dim`
 * (closes with `\x1b[22m`): when this string is embedded in a clack multiselect
 * label, a `\x1b[22m` would cancel clack's own dim-based selection styling and
 * make non-focused rows render bright. Foreground resets leave dim intact.
 */
export function renderVersionDelta(item: UpgradePlanItem): string {
  return `${ansis.gray(item.current)} ${ansis.gray('→')} ${colorForDiff(item.diff)(item.proposed)}`
}

/**
 * Multiselect row label, e.g. `vitest  2.0.0 → ^3.0.0 (major)`. The dev-dependency
 * marker is surfaced via clack's per-option `hint` (see `runUpgrade`), not the label,
 * so it doesn't collide with the multiselect's dim-based selection styling.
 * In recursive mode, `scope` tags the row with its package dir (e.g. `packages/ui`).
 *
 * Every styled segment here must use foreground colors only (`ansis.gray`/severity
 * tints, which close with `\x1b[39m`) and avoid `ansis.bold`/`ansis.dim` (which close
 * with `\x1b[22m`). clack marks non-focused rows by wrapping the whole label in
 * `\x1b[2m … \x1b[22m`; an embedded `\x1b[22m` would end that dim early and leave the
 * rest of the row bright, making the focused row indistinguishable — especially in
 * recursive mode where the `scope` prefix sits at the very front of the label.
 */
export function upgradeOptionLabel(item: UpgradePlanItem, scope?: string): string {
  const where = scope ? ansis.gray(`${scope} `) : ''
  const level = item.diff ? ` ${ansis.gray(`(${item.diff})`)}` : ''
  return `${where}${item.name}  ${renderVersionDelta(item)}${level}`
}

/** One-line summary of an upgrade plan for the spinner stop message. */
export function renderUpgradeSummary(plan: UpgradePlan): string {
  const n = plan.upgradable.length
  const parts = [`${n} update${n === 1 ? '' : 's'} available`]
  if (plan.upToDate.length) parts.push(ansis.dim(`${plan.upToDate.length} up to date`))
  if (plan.skipped.length) parts.push(ansis.dim(`${plan.skipped.length} skipped`))
  return parts.join(ansis.dim(' · '))
}
