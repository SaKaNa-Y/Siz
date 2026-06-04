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

/** `1.2.3 → ^1.5.0`, with the proposed version tinted by bump severity. */
export function renderVersionDelta(item: UpgradePlanItem): string {
  return `${ansis.dim(item.current)} ${ansis.dim('→')} ${colorForDiff(item.diff)(item.proposed)}`
}

/**
 * Multiselect row label, e.g. `[dev] vitest  2.0.0 → ^3.0.0 (major)`.
 * In recursive mode, `scope` tags the row with its package dir (e.g. `packages/ui`).
 */
export function upgradeOptionLabel(item: UpgradePlanItem, scope?: string): string {
  const where = scope ? ansis.dim(`${scope} `) : ''
  const dev = item.depType === 'devDependencies' ? `${ansis.dim('[dev]')} ` : ''
  const level = item.diff ? ` ${ansis.dim(`(${item.diff})`)}` : ''
  return `${where}${dev}${ansis.bold(item.name)}  ${renderVersionDelta(item)}${level}`
}

/** One-line summary of an upgrade plan for the spinner stop message. */
export function renderUpgradeSummary(plan: UpgradePlan): string {
  const n = plan.upgradable.length
  const parts = [`${n} update${n === 1 ? '' : 's'} available`]
  if (plan.upToDate.length) parts.push(ansis.dim(`${plan.upToDate.length} up to date`))
  if (plan.skipped.length) parts.push(ansis.dim(`${plan.skipped.length} skipped`))
  return parts.join(ansis.dim(' · '))
}
