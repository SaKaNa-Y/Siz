import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchVersionInfo } from '../src/core/compare.ts'

// Mock the network layer: getVersionsBatch returns a mix of found packages and
// a PackageError (404) so we can assert the mapping in fetchVersionInfo.
vi.mock('fast-npm-meta', () => ({
  getVersionsBatch: vi.fn(async (names: string[]) =>
    names.map((name) =>
      name === 'ghost'
        ? { status: 404, name, error: 'Not found' }
        : { name, distTags: { latest: '2.0.0' }, versions: ['1.0.0', '1.5.0', '2.0.0'] },
    ),
  ),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('fetchVersionInfo', () => {
  it('maps versions + dist-tag latest for found packages', async () => {
    const map = await fetchVersionInfo(['vue'])
    const vue = map.get('vue')
    expect(vue).toEqual({
      name: 'vue',
      versions: ['1.0.0', '1.5.0', '2.0.0'],
      latest: '2.0.0',
      exists: true,
    })
  })

  it('marks registry errors as exists:false', async () => {
    const map = await fetchVersionInfo(['ghost'])
    expect(map.get('ghost')).toEqual({ name: 'ghost', versions: [], latest: null, exists: false })
  })

  it('returns an empty map for no names (no request)', async () => {
    expect((await fetchVersionInfo([])).size).toBe(0)
  })
})
