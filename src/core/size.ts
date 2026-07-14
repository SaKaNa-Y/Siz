import type { SizeSignals } from './types.ts'

/**
 * Install size at or above this many bytes renders a `heavy` glyph. Editorial,
 * like {@link import('./trust.ts').STALE_YEARS} — a tunable prompt to look
 * closer, and the "heavy" notion the planned lighter-alternative feature reuses.
 */
export const HEAVY_INSTALL_BYTES = 1024 * 1024

/** How long to wait on a size endpoint before giving up (per call). */
const FETCH_TIMEOUT_MS = 4000

/** Max concurrent packument requests — one per package, so bound the fan-out. */
const INSTALL_CONCURRENCY = 8

/** npm packument root; `/<pkg>/latest` returns the latest version's manifest. */
const REGISTRY_ENDPOINT = 'https://registry.npmjs.org'

/** Bundlephobia's size API (min + gzip of a package plus its deps). */
const BUNDLEPHOBIA_ENDPOINT = 'https://bundlephobia.com/api/size'

/**
 * Session-scoped memo of install sizes, keyed by package name. `null` means
 * "fetched, but no size available" (so it is not re-requested). Sizes barely
 * change, so one fetch per package per process is plenty.
 */
const installCache = new Map<string, number | null>()

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

/** Resolve after `ms`, yielding `value`. Used to bound a slow network call. */
function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    // unref so a still-pending timer never keeps the process alive.
    setTimeout(() => resolve(value), ms).unref()
  })
}

/** Path-encode a package name (scoped `/` → `%2f`) for a registry URL. */
function encodePackagePath(name: string): string {
  return name.startsWith('@') ? name.replace('/', '%2f') : name
}

/** Fetch one package's `dist.unpackedSize`; null on any failure (silent degrade). */
async function fetchOneInstallSize(name: string): Promise<number | null> {
  const url = `${REGISTRY_ENDPOINT}/${encodePackagePath(name)}/latest`
  try {
    const res = await Promise.race([
      fetch(url, { headers: { accept: 'application/json' } }),
      timeout(FETCH_TIMEOUT_MS, null),
    ])
    if (!res || !res.ok) return null
    const body = (await res.json()) as { dist?: { unpackedSize?: number } }
    const size = body?.dist?.unpackedSize
    return typeof size === 'number' && size >= 0 ? size : null
  } catch {
    return null
  }
}

/**
 * Fetch install sizes (own unpacked bytes) for the given package names via the
 * npm packument, one request per package with bounded concurrency. Memoized per
 * process and degrades silently on any failure, so search is never blocked.
 * Only names with a known size appear in the returned map.
 */
export async function fetchInstallSizes(names: string[]): Promise<Map<string, number>> {
  const missing = names.filter((name) => !installCache.has(name))

  let index = 0
  const worker = async (): Promise<void> => {
    while (index < missing.length) {
      const name = missing[index++]
      // Sequential by design: N workers each drain one at a time, so the pool
      // caps concurrency at INSTALL_CONCURRENCY rather than firing all at once.
      // eslint-disable-next-line no-await-in-loop
      installCache.set(name, await fetchOneInstallSize(name))
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(INSTALL_CONCURRENCY, missing.length) }, worker),
  )

  const out = new Map<string, number>()
  for (const name of names) {
    const size = installCache.get(name)
    if (typeof size === 'number') out.set(name, size)
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
