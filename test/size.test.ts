import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchBundleSize,
  fetchInstallSizes,
  formatBytes,
  HEAVY_INSTALL_BYTES,
  isHeavy,
} from '../src/core/size.ts'

describe('formatBytes', () => {
  it('formats bytes, kB, MB, and GB', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(340_000)).toBe('340 kB')
    expect(formatBytes(680_000)).toBe('680 kB')
    expect(formatBytes(1_400_000)).toBe('1.4 MB')
    expect(formatBytes(4_400_000)).toBe('4.4 MB')
    expect(formatBytes(2_500_000_000)).toBe('2.5 GB')
  })

  it('returns "" for missing or invalid input', () => {
    expect(formatBytes(undefined)).toBe('')
    expect(formatBytes(-1)).toBe('')
    expect(formatBytes(Number.NaN)).toBe('')
  })
})

describe('isHeavy', () => {
  it('flags sizes at or above the threshold', () => {
    expect(isHeavy(HEAVY_INSTALL_BYTES)).toBe(true)
    expect(isHeavy(HEAVY_INSTALL_BYTES + 1)).toBe(true)
  })

  it('does not flag sizes below the threshold or unknown sizes', () => {
    expect(isHeavy(HEAVY_INSTALL_BYTES - 1)).toBe(false)
    expect(isHeavy(0)).toBe(false)
    expect(isHeavy(undefined)).toBe(false)
  })
})

describe('fetchInstallSizes', () => {
  // Install size now derives from the shared packument layer (core/packument.ts),
  // which both this signal and the license signal read — so these cases exercise
  // that layer's fetch, cache, and degrade behavior through the size façade.
  // dist.unpackedSize per package name; undefined means "manifest has no size".
  const sizes: Record<string, number | undefined> = {
    'small-pkg': 340_000,
    'big-pkg': 4_400_000,
    'nosize-pkg': undefined,
    'memo-size': 340_000,
    '@scope/pkg': 500_000,
  }

  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      const match = u.match(/registry\.npmjs\.org\/(.+)\/latest$/)
      const name = match ? decodeURIComponent(match[1].replace('%2f', '/')) : ''
      if (name === 'err-pkg') return { ok: false } as unknown as Response
      const size = sizes[name]
      return {
        ok: true,
        json: async () => (size === undefined ? { dist: {} } : { dist: { unpackedSize: size } }),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps dist.unpackedSize per package', async () => {
    const map = await fetchInstallSizes(['small-pkg', 'big-pkg'])
    expect(map.get('small-pkg')).toBe(340_000)
    expect(map.get('big-pkg')).toBe(4_400_000)
  })

  it('omits packages whose manifest has no unpackedSize', async () => {
    const map = await fetchInstallSizes(['nosize-pkg'])
    expect(map.has('nosize-pkg')).toBe(false)
  })

  it('path-encodes scoped names', async () => {
    await fetchInstallSizes(['@scope/pkg'])
    expect(String(fetchMock.mock.calls[0][0])).toContain('@scope%2fpkg')
  })

  it('degrades silently on a non-ok response', async () => {
    const map = await fetchInstallSizes(['err-pkg'])
    expect(map.has('err-pkg')).toBe(false)
  })

  it('degrades silently when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const map = await fetchInstallSizes(['throw-pkg'])
    expect(map.has('throw-pkg')).toBe(false)
  })

  it('memoizes results so repeated names are not refetched', async () => {
    await fetchInstallSizes(['memo-size'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockClear()
    const map = await fetchInstallSizes(['memo-size'])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(map.get('memo-size')).toBe(340_000)
  })

  it('returns an empty map for no names (no request)', async () => {
    const map = await fetchInstallSizes([])
    expect(map.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('fetchBundleSize', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('package=good-bundle'))
        return { ok: true, json: async () => ({ gzip: 2500, size: 8000 }) } as unknown as Response
      if (u.includes('package=partial-bundle'))
        return { ok: true, json: async () => ({ size: 8000 }) } as unknown as Response
      return { ok: false } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses gzip + minified size', async () => {
    expect(await fetchBundleSize('good-bundle')).toEqual({ gzip: 2500, minified: 8000 })
  })

  it('returns undefined when fields are missing', async () => {
    expect(await fetchBundleSize('partial-bundle')).toBeUndefined()
  })

  it('degrades silently on a non-ok response', async () => {
    expect(await fetchBundleSize('missing-bundle')).toBeUndefined()
  })

  it('degrades silently when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    expect(await fetchBundleSize('throw-bundle')).toBeUndefined()
  })

  it('memoizes results so a repeated name is not refetched', async () => {
    await fetchBundleSize('good-bundle')
    fetchMock.mockClear()
    expect(await fetchBundleSize('good-bundle')).toEqual({ gzip: 2500, minified: 8000 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
