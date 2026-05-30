/**
 * GitHub-style query parsing for Siz search.
 *
 * A raw query string is split into plain search `terms` and `key:value`
 * qualifiers. Some qualifiers map straight onto npm's native search syntax
 * (`keywords:`, `author:`, `scope:`), while others (`category:`) are applied
 * client-side. `tag:` is context-aware — in npm discovery it behaves like
 * `keyword:`, while the tracked-browse path uses it against the user's own tags.
 *
 * Examples:
 *   "react"                  -> terms: ["react"]
 *   "keyword:cli kw:tool"    -> qualifiers.keyword: ["cli", "tool"]
 *   "category:frontend zod"  -> terms: ["zod"], qualifiers.category: "frontend"
 *   "author:sindresorhus"    -> qualifiers.author: "sindresorhus"
 */

export interface ParsedQuery {
  /** Plain (non-qualified) search words. */
  terms: string[]
  qualifiers: {
    /** npm keywords; maps to the native `keywords:` qualifier. */
    keyword?: string[]
    /** Siz category, filtered client-side via suggestCategory. */
    category?: string
    /** npm publisher; maps to the native `author:` qualifier. */
    author?: string
    /** npm scope (without leading @); maps to the native `scope:` qualifier. */
    scope?: string
    /** Context-aware tags (npm keywords in discovery, user tags when browsing). */
    tag?: string[]
  }
}

/** Canonical qualifier keys with their accepted aliases. */
const ALIASES: Record<string, keyof ParsedQuery['qualifiers']> = {
  keyword: 'keyword',
  keywords: 'keyword',
  kw: 'keyword',
  category: 'category',
  cat: 'category',
  author: 'author',
  scope: 'scope',
  tag: 'tag',
  tags: 'tag',
}

/** Parse a raw query string into plain terms plus structured qualifiers. */
export function parseQuery(raw: string): ParsedQuery {
  const result: ParsedQuery = { terms: [], qualifiers: {} }

  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const colon = token.indexOf(':')
    // Treat as a qualifier only when there's a known key on the left and a
    // non-empty value on the right; otherwise it's a plain term.
    if (colon > 0) {
      const key = token.slice(0, colon).toLowerCase()
      const value = token.slice(colon + 1)
      const canonical = ALIASES[key]
      if (canonical && value) {
        applyQualifier(result.qualifiers, canonical, value)
        continue
      }
    }
    result.terms.push(token)
  }

  return result
}

function applyQualifier(
  q: ParsedQuery['qualifiers'],
  key: keyof ParsedQuery['qualifiers'],
  value: string,
): void {
  switch (key) {
    case 'keyword':
    case 'tag': {
      // Comma-separated values accumulate (logical OR on the npm side).
      const values = value.split(',').map((v) => v.trim()).filter(Boolean)
      q[key] = [...(q[key] ?? []), ...values]
      return
    }
    case 'scope':
      // Tolerate a leading @ but store the bare scope name.
      q.scope = value.replace(/^@/, '')
      return
    case 'category':
    case 'author':
      q[key] = value
      return
  }
}

/**
 * Reassemble an npm registry `text` string from a parsed query, emitting the
 * native qualifiers the registry understands. `category` is intentionally
 * omitted — it is filtered client-side.
 */
export function buildRegistryText(q: ParsedQuery): string {
  const parts: string[] = [...q.terms]

  // npm treats comma as OR within a single `keywords:` qualifier.
  const keywords = [...(q.qualifiers.keyword ?? []), ...(q.qualifiers.tag ?? [])]
  if (keywords.length) parts.push(`keywords:${keywords.join(',')}`)
  if (q.qualifiers.author) parts.push(`author:${q.qualifiers.author}`)
  if (q.qualifiers.scope) parts.push(`scope:${q.qualifiers.scope}`)

  return parts.join(' ').trim()
}
