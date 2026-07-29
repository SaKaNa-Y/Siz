/**
 * Shared access to the npm **packument** (`registry.npmjs.org/<pkg>/latest`) —
 * the one response that backs more than one result-signal family. Install size
 * reads `dist.unpackedSize` from it; the license signal reads `license`. Keeping
 * the fetch here means both families cost **one** request per package, not two.
 *
 * See ADR 0009.
 */

/** npm packument root; `/<pkg>/latest` returns the latest version's manifest. */
const REGISTRY_ENDPOINT = 'https://registry.npmjs.org'

/** How long to wait on the registry before giving up (per call). */
const FETCH_TIMEOUT_MS = 4000

/** Max concurrent packument requests — one per package, so bound the fan-out. */
const PACKUMENT_CONCURRENCY = 8

/**
 * The narrow slice of a version manifest siz actually reads. Deliberately a
 * projection rather than the whole body: a real packument carries full
 * dependency maps, and these are memoized for the life of the process.
 *
 * `license` is unusually undisciplined in the wild — the modern SPDX string, the
 * deprecated `{ type, url }` object, a bare array of either (e.g. `pause-stream`
 * ships `["MIT", "Apache2"]`), and the older top-level `licenses` array. Hence
 * the loose type; `normalizeLicense()` in ./license.ts collapses them all.
 */
export type LicenseField = string | { type?: string } | Array<string | { type?: string }>

export interface PackageManifest {
  license?: LicenseField
  licenses?: LicenseField
  dist?: { unpackedSize?: number }
}

/**
 * Session-scoped memo, keyed by package name. `null` means "we asked and the
 * request failed" — memoized so a dead registry is not re-hammered, and (more
 * importantly) so callers can tell *never resolved* apart from *resolved but
 * empty*. Manifests barely change; one fetch per package per process is plenty.
 */
const cache = new Map<string, PackageManifest | null>()

/** Resolve after `ms`, yielding `value`. Used to bound a slow network call. */
export function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => {
    // unref so a still-pending timer never keeps the process alive.
    setTimeout(() => resolve(value), ms).unref()
  })
}

/** Path-encode a package name (scoped `/` → `%2f`) for a registry URL. */
export function encodePackagePath(name: string): string {
  return name.startsWith('@') ? name.replace('/', '%2f') : name
}

/** Fetch one package's latest manifest; null on any failure (silent degrade). */
async function fetchOne(name: string): Promise<PackageManifest | null> {
  const url = `${REGISTRY_ENDPOINT}/${encodePackagePath(name)}/latest`
  try {
    const res = await Promise.race([
      fetch(url, { headers: { accept: 'application/json' } }),
      timeout(FETCH_TIMEOUT_MS, null),
    ])
    if (!res || !res.ok) return null
    const body = (await res.json()) as PackageManifest
    if (!body || typeof body !== 'object') return null
    // Project down to the fields we read, so the memo stays small.
    return { license: body.license, licenses: body.licenses, dist: body.dist }
  } catch {
    return null
  }
}

/**
 * Fetch the latest manifest for each name via the npm packument, one request per
 * package with bounded concurrency. Memoized per process and degrades silently,
 * so search is never blocked.
 *
 * A name appears in the returned map **iff its packument resolved**. That
 * distinction is load-bearing: it is how a caller tells "the package declares no
 * license" (entry present, field empty) from "we never found out" (no entry).
 */
export async function fetchManifests(names: string[]): Promise<Map<string, PackageManifest>> {
  const missing = names.filter((name) => !cache.has(name))

  let index = 0
  const worker = async (): Promise<void> => {
    while (index < missing.length) {
      const name = missing[index++]
      // Sequential by design: N workers each drain one at a time, so the pool
      // caps concurrency at PACKUMENT_CONCURRENCY rather than firing all at once.
      // eslint-disable-next-line no-await-in-loop
      cache.set(name, await fetchOne(name))
    }
  }
  await Promise.all(Array.from({ length: Math.min(PACKUMENT_CONCURRENCY, missing.length) }, worker))

  const out = new Map<string, PackageManifest>()
  for (const name of names) {
    const manifest = cache.get(name)
    if (manifest) out.set(name, manifest)
  }
  return out
}
