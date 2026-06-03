import ansis from 'ansis'

import type { BundleInstallItem } from '../core/bundle.ts'
import type { Bundle, BundlePackage, VersionStrategy } from '../core/types.ts'

/** Short symbol for a version strategy, e.g. `^` for caret. */
export function strategyLabel(strategy: VersionStrategy): string {
  switch (strategy) {
    case 'caret':
      return '^'
    case 'tilde':
      return '~'
    case 'exact':
      return '='
    default:
      return 'latest'
  }
}

/** Short, dimmed badge for a dependency bucket, e.g. `[dev]`, `[peer]`. */
export function depTypeLabel(depType: BundlePackage['depType']): string {
  switch (depType) {
    case 'devDependencies':
      return ansis.dim('[dev]')
    case 'peerDependencies':
      return ansis.dim('[peer]')
    case 'optionalDependencies':
      return ansis.dim('[opt]')
    default:
      return ansis.dim('[dep]')
  }
}

/** One package line for `bundle show`, e.g. `  react  ^  [dep]`. */
export function renderBundlePackageLine(entry: BundlePackage): string {
  const strat = ansis.cyan(strategyLabel(entry.strategy))
  return `  ${ansis.bold(entry.name)}  ${strat} ${depTypeLabel(entry.depType)}`
}

/** Format an ISO timestamp as a short date, or `never`. */
function shortDate(iso?: string): string {
  if (!iso) return 'never'
  return iso.slice(0, 10)
}

/** One bundle summary line for `bundle list`. */
export function renderBundleListLine(bundle: Bundle): string {
  const count = Object.keys(bundle.packages).length
  const name = ansis.bold.cyan(bundle.name)
  const pkgs = ansis.dim(`${count} pkg${count === 1 ? '' : 's'}`)
  const tags = bundle.tags.length
    ? `  ${bundle.tags.map((t) => ansis.yellow(`#${t}`)).join(' ')}`
    : ''
  const used = ansis.dim(`used ${shortDate(bundle.lastUsedAt)}`)
  const desc = bundle.description ? `\n    ${ansis.dim(bundle.description)}` : ''
  return `${name}  ${pkgs}${tags}  ${used}${desc}`
}

/** Full listing for `bundle list`. */
export function renderBundleList(bundles: Bundle[]): string {
  return bundles.map(renderBundleListLine).join('\n')
}

/** Full contents block for `bundle show`. */
export function renderBundleShow(bundle: Bundle): string {
  const lines: string[] = []
  lines.push(ansis.bold.cyan(bundle.name))
  if (bundle.description) lines.push(ansis.dim(bundle.description))
  if (bundle.tags.length) lines.push(bundle.tags.map((t) => ansis.yellow(`#${t}`)).join(' '))
  const meta: string[] = [
    `created ${shortDate(bundle.createdAt)}`,
    `used ${shortDate(bundle.lastUsedAt)}`,
  ]
  if (bundle.packageManager) meta.push(`pm ${bundle.packageManager}`)
  lines.push(ansis.dim(meta.join('  ·  ')))

  const entries = Object.values(bundle.packages)
  if (entries.length === 0) {
    lines.push(ansis.dim('  (no packages)'))
  } else {
    lines.push('')
    for (const entry of entries) lines.push(renderBundlePackageLine(entry))
  }
  return lines.join('\n')
}

/** Multiselect row label for `bundle install`, e.g. `react@^18.2.0  [dep]`. */
export function bundleInstallOptionLabel(item: BundleInstallItem): string {
  const spec = item.missing
    ? `${ansis.bold(item.name)} ${ansis.red('(not on npm)')}`
    : ansis.bold(item.spec)
  return `${spec}  ${depTypeLabel(item.depType)}`
}
