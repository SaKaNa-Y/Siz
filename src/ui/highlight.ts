import ansis from 'ansis'

/**
 * Highlight occurrences of each whitespace-separated term from `query`
 * within `text` (case-insensitive). Used to emphasize matches in the
 * live search results.
 */
export function highlightKeywords(text: string, query: string): string {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
  if (terms.length === 0) return text

  const re = new RegExp(`(${terms.join('|')})`, 'gi')
  return text.replace(re, (match) => ansis.yellow(match))
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
