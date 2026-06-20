import ansis from 'ansis'

import type { FavoritePackage, SearchResult, TrustSignals } from '../core/types.ts'

import { suggestCategory } from '../core/categories.ts'
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
 * `✓` provenance. Returns '' when there's nothing to show.
 */
export function trustGlyphs(signals: TrustSignals, now: number): string {
  const glyphs: string[] = []
  if (signals.deprecated) glyphs.push(ansis.red('⚠'))
  if (isStale(signals.publishedAt, now)) glyphs.push(ansis.yellow('⚑'))
  if (signals.provenance) glyphs.push(ansis.green('✓'))
  return glyphs.join(' ')
}

/** Expanded, word-form trust signals for a focused row / `--list` card. */
export function trustDetail(signals: TrustSignals, now: number): string {
  const parts: string[] = []
  if (signals.deprecated) parts.push(ansis.red(`deprecated: ${signals.deprecated}`))
  const stale = isStale(signals.publishedAt, now)
  const age = formatPublishAge(signals.publishedAt, now)
  if (age) parts.push(stale ? ansis.yellow(age) : ansis.dim(age))
  if (signals.provenance) parts.push(ansis.green('provenance'))
  return parts.join(ansis.dim(' · '))
}

/** One-line legend explaining the trust glyphs, shown beneath the search box. */
export function trustLegend(): string {
  return `${ansis.red('⚠')} ${ansis.dim('deprecated')}   ${ansis.yellow('⚑')} ${ansis.dim('stale (>2y)')}   ${ansis.green('✓')} ${ansis.dim('provenance')}`
}

/** Render one search result as a multi-line card. */
export function renderSearchResult(
  r: SearchResult,
  state: {
    favorite?: boolean
    showDescription?: boolean
    signals?: TrustSignals
    now?: number
  } = {},
): string {
  const { showDescription = true } = state
  const marks = state.favorite ? ansis.red('★ fav') : ''

  const label = categoryLabel(r)
  const header = `${label ? `${label} ` : ''}${ansis.bold.cyan(r.name)} ${ansis.dim(`v${r.version}`)}${marks ? `  ${marks}` : ''}`
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
  const signalsLine = state.signals
    ? `  ${trustDetail(state.signals, state.now ?? Date.now())}`.trimEnd()
    : ''

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

/** Render a favorited package as a compact one-liner for `siz list`. */
export function renderFavoriteLine(p: FavoritePackage): string {
  const name = ansis.bold(p.name)
  const version = p.version ? ansis.dim(` v${p.version}`) : ''
  const category = p.category ? ` ${ansis.magenta(`[${p.category}]`)}` : ''
  return `${ansis.red('★')} ${name}${version}${category}`
}
