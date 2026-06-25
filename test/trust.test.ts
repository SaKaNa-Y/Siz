import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  computeMomentum,
  fetchDownloadTrend,
  fetchTrustSignals,
  formatPublishAge,
  isStale,
  parseReplacement,
  STALE_YEARS,
} from '../src/core/trust.ts'

// Mock the network layer. getLatestVersionBatch (metadata) returns a row per
// name keyed off the name so we can assert mapping, plus a PackageError for the
// missing package.
const batch = vi.fn(async (names: string[]) =>
  names.map((name) => {
    switch (name) {
      case 'dep-pkg':
        return { name, version: '1.0.0', publishedAt: '2024-01-01', deprecated: 'use foo instead' }
      case 'prov-pkg':
        return { name, version: '1.0.0', publishedAt: '2024-01-01', provenance: true }
      case 'trusted-pkg':
        return { name, version: '1.0.0', publishedAt: '2024-01-01', trustedPublisher: true }
      case 'plain-pkg':
        return { name, version: '1.0.0', publishedAt: '2024-01-01' }
      case 'memo-pkg':
        return { name, version: '1.0.0', publishedAt: '2024-01-01', provenance: true }
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
  it('maps deprecation, publish date, and provenance', async () => {
    const map = await fetchTrustSignals(['dep-pkg', 'plain-pkg'])
    expect(map.get('dep-pkg')).toEqual({
      deprecated: 'use foo instead',
      publishedAt: '2024-01-01',
      provenance: undefined,
      replacedBy: ['foo'],
    })
    expect(map.get('plain-pkg')).toEqual({
      deprecated: undefined,
      publishedAt: '2024-01-01',
      provenance: undefined,
    })
  })

  it('treats provenance OR trustedPublisher as provenance', async () => {
    const map = await fetchTrustSignals(['prov-pkg', 'trusted-pkg'])
    expect(map.get('prov-pkg')?.provenance).toBe(true)
    expect(map.get('trusted-pkg')?.provenance).toBe(true)
  })

  it('records registry errors as empty signals', async () => {
    const map = await fetchTrustSignals(['ghost'])
    expect(map.get('ghost')).toEqual({})
  })

  it('returns an empty map for no names (no request)', async () => {
    const map = await fetchTrustSignals([])
    expect(map.size).toBe(0)
    expect(batch).not.toHaveBeenCalled()
  })

  it('memoizes results so repeated names are not refetched', async () => {
    await fetchTrustSignals(['memo-pkg'])
    expect(batch).toHaveBeenCalledTimes(1)
    batch.mockClear()
    const map = await fetchTrustSignals(['memo-pkg'])
    expect(batch).not.toHaveBeenCalled()
    expect(map.get('memo-pkg')?.provenance).toBe(true)
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

describe('fetchDownloadTrend', () => {
  // weekly/monthly totals per package; null means "no data" from the endpoint.
  const downloads: Record<string, { week: number; month: number } | null> = {
    'rise-a': { week: 4000, month: 10000 },
    'fall-a': { week: 1000, month: 10000 },
    'flat-a': { week: 2333, month: 10000 },
    'null-a': null,
    'scope-peer': { week: 4000, month: 10000 },
    'memo-a': { week: 4000, month: 10000 },
  }

  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      const period = u.includes('/last-week/') ? 'week' : 'month'
      const names = u.split('/').pop()!.split(',')
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

  it('derives rising / falling verdicts and omits flat', async () => {
    const map = await fetchDownloadTrend(['rise-a', 'fall-a', 'flat-a'])
    expect(map.get('rise-a')).toEqual({ momentum: 'rising' })
    expect(map.get('fall-a')).toEqual({ momentum: 'falling' })
    expect(map.has('flat-a')).toBe(false)
  })

  it('skips scoped packages without requesting them', async () => {
    const map = await fetchDownloadTrend(['@scope/pkg', 'scope-peer'])
    expect(map.has('@scope/pkg')).toBe(false)
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('@scope')
    }
  })

  it('omits packages the endpoint has no data for', async () => {
    const map = await fetchDownloadTrend(['null-a'])
    expect(map.has('null-a')).toBe(false)
  })

  it('memoizes results so repeated names are not refetched', async () => {
    await fetchDownloadTrend(['memo-a'])
    expect(fetchMock).toHaveBeenCalled()
    fetchMock.mockClear()
    const map = await fetchDownloadTrend(['memo-a'])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(map.get('memo-a')).toEqual({ momentum: 'rising' })
  })

  it('degrades silently when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const map = await fetchDownloadTrend(['degrade-a'])
    expect(map.has('degrade-a')).toBe(false)
  })
})
