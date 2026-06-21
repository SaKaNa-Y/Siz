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
 * Session-scoped memo of fetched signals, keyed by package name. Trust signals
 * change slowly, so a single fetch per package per process is plenty and keeps
 * re-typing the same query instant.
 */
const cache = new Map<string, TrustSignals>()

/** Session-scoped memo of download-trend verdicts, keyed by package name. */
const trendCache = new Map<string, TrustSignals>()

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
          cache.set(r.name, {
            deprecated: r.deprecated || undefined,
            publishedAt: r.publishedAt ?? undefined,
            provenance: r.provenance || r.trustedPublisher || undefined,
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

/** Fetch one period's bulk download totals; null on any failure (silent degrade). */
async function fetchPoint(period: string, names: string[]): Promise<BulkDownloads | null> {
  const url = `${DOWNLOADS_ENDPOINT}/${period}/${names.join(',')}`
  try {
    const res = await Promise.race([
      fetch(url, { headers: { accept: 'application/json' } }),
      timeout(FETCH_TIMEOUT_MS, null),
    ])
    if (!res || !res.ok) return null
    return (await res.json()) as BulkDownloads
  } catch {
    return null
  }
}

/**
 * Fetch download-trend momentum for the given package names via npm's download
 * API. Two bulk point calls (last-week + last-month) per ≤128-name chunk; the
 * trend is derived locally by {@link computeMomentum}. Scoped packages are
 * skipped (the bulk endpoint rejects them). Memoized per process and degrades
 * silently on any failure, so search is never blocked.
 */
export async function fetchDownloadTrend(names: string[]): Promise<Map<string, TrustSignals>> {
  // Scoped packages aren't supported by the bulk endpoint — skip them entirely.
  const missing = names.filter((name) => !trendCache.has(name) && !name.startsWith('@'))

  const chunks: string[][] = []
  for (let i = 0; i < missing.length; i += DOWNLOADS_BATCH_SIZE) {
    chunks.push(missing.slice(i, i + DOWNLOADS_BATCH_SIZE))
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const [week, month] = await Promise.all([
        fetchPoint('last-week', chunk),
        fetchPoint('last-month', chunk),
      ])
      for (const name of chunk) {
        const weekly = week?.[name]?.downloads
        const monthly = month?.[name]?.downloads
        if (typeof weekly !== 'number' || typeof monthly !== 'number') {
          // No data (network gap or unknown package) — memo empty so we don't retry.
          trendCache.set(name, {})
          continue
        }
        const momentum = computeMomentum(weekly, monthly)
        trendCache.set(name, momentum ? { momentum } : {})
      }
    }),
  )

  const out = new Map<string, TrustSignals>()
  for (const name of names) {
    const signals = trendCache.get(name)
    if (signals?.momentum) out.set(name, signals)
  }
  return out
}
