import type { SizeSignals } from './types.ts'

import { fetchManifests, timeout } from './packument.ts'

/**
 * Install size at or above this many bytes renders a `heavy` glyph. Editorial,
 * like {@link import('./trust.ts').STALE_YEARS} — a tunable prompt to look
 * closer, and the "heavy" notion the planned lighter-alternative feature reuses.
 */
export const HEAVY_INSTALL_BYTES = 1024 * 1024

/** How long to wait on Bundlephobia before giving up (per call). */
const FETCH_TIMEOUT_MS = 4000

/** Bundlephobia's size API (min + gzip of a package plus its deps). */
const BUNDLEPHOBIA_ENDPOINT = 'https://bundlephobia.com/api/size'

/** Session-scoped memo of bundle sizes; `null` means "fetched, unavailable". */
const bundleCache = new Map<string, SizeSignals['bundle'] | null>()

/** True when an install size is at/above the {@link HEAVY_INSTALL_BYTES} threshold. */
export function isHeavy(bytes: number | undefined): boolean {
  return typeof bytes === 'number' && bytes >= HEAVY_INSTALL_BYTES
}

/**
 * Humanize a byte count as `340 kB` / `1.4 MB` (base-1000, npm-style), or '' for
 * missing/invalid input. kB is shown whole; MB and up carry one decimal.
 */
export function formatBytes(bytes: number | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`
}

/**
 * Fetch install sizes (own unpacked bytes) for the given package names, derived
 * from the shared packument layer — so this costs no requests beyond the ones the
 * license signal already needs (see ./packument.ts, ADR 0009). Memoized per
 * process and degrades silently, so search is never blocked. Only names with a
 * known size appear in the returned map.
 */
export async function fetchInstallSizes(names: string[]): Promise<Map<string, number>> {
  const manifests = await fetchManifests(names)

  const out = new Map<string, number>()
  for (const [name, manifest] of manifests) {
    const size = manifest.dist?.unpackedSize
    if (typeof size === 'number' && size >= 0) out.set(name, size)
  }
  return out
}

/**
 * Fetch one package's bundle size (min + gzip, incl. deps) from Bundlephobia.
 * Memoized per process, short timeout, degrades silently (returns undefined) so
 * the focused-row detail simply omits it. Fired lazily, one package at a time.
 */
export async function fetchBundleSize(name: string): Promise<SizeSignals['bundle'] | undefined> {
  const cached = bundleCache.get(name)
  if (cached !== undefined) return cached ?? undefined

  const url = `${BUNDLEPHOBIA_ENDPOINT}?package=${encodeURIComponent(name)}`
  try {
    const res = await Promise.race([
      fetch(url, { headers: { accept: 'application/json', 'user-agent': 'siz-cli' } }),
      timeout(FETCH_TIMEOUT_MS, null),
    ])
    if (!res || !res.ok) {
      bundleCache.set(name, null)
      return undefined
    }
    const body = (await res.json()) as { gzip?: number; size?: number }
    if (typeof body?.gzip === 'number' && typeof body?.size === 'number') {
      const bundle = { gzip: body.gzip, minified: body.size }
      bundleCache.set(name, bundle)
      return bundle
    }
    bundleCache.set(name, null)
    return undefined
  } catch {
    bundleCache.set(name, null)
    return undefined
  }
}
