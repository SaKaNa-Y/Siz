import ansis from 'ansis'
import type { SearchResult, TrackedPackage } from '../core/types.ts'

/** A small 0..1 score bar like ▰▰▰▱▱. */
export function scoreBar(value: number, width = 5): string {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * width)
  return ansis.green('▰'.repeat(filled)) + ansis.dim('▱'.repeat(width - filled))
}

/** Render one search result as a multi-line card. */
export function renderSearchResult(
  r: SearchResult,
  state: { tracked?: boolean; favorite?: boolean } = {},
): string {
  const marks = [
    state.favorite ? ansis.red('❤') : '',
    state.tracked ? ansis.cyan('• tracked') : '',
  ]
    .filter(Boolean)
    .join(' ')

  const header = `${ansis.bold.cyan(r.name)} ${ansis.dim(`v${r.version}`)}${marks ? `  ${marks}` : ''}`
  const desc = r.description ? `  ${r.description}` : `  ${ansis.dim('(no description)')}`
  const keywords = r.keywords.length
    ? `  ${ansis.dim('keywords:')} ${r.keywords.slice(0, 8).map((k) => ansis.yellow(k)).join(', ')}`
    : ''
  const quality = `  ${ansis.dim('quality')} ${scoreBar(r.score.quality)}  ${ansis.dim('popularity')} ${scoreBar(r.score.popularity)}`

  return [header, desc, keywords, quality].filter(Boolean).join('\n')
}

/** Render a tracked package as a compact one-liner for `siz list`. */
export function renderTrackedLine(p: TrackedPackage): string {
  const heart = p.favorite ? ansis.red('❤') : ' '
  const name = ansis.bold(p.name)
  const version = p.version ? ansis.dim(` v${p.version}`) : ''
  const category = p.category ? ` ${ansis.magenta(`[${p.category}]`)}` : ''
  const tags = p.tags.length ? `  ${p.tags.map((t) => ansis.yellow(`#${t}`)).join(' ')}` : ''
  return `${heart} ${name}${version}${category}${tags}`
}
