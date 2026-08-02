import { getLatestVersionBatch } from 'fast-npm-meta'

import type { TrustSignals } from './types.ts'

/** A package is "stale" when its latest version is older than this many years. */
export const STALE_YEARS = 2

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** How long to wait on the metadata endpoint before giving up (per call). */
const FETCH_TIMEOUT_MS = 4000

/** Minimum |% change| in daily downloads for a trend to count as rising/falling. */
export const MOMENTUM_THRESHOLD = 0.2

/** Below this many monthly downloads the trend is too noisy to trust — suppressed. */
export const MOMENTUM_MIN_DOWNLOADS = 1000

/** npm's public download-counts API; the bulk point endpoint keys results by name. */
const DOWNLOADS_ENDPOINT = 'https://api.npmjs.org/downloads/point'

/** Max package names per bulk download request (npm's documented cap). */
const DOWNLOADS_BATCH_SIZE = 128

/**
 * Max concurrent single-package download requests. The bulk endpoint rejects
 * scoped names, so those cost one request each — bound the fan-out the way
 * ./packument.ts does.
 */
const DOWNLOADS_CONCURRENCY = 8

/**
 * Session-scoped memo of fetched signals, keyed by package name. Trust signals
 * change slowly, so a single fetch per package per process is plenty and keeps
 * re-typing the same query instant.
 */
const cache = new Map<string, TrustSignals>()

/** Session-scoped memo of download counts + trend verdicts, keyed by package name. */
const downloadCache = new Map<string, TrustSignals>()

/** True when `publishedAt` is more than {@link STALE_YEARS} years before `now`. */
export function isStale(publishedAt: string | undefined, now: number): boolean {
  if (!publishedAt) return false
  const published = Date.parse(publishedAt)
  if (Number.isNaN(published)) return false
  return now - published > STALE_YEARS * YEAR_MS
}

/** Human "published 4y ago" / "published 5mo ago" string, or '' if unknown. */
export function formatPublishAge(publishedAt: string | undefined, now: number): string {
  if (!publishedAt) return ''
  const published = Date.parse(publishedAt)
  if (Number.isNaN(published)) return ''
  const months = Math.floor((now - published) / (YEAR_MS / 12))
  if (months < 1) return 'published this month'
  if (months < 12) return `published ${months}mo ago`
  const years = Math.floor(months / 12)
  return `published ${years}y ago`
}

/** `1.5` → `1.5`, `2.0` → `2` — one decimal, without a dangling `.0`. */
function oneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

/**
 * Humanize a download count as `812` / `1.5k` / `340k` / `12.3M` (base-1000), or
 * '' for a missing/invalid count. Magnitudes below 10k keep one decimal so the
 * long tail stays distinguishable (`1.5k` rather than `2k`); above that the
 * thousands are rounded whole, since nobody compares `341k` against `340k`.
 */
export function formatDownloads(count: number | undefined): string {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return ''
  if (count < 1000) return String(Math.round(count))
  if (count < 10_000) return `${oneDecimal(count / 1000)}k`
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`
  if (count < 1_000_000_000) return `${oneDecimal(count / 1_000_000)}M`
  return `${oneDecimal(count / 1_000_000_000)}B`
}

/**
 * npm package-name shape (lowercase, optional `@scope/`). Used to validate
 * replacement candidates extracted from a deprecation message.
 */
const PKG_NAME = String.raw`(?:@[a-z0-9](?:[a-z0-9-._]*[a-z0-9])?\/)?[a-z0-9](?:[a-z0-9-._]*[a-z0-9])?`

/** A leading (optionally back-tick/quote-wrapped) package-name token. */
const LEADING_TOKEN = new RegExp(String.raw`^[\s:]*([\`'"]?)(${PKG_NAME})\1`, 'i')

/** A separator between enumerated names — "X or Y", "X, Y", "X and Y". */
const ENUM_SEP = /^\s*(?:,|\/|or|and|&)\s+/i

/** Replacement-intent trigger phrases; a name token is looked for right after. */
const REPLACEMENT_TRIGGER =
  /\b(?:please\s+)?(?:use|migrate\s+to|switch\s+to|moved?\s+to|moving\s+to|renamed\s+to|replaced?\s+(?:by|with)|superseded\s+by|instead\s+use)\s+/gi

/** An npmjs.com package URL sometimes given as the successor. */
const NPM_PACKAGE_URL = new RegExp(String.raw`npmjs\.com\/package\/(${PKG_NAME})`, 'gi')

/** Bare (unquoted) English words that can follow a trigger but aren't packages. */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'this',
  'that',
  'our',
  'their',
  'its',
  'it',
  'we',
  'you',
  'they',
  'version',
  'versions',
  'npm',
  'latest',
  'package',
  'packages',
  'module',
  'library',
  'instead',
  'any',
  'new',
  'newer',
  'official',
  'maintained',
])

/** True when a candidate looks like a version (`v3`, `2`, `^2.0.0`), not a package. */
function looksLikeVersion(token: string): boolean {
  return /^v?\d/.test(token)
}

/**
 * Extract high-confidence successor package name(s) from a deprecation message —
 * what the maintainer pointed users to. Conservative by design: it only pulls a
 * name from an explicit replacement trigger ("use X", "replaced by X", "migrate
 * to X", an `npmjs.com/package/X` URL) or a back-tick/quoted name in that
 * context, validates the npm-name shape, drops version-only tokens ("v3",
 * "^2.0.0") and the package's own name, and otherwise returns `[]` rather than
 * guess. Handles enumerations like "use `date-fns` or `dayjs` instead" (a bare
 * first token is allowed, but enumerated continuations must be quoted to stay
 * high-confidence). Pure — no I/O.
 */
export function parseReplacement(message: string | undefined, selfName: string): string[] {
  if (!message) return []
  const self = selfName.toLowerCase()
  const out: string[] = []
  const seen = new Set<string>()

  const add = (raw: string): void => {
    const name = raw.trim()
    const lower = name.toLowerCase()
    if (!name || looksLikeVersion(name) || lower === self || seen.has(lower)) return
    seen.add(lower)
    out.push(name)
  }

  // 1. Replacement trigger → enumerated name token(s).
  REPLACEMENT_TRIGGER.lastIndex = 0
  let trigger: RegExpExecArray | null
  while ((trigger = REPLACEMENT_TRIGGER.exec(message))) {
    let rest = message.slice(trigger.index + trigger[0].length)
    let first = true
    let tok: RegExpExecArray | null
    while ((tok = LEADING_TOKEN.exec(rest))) {
      const quoted = tok[1] !== ''
      const name = tok[2]
      // Bare tokens are only trusted as the first word and never if a stop-word;
      // enumerated continuations must be quoted to avoid grabbing prose.
      if (!quoted && (!first || STOP_WORDS.has(name.toLowerCase()))) break
      add(name)
      rest = rest.slice(tok[0].length)
      const sep = ENUM_SEP.exec(rest)
      if (!sep) break
      rest = rest.slice(sep[0].length)
      first = false
    }
  }

  // 2. npmjs.com/package/<name> URLs.
  NPM_PACKAGE_URL.lastIndex = 0
  let url: RegExpExecArray | null
  while ((url = NPM_PACKAGE_URL.exec(message))) add(url[1])

  return out
}

/** Resolve after `ms`, yielding `value`. Used to bound a slow network call. */
function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    // unref so a still-pending timer (the fetch won the race) never keeps the
    // process alive — otherwise `--json`/`--list` would hang until it fires.
    setTimeout(() => resolve(value), ms).unref()
  })
}

/**
 * Fetch trust signals (deprecation, publish age, provenance) for the given
 * package names via fast-npm-meta. One batched attempt, retries disabled, with
 * a short timeout — on any failure it degrades silently (returns whatever it
 * has, empty for the rest) so search is never blocked. Results are memoized for
 * the process, so only uncached names trigger a request.
 */
export async function fetchTrustSignals(names: string[]): Promise<Map<string, TrustSignals>> {
  const missing = names.filter((name) => !cache.has(name))

  if (missing.length > 0) {
    try {
      const results = await Promise.race([
        getLatestVersionBatch(missing, { metadata: true, retry: false, throw: false }),
        timeout(FETCH_TIMEOUT_MS, null),
      ])
      if (results) {
        for (const r of results) {
          if ('error' in r) {
            cache.set(r.name, {})
            continue
          }
          const deprecated = r.deprecated || undefined
          const replacedBy = deprecated ? parseReplacement(deprecated, r.name) : []
          cache.set(r.name, {
            deprecated,
            publishedAt: r.publishedAt ?? undefined,
            provenance: r.provenance || r.trustedPublisher || undefined,
            replacedBy: replacedBy.length > 0 ? replacedBy : undefined,
          })
        }
      }
    } catch {
      // Endpoint slow/down — leave uncached names absent; signals just won't show.
    }
  }

  const out = new Map<string, TrustSignals>()
  for (const name of names) {
    const signals = cache.get(name)
    if (signals) out.set(name, signals)
  }
  return out
}

/**
 * Derive a download-trend direction from npm's last-week and last-month totals.
 *
 * npm doesn't expose a trend, so we approximate: compare the recent daily
 * average (`weekly / 7`) against a baseline daily average over the ~3 weeks
 * before it (`(monthly - weekly) / 23`) — excluding the recent week so it
 * doesn't dilute its own signal. Returns `undefined` (flat / unknown) below the
 * volume floor or within the threshold; see ADR 0002.
 */
export function computeMomentum(weekly: number, monthly: number): 'rising' | 'falling' | undefined {
  if (monthly < MOMENTUM_MIN_DOWNLOADS) return undefined
  const recentDaily = weekly / 7
  const baselineDaily = (monthly - weekly) / 23
  if (baselineDaily <= 0) return undefined
  const pctChange = recentDaily / baselineDaily - 1
  if (pctChange > MOMENTUM_THRESHOLD) return 'rising'
  if (pctChange < -MOMENTUM_THRESHOLD) return 'falling'
  return undefined
}

/** One bulk download-counts response: `{ "<pkg>": { downloads } | null }`. */
type BulkDownloads = Record<string, { downloads: number } | null>

/**
 * Fetch one period's download totals for a set of names, keyed by name; null on
 * any failure (silent degrade).
 *
 * The endpoint has two response shapes and picks by *name count*, not by URL: ask
 * for two or more names and it answers with the name-keyed map, ask for exactly
 * one and it answers with that package's bare `{ downloads, package, … }` object.
 * Both are normalized to the map here, so callers never see the difference — and
 * a lone name (the last chunk of a search, or any scoped package, which is
 * necessarily requested alone) doesn't silently come back empty.
 */
async function fetchPoint(period: string, names: string[]): Promise<BulkDownloads | null> {
  const url = `${DOWNLOADS_ENDPOINT}/${period}/${names.join(',')}`
  try {
    const res = await Promise.race([
      fetch(url, { headers: { accept: 'application/json' } }),
      timeout(FETCH_TIMEOUT_MS, null),
    ])
    if (!res || !res.ok) return null
    const body = (await res.json()) as BulkDownloads | { downloads?: number }
    const single = (body as { downloads?: number })?.downloads
    if (typeof single === 'number') return { [names[0]]: { downloads: single } }
    return body as BulkDownloads
  } catch {
    return null
  }
}

/**
 * Fetch weekly download counts (and, where both periods are available, trend
 * momentum) for the given package names via npm's download API.
 *
 * Unscoped names go through the bulk point endpoint: two calls (last-week +
 * last-month) per ≤128-name chunk, yielding the count *and* a locally derived
 * {@link computeMomentum} verdict — the count is already in that response, so it
 * costs nothing extra. Scoped names are rejected when batched with others, so
 * each gets one last-week call of its own with bounded concurrency; that yields a
 * count but no second period, hence never an arrow.
 *
 * Memoized per process and degrades silently on any failure, so search is never
 * blocked. Only names with something to show appear in the returned map.
 */
export async function fetchDownloadSignals(names: string[]): Promise<Map<string, TrustSignals>> {
  const missing = names.filter((name) => !downloadCache.has(name))
  const scoped = missing.filter((name) => name.startsWith('@'))
  const unscoped = missing.filter((name) => !name.startsWith('@'))

  const chunks: string[][] = []
  for (let i = 0; i < unscoped.length; i += DOWNLOADS_BATCH_SIZE) {
    chunks.push(unscoped.slice(i, i + DOWNLOADS_BATCH_SIZE))
  }

  // Scoped names: a worker pool draining one name at a time, so concurrency is
  // capped at DOWNLOADS_CONCURRENCY rather than firing every scoped row at once.
  let index = 0
  const scopedWorker = async (): Promise<void> => {
    while (index < scoped.length) {
      const name = scoped[index++]
      // eslint-disable-next-line no-await-in-loop
      const week = await fetchPoint('last-week', [name])
      const weekly = week?.[name]?.downloads
      downloadCache.set(name, typeof weekly === 'number' ? { downloads: weekly } : {})
    }
  }

  await Promise.all([
    ...chunks.map(async (chunk) => {
      const [week, month] = await Promise.all([
        fetchPoint('last-week', chunk),
        fetchPoint('last-month', chunk),
      ])
      for (const name of chunk) {
        const weekly = week?.[name]?.downloads
        const monthly = month?.[name]?.downloads
        if (typeof weekly !== 'number') {
          // No data (network gap or unknown package) — memo empty so we don't retry.
          downloadCache.set(name, {})
          continue
        }
        const signals: TrustSignals = { downloads: weekly }
        const momentum = typeof monthly === 'number' ? computeMomentum(weekly, monthly) : undefined
        if (momentum) signals.momentum = momentum
        downloadCache.set(name, signals)
      }
    }),
    ...Array.from({ length: Math.min(DOWNLOADS_CONCURRENCY, scoped.length) }, scopedWorker),
  ])

  const out = new Map<string, TrustSignals>()
  for (const name of names) {
    const signals = downloadCache.get(name)
    if (signals?.momentum || typeof signals?.downloads === 'number') out.set(name, signals)
  }
  return out
}
