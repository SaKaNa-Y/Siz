import { getLatestVersionBatch } from 'fast-npm-meta'

import type { TrustSignals } from './types.ts'

/** A package is "stale" when its latest version is older than this many years. */
export const STALE_YEARS = 2

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** How long to wait on the metadata endpoint before giving up (per call). */
const FETCH_TIMEOUT_MS = 4000

/**
 * Session-scoped memo of fetched signals, keyed by package name. Trust signals
 * change slowly, so a single fetch per package per process is plenty and keeps
 * re-typing the same query instant.
 */
const cache = new Map<string, TrustSignals>()

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
