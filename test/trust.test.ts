import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchLicenses } from '../src/core/license.ts'
import { fetchInstallSizes } from '../src/core/size.ts'
import {
  computeMomentum,
  fetchDownloadSignals,
  fetchTrustSignals,
  formatDownloads,
  formatPublishAge,
  isStale,
  parseReplacement,
  STALE_YEARS,
} from '../src/core/trust.ts'

// Mock the metadata batch. It is now consulted for the publish date only — the
// rows still carry deprecated/provenance the way fast-npm-meta does, precisely
// so the tests can assert those are *ignored* in favour of the packument.
const batch = vi.fn(async (names: string[]) =>
  names.map((name) => {
    switch (name) {
      case 'meta-only-pkg':
        return {
          name,
          version: '1.0.0',
          publishedAt: '2024-01-01',
          deprecated: 'use ghost-successor instead',
          trustedPublisher: true,
        }
      case 'ghost':
        return { status: 404, name, error: 'Not found' }
      default:
        return { name, version: '1.0.0', publishedAt: '2024-01-01' }
    }
  }),
)

vi.mock('fast-npm-meta', () => ({
  getLatestVersionBatch: (names: string[]) => batch(names),
}))

afterEach(() => {
  batch.mockClear()
})

const NOW = Date.parse('2026-06-19T00:00:00Z')
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

describe('isStale', () => {
  it('flags publishes older than the stale threshold', () => {
    const old = new Date(NOW - (STALE_YEARS + 0.5) * YEAR_MS).toISOString()
    expect(isStale(old, NOW)).toBe(true)
  })

  it('does not flag recent publishes', () => {
    const recent = new Date(NOW - 0.5 * YEAR_MS).toISOString()
    expect(isStale(recent, NOW)).toBe(false)
  })

  it('treats just-under the threshold as fresh', () => {
    const justUnder = new Date(NOW - (STALE_YEARS * YEAR_MS - 1000)).toISOString()
    expect(isStale(justUnder, NOW)).toBe(false)
  })

  it('returns false for undefined or unparseable dates', () => {
    expect(isStale(undefined, NOW)).toBe(false)
    expect(isStale('not-a-date', NOW)).toBe(false)
  })
})

describe('formatPublishAge', () => {
  it('formats years', () => {
    const fourYears = new Date(NOW - 4 * YEAR_MS).toISOString()
    expect(formatPublishAge(fourYears, NOW)).toBe('published 4y ago')
  })

  it('formats months', () => {
    const fiveMonths = new Date(NOW - 5 * (YEAR_MS / 12)).toISOString()
    expect(formatPublishAge(fiveMonths, NOW)).toBe('published 5mo ago')
  })

  it('handles this-month and unknown dates', () => {
    expect(formatPublishAge(new Date(NOW).toISOString(), NOW)).toBe('published this month')
    expect(formatPublishAge(undefined, NOW)).toBe('')
  })
})

describe('formatDownloads', () => {
  it('prints counts under a thousand verbatim', () => {
    expect(formatDownloads(0)).toBe('0')
    expect(formatDownloads(812)).toBe('812')
    expect(formatDownloads(999)).toBe('999')
  })

  it('keeps one decimal in the noisy 1k–10k band', () => {
    expect(formatDownloads(1000)).toBe('1k')
    expect(formatDownloads(1500)).toBe('1.5k')
    expect(formatDownloads(9949)).toBe('9.9k')
  })

  it('rounds thousands whole above 10k', () => {
    expect(formatDownloads(10_400)).toBe('10k')
    expect(formatDownloads(340_500)).toBe('341k')
  })

  it('switches to millions and billions', () => {
    expect(formatDownloads(1_000_000)).toBe('1M')
    expect(formatDownloads(12_340_000)).toBe('12.3M')
    expect(formatDownloads(2_500_000_000)).toBe('2.5B')
  })

  it('returns an empty string for missing or invalid counts, never a zero', () => {
    expect(formatDownloads(undefined)).toBe('')
    expect(formatDownloads(Number.NaN)).toBe('')
    expect(formatDownloads(-1)).toBe('')
  })
})

describe('parseReplacement', () => {
  it('extracts a bare name after "use ... instead"', () => {
    expect(parseReplacement('use foo instead', 'old-pkg')).toEqual(['foo'])
  })

  it('extracts a back-tick-quoted name', () => {
    expect(parseReplacement('This package is deprecated. Use `got` instead.', 'request')).toEqual([
      'got',
    ])
  })

  it('extracts multiple quoted names from an enumeration', () => {
    expect(parseReplacement('use `date-fns` or `dayjs` instead', 'moment')).toEqual([
      'date-fns',
      'dayjs',
    ])
  })

  it('handles "replaced by", "migrate to", and scoped names', () => {
    expect(parseReplacement('Replaced by `@scope/new-pkg`.', 'old')).toEqual(['@scope/new-pkg'])
    expect(parseReplacement('Please migrate to undici.', 'node-fetch')).toEqual(['undici'])
  })

  it('extracts a name from an npmjs.com package URL', () => {
    expect(
      parseReplacement('Deprecated. See https://www.npmjs.com/package/fast-glob', 'glob-pkg'),
    ).toEqual(['fast-glob'])
  })

  it('excludes the package’s own name', () => {
    expect(parseReplacement('use lodash instead', 'lodash')).toEqual([])
  })

  it('ignores version-only messages', () => {
    expect(parseReplacement('Deprecated, please upgrade to v3', 'pkg')).toEqual([])
    expect(parseReplacement('use ^2.0.0 instead', 'pkg')).toEqual([])
  })

  it('returns [] when no successor is named (moment-style) or message is empty', () => {
    expect(
      parseReplacement(
        'We now generally consider this to be a legacy project in maintenance mode.',
        'moment',
      ),
    ).toEqual([])
    expect(parseReplacement(undefined, 'pkg')).toEqual([])
    expect(parseReplacement('', 'pkg')).toEqual([])
  })

  it('does not grab bare prose after an enumeration separator', () => {
    // "foo" is the trusted first token; the bare "we" continuation is dropped.
    expect(parseReplacement('use foo and we recommend checking the docs', 'old')).toEqual(['foo'])
  })

  it('de-duplicates repeated suggestions', () => {
    expect(parseReplacement('Use `got`. Migrate to got.', 'request')).toEqual(['got'])
  })
})

describe('fetchTrustSignals', () => {
  // Deprecation and provenance come from the packument siz already fetches for
  // every row; only the publish date still comes from the metadata batch. These
  // bodies are the packument side — 'error' means the request fails.
  const attested = { url: 'https://registry.npmjs.org/-/npm/v1/attestations/p@1.0.0' }
  const manifests: Record<string, Record<string, unknown> | 'error'> = {
    'dep-pkg': { deprecated: 'use foo instead' },
    'plain-pkg': { dist: {} },
    'prov-pkg': { dist: { attestations: attested } },
    'memo-pkg': { dist: { attestations: attested } },
    // Packument unreachable, so only the metadata batch has anything to say —
    // and what it says about deprecation/provenance is deliberately ignored.
    'meta-only-pkg': 'error',
    ghost: 'error',
  }

  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      const match = String(url).match(/registry\.npmjs\.org\/(.+)\/latest$/)
      const name = match ? decodeURIComponent(match[1].replace('%2f', '/')) : ''
      const body = manifests[name]
      if (!body || body === 'error') return { ok: false } as unknown as Response
      return { ok: true, json: async () => body } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('derives deprecation from the packument and the age from the metadata batch', async () => {
    const map = await fetchTrustSignals(['dep-pkg', 'plain-pkg'])
    expect(map.get('dep-pkg')).toEqual({
      deprecated: 'use foo instead',
      publishedAt: '2024-01-01',
      replacedBy: ['foo'],
    })
    expect(map.get('plain-pkg')).toEqual({ publishedAt: '2024-01-01' })
  })

  it('derives provenance from a distribution attestation, and only from that', async () => {
    const map = await fetchTrustSignals(['prov-pkg', 'plain-pkg'])
    expect(map.get('prov-pkg')?.provenance).toBe(true)
    // Positive-only: no attestation means the mark is simply absent.
    expect(map.get('plain-pkg')?.provenance).toBeUndefined()
  })

  it('ignores the metadata batch’s own deprecation and trusted-publisher fields', async () => {
    const map = await fetchTrustSignals(['meta-only-pkg'])
    // The batch row carries `deprecated` and `trustedPublisher`; neither is read
    // any more, so all that survives from it is the publish date.
    expect(map.get('meta-only-pkg')).toEqual({ publishedAt: '2024-01-01' })
  })

  it('records a package neither source knows about as empty signals', async () => {
    const map = await fetchTrustSignals(['ghost'])
    expect(map.get('ghost')).toEqual({})
  })

  it('keeps the age when the packument fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('registry down')
      }),
    )
    const map = await fetchTrustSignals(['degrade-packument'])
    expect(map.get('degrade-packument')).toEqual({ publishedAt: '2024-01-01' })
  })

  it('keeps deprecation and provenance when the metadata batch fails', async () => {
    batch.mockImplementationOnce(async () => {
      throw new Error('metadata down')
    })
    manifests['degrade-meta'] = { deprecated: 'use foo instead', dist: { attestations: attested } }
    const map = await fetchTrustSignals(['degrade-meta'])
    expect(map.get('degrade-meta')).toEqual({
      deprecated: 'use foo instead',
      replacedBy: ['foo'],
      provenance: true,
    })
  })

  it('returns an empty map for no names (no request)', async () => {
    const map = await fetchTrustSignals([])
    expect(map.size).toBe(0)
    expect(batch).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('memoizes both sources so repeated names are not refetched', async () => {
    await fetchTrustSignals(['memo-pkg'])
    expect(batch).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    batch.mockClear()
    fetchMock.mockClear()
    const map = await fetchTrustSignals(['memo-pkg'])
    expect(batch).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(map.get('memo-pkg')?.provenance).toBe(true)
  })
})

describe('packument sharing across signal families', () => {
  it('costs one request when trust, size and license are fetched in the same tick', async () => {
    // The whole point of sourcing deprecation and provenance from the packument
    // is that siz already fetches it. All three families start together (see
    // commands/search.ts), so the memo has to dedupe the *in-flight* request —
    // a value-only memo would have each of them miss and buy its own copy.
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            license: 'MIT',
            deprecated: 'use foo instead',
            dist: { unpackedSize: 1234, attestations: { url: 'u' } },
          }),
        }) as unknown as Response,
    )
    vi.stubGlobal('fetch', fetchMock)

    const [trust, sizes, licenses] = await Promise.all([
      fetchTrustSignals(['shared-pkg']),
      fetchInstallSizes(['shared-pkg']),
      fetchLicenses(['shared-pkg']),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(trust.get('shared-pkg')).toEqual({
      deprecated: 'use foo instead',
      replacedBy: ['foo'],
      provenance: true,
      publishedAt: '2024-01-01',
    })
    expect(sizes.get('shared-pkg')).toBe(1234)
    expect(licenses.get('shared-pkg')).toEqual({ license: 'MIT' })
    vi.unstubAllGlobals()
  })
})

describe('computeMomentum', () => {
  it('flags a clear rise', () => {
    // weekly 4000 → 571/day vs baseline (10000-4000)/23 ≈ 261/day → +119%
    expect(computeMomentum(4000, 10000)).toBe('rising')
  })

  it('flags a clear fall', () => {
    // weekly 1000 → 143/day vs baseline (10000-1000)/23 ≈ 391/day → -63%
    expect(computeMomentum(1000, 10000)).toBe('falling')
  })

  it('returns undefined for an even (flat) distribution', () => {
    // ~333/day either way → within ±20% threshold
    expect(computeMomentum(2333, 10000)).toBeUndefined()
  })

  it('suppresses below the volume floor even on a huge swing', () => {
    // 400/week on 500/month would be a big % rise, but it is too noisy to trust
    expect(computeMomentum(400, 500)).toBeUndefined()
  })

  it('guards divide-by-zero when the whole month is the recent week', () => {
    expect(computeMomentum(2000, 2000)).toBeUndefined()
  })
})

describe('fetchDownloadSignals', () => {
  // weekly/monthly totals per package; null means "no data" from the endpoint.
  const downloads: Record<string, { week: number; month: number } | null> = {
    'rise-a': { week: 4000, month: 10000 },
    'fall-a': { week: 1000, month: 10000 },
    'flat-a': { week: 2333, month: 10000 },
    'null-a': null,
    '@scope/pkg': { week: 4000, month: 10000 },
    'memo-a': { week: 4000, month: 10000 },
    'once-a': { week: 4000, month: 10000 },
    'once-b': { week: 1000, month: 10000 },
    'lone-a': { week: 4000, month: 10000 },
  }

  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      const period = u.includes('/last-week/') ? 'week' : 'month'
      const tail = u.slice(u.indexOf(`/${period === 'week' ? 'last-week' : 'last-month'}/`))
      const names = tail.split('/').slice(2).join('/').split(',')
      // npm picks its response shape by name count, not by URL: one name gets a
      // bare object, two or more get a name-keyed map. Mirror both, so the
      // normalization in fetchPoint is exercised for real.
      if (names.length === 1) {
        const d = downloads[names[0]]
        if (!d) return { ok: false } as unknown as Response
        return { ok: true, json: async () => ({ downloads: d[period] }) } as unknown as Response
      }
      const body: Record<string, { downloads: number } | null> = {}
      for (const name of names) {
        const d = downloads[name]
        body[name] = d ? { downloads: d[period] } : null
      }
      return { ok: true, json: async () => body } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('derives rising / falling verdicts and keeps the weekly count either way', async () => {
    const map = await fetchDownloadSignals(['rise-a', 'fall-a', 'flat-a'])
    expect(map.get('rise-a')).toEqual({ downloads: 4000, momentum: 'rising' })
    expect(map.get('fall-a')).toEqual({ downloads: 1000, momentum: 'falling' })
    // Flat is no longer dropped: the arrow is suppressed, the count survives.
    expect(map.get('flat-a')).toEqual({ downloads: 2333 })
  })

  it('retains the count for unscoped names without an extra request', async () => {
    await fetchDownloadSignals(['once-a', 'once-b'])
    // Exactly two bulk calls (last-week + last-month) for the whole chunk.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives scoped packages a count via the single-package endpoint, but no arrow', async () => {
    const map = await fetchDownloadSignals(['@scope/pkg'])
    expect(map.get('@scope/pkg')).toEqual({ downloads: 4000 })
    expect(map.get('@scope/pkg')?.momentum).toBeUndefined()
    // One call, last-week only — the monthly baseline is never requested.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/last-week/@scope/pkg')
  })

  it('reads the bare single-package shape a one-name request comes back in', async () => {
    // npm answers a one-name "bulk" request with { downloads } rather than a
    // name-keyed map; before it was normalized, a lone unscoped result — the last
    // chunk of any odd-sized search — silently lost both its count and its arrow.
    const map = await fetchDownloadSignals(['lone-a'])
    expect(map.get('lone-a')).toEqual({ downloads: 4000, momentum: 'rising' })
  })

  it('omits packages the endpoint has no data for', async () => {
    const map = await fetchDownloadSignals(['null-a'])
    expect(map.has('null-a')).toBe(false)
  })

  it('memoizes results so repeated names are not refetched', async () => {
    await fetchDownloadSignals(['memo-a'])
    expect(fetchMock).toHaveBeenCalled()
    fetchMock.mockClear()
    const map = await fetchDownloadSignals(['memo-a'])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(map.get('memo-a')).toEqual({ downloads: 4000, momentum: 'rising' })
  })

  it('degrades silently when the download source fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const map = await fetchDownloadSignals(['degrade-a', '@degrade/scoped'])
    expect(map.has('degrade-a')).toBe(false)
    expect(map.has('@degrade/scoped')).toBe(false)
  })
})
