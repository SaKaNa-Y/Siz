import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchTrustSignals, formatPublishAge, isStale, STALE_YEARS } from '../src/core/trust.ts'

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

describe('fetchTrustSignals', () => {
  it('maps deprecation, publish date, and provenance', async () => {
    const map = await fetchTrustSignals(['dep-pkg', 'plain-pkg'])
    expect(map.get('dep-pkg')).toEqual({
      deprecated: 'use foo instead',
      publishedAt: '2024-01-01',
      provenance: undefined,
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
