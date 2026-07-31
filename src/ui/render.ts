import ansis from 'ansis'

import type {
  LicenseSignals,
  SearchResult,
  SizeSignals,
  TrustSignals,
} from '../core/types.ts'

import { suggestCategory } from '../core/categories.ts'
import { formatLicense, isUnclearLicense, truncateLicense } from '../core/license.ts'
import { formatBytes, isHeavy } from '../core/size.ts'
import { formatPublishAge, isStale } from '../core/trust.ts'

/** A small 0..1 score bar like ▰▰▰▱▱. */
export function scoreBar(value: number, width = 5): string {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * width)
  return ansis.green('▰'.repeat(filled)) + ansis.dim('▱'.repeat(width - filled))
}

/**
 * A single `[Category]` label derived from a result's name/description/keywords,
 * or '' when nothing matches. Used as an at-a-glance categorization marker.
 */
export function categoryLabel(r: SearchResult): string {
  const category = suggestCategory(r)
  return category ? ansis.magenta(`[${category}]`) : ''
}

/**
 * Compact trust-signal glyphs for a result row: `⚠` deprecated, `⚑` stale,
 * `✓` provenance, `↑` downloads rising / `↓` falling. Returns '' when there's
 * nothing to show.
 */
export function trustGlyphs(signals: TrustSignals, now: number): string {
  const glyphs: string[] = []
  if (signals.deprecated) glyphs.push(ansis.red('⚠'))
  if (isStale(signals.publishedAt, now)) glyphs.push(ansis.yellow('⚑'))
  if (signals.provenance) glyphs.push(ansis.green('✓'))
  if (signals.momentum === 'rising') glyphs.push(ansis.green('↑'))
  else if (signals.momentum === 'falling') glyphs.push(ansis.red('↓'))
  return glyphs.join(' ')
}

/** Expanded, word-form trust signals for a focused row / `--list` card. */
export function trustDetail(signals: TrustSignals, now: number): string {
  const parts: string[] = []
  if (signals.deprecated) parts.push(ansis.red(`deprecated: ${signals.deprecated}`))
  if (signals.replacedBy?.length) {
    parts.push(ansis.cyan(`→ replaced by ${signals.replacedBy.join(', ')}`))
  }
  const stale = isStale(signals.publishedAt, now)
  const age = formatPublishAge(signals.publishedAt, now)
  if (age) parts.push(stale ? ansis.yellow(age) : ansis.dim(age))
  if (signals.provenance) parts.push(ansis.green('provenance'))
  if (signals.momentum === 'rising') parts.push(ansis.green('downloads rising'))
  else if (signals.momentum === 'falling') parts.push(ansis.red('downloads falling'))
  return parts.join(ansis.dim(' · '))
}

/**
 * One-line legend for every result-signal glyph — trust, size, and license —
 * shown beneath the search box. Named for the umbrella *result signal*, not for
 * any one family, since it covers all three.
 */
export function signalLegend(): string {
  return `${ansis.red('⚠')} ${ansis.dim('deprecated')}   ${ansis.yellow('⚑')} ${ansis.dim('stale (>2y)')}   ${ansis.green('✓')} ${ansis.dim('provenance')}   ${ansis.green('↑')} ${ansis.dim('rising')}   ${ansis.red('↓')} ${ansis.dim('falling')}   ${ansis.yellow('■')} ${ansis.dim('heavy (>1MB)')}   ${ansis.yellow('⚖')} ${ansis.dim('unclear license')}`
}

/**
 * Compact install-size annotation for a result row: the humanized size, plus a
 * `■` glyph when it crosses the heavy threshold. '' when the size is unknown.
 * Bundle size never appears here — it is a focused-row detail only.
 */
export function sizeInline(size: SizeSignals): string {
  const text = formatBytes(size.installSize)
  if (!text) return ''
  const heavy = isHeavy(size.installSize)
  return heavy ? `${ansis.yellow(text)} ${ansis.yellow('■')}` : ansis.dim(text)
}

/** Expanded, word-form size signals for a focused row / `--list` card. */
export function sizeDetail(size: SizeSignals): string {
  const parts: string[] = []
  const install = formatBytes(size.installSize)
  if (install) {
    const label = `${install} install`
    parts.push(isHeavy(size.installSize) ? ansis.yellow(label) : ansis.dim(label))
  }
  if (size.bundle) parts.push(ansis.dim(`${formatBytes(size.bundle.gzip)} gz`))
  return parts.join(ansis.dim(' · '))
}

/**
 * Compact license annotation for a result row: the declared license, clipped to
 * {@link LICENSE_INLINE_MAX}, plus a `⚖` glyph when it can't be resolved from
 * metadata. The glyph travels with its text (as `■` does in {@link sizeInline})
 * so each signal family owns one self-contained formatter.
 */
export function licenseInline(license: LicenseSignals): string {
  const text = truncateLicense(formatLicense(license.license))
  return isUnclearLicense(license.license)
    ? `${ansis.yellow(text)} ${ansis.yellow('⚖')}`
    : ansis.dim(text)
}

/** Expanded, untruncated license for a focused row / `--list` card. */
export function licenseDetail(license: LicenseSignals): string {
  const text = formatLicense(license.license)
  return isUnclearLicense(license.license) ? ansis.yellow(`${text} ⚖`) : ansis.dim(text)
}

/** Render one search result as a multi-line card. */
export function renderSearchResult(
  r: SearchResult,
  state: {
    showDescription?: boolean
    signals?: TrustSignals
    size?: SizeSignals
    license?: LicenseSignals
    now?: number
  } = {},
): string {
  const { showDescription = true } = state

  const label = categoryLabel(r)
  const header = `${label ? `${label} ` : ''}${ansis.bold.cyan(r.name)} ${ansis.dim(`v${r.version}`)}`
  const desc = !showDescription
    ? ''
    : r.description
      ? `  ${r.description}`
      : `  ${ansis.dim('(no description)')}`
  const keywords =
    showDescription && r.keywords.length
      ? `  ${ansis.dim('keywords:')} ${r.keywords
          .slice(0, 8)
          .map((k) => ansis.yellow(k))
          .join(', ')}`
      : ''
  const quality = `  ${ansis.dim('quality')} ${scoreBar(r.score.quality)}  ${ansis.dim('popularity')} ${scoreBar(r.score.popularity)}`
  const details = [
    state.signals ? trustDetail(state.signals, state.now ?? Date.now()) : '',
    state.size ? sizeDetail(state.size) : '',
    state.license ? licenseDetail(state.license) : '',
  ].filter(Boolean)
  const signalsLine = details.length ? `  ${details.join(ansis.dim(' · '))}` : ''

  return [header, desc, keywords, quality, signalsLine].filter(Boolean).join('\n')
}

/**
 * A multi-line notice listing packages blocked by dependency rules, each with the
 * rule that blocked it, plus the config file they came from.
 */
export function formatBlockedNotice(
  blocked: { name: string; reason: string }[],
  configPath: string,
): string {
  const lines = blocked.map(
    (b) => `  ${ansis.red('✗')} ${ansis.bold(b.name)} ${ansis.dim(`— ${b.reason}`)}`,
  )
  return [`Blocked by dependency rules (${ansis.dim(configPath)}):`, ...lines].join('\n')
}
