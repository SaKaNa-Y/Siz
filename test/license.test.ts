import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchLicenses,
  formatLicense,
  isUnclearLicense,
  LICENSE_INLINE_MAX,
  normalizeLicense,
  truncateLicense,
} from '../src/core/license.ts'
import { fetchInstallSizes } from '../src/core/size.ts'

describe('normalizeLicense', () => {
  it('reads the modern SPDX string', () => {
    expect(normalizeLicense({ license: 'MIT' })).toBe('MIT')
    expect(normalizeLicense({ license: '(MIT OR Apache-2.0)' })).toBe('(MIT OR Apache-2.0)')
    expect(normalizeLicense({ license: '  MIT  ' })).toBe('MIT')
  })

  it('reads the deprecated object form', () => {
    expect(normalizeLicense({ license: { type: 'MIT' } })).toBe('MIT')
    expect(normalizeLicense({ license: { type: 'BSD-3-Clause' } })).toBe('BSD-3-Clause')
  })

  it('reads the older licenses[] array, joining multiple with OR', () => {
    expect(normalizeLicense({ licenses: [{ type: 'MIT' }] })).toBe('MIT')
    expect(normalizeLicense({ licenses: [{ type: 'MIT' }, { type: 'GPL-2.0' }] })).toBe(
      'MIT OR GPL-2.0',
    )
  })

  it('reads a bare string array under `license`', () => {
    // Real shape in the wild: `pause-stream` ships ["MIT", "Apache2"]. Missing
    // this reported a plainly-licensed package as having no license.
    expect(normalizeLicense({ license: ['MIT', 'Apache2'] })).toBe('MIT OR Apache2')
    expect(normalizeLicense({ license: ['MIT'] })).toBe('MIT')
  })

  it('reads an object array under `license`', () => {
    expect(normalizeLicense({ license: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe(
      'MIT OR Apache-2.0',
    )
  })

  it('reads a bare string under the legacy `licenses` key', () => {
    expect(normalizeLicense({ licenses: 'MIT' })).toBe('MIT')
  })

  it('prefers `license` over the legacy `licenses` array', () => {
    expect(normalizeLicense({ license: 'MIT', licenses: [{ type: 'GPL-2.0' }] })).toBe('MIT')
  })

  it('returns null when nothing is declared', () => {
    expect(normalizeLicense({})).toBeNull()
    expect(normalizeLicense({ license: '' })).toBeNull()
    expect(normalizeLicense({ license: '   ' })).toBeNull()
    expect(normalizeLicense({ license: {} })).toBeNull()
    expect(normalizeLicense({ licenses: [] })).toBeNull()
    expect(normalizeLicense({ licenses: [{}] })).toBeNull()
    expect(normalizeLicense({ license: [] })).toBeNull()
    expect(normalizeLicense({ license: ['', '  '] })).toBeNull()
  })

  it('keeps UNLICENSED as a declared value, not as absence', () => {
    // It is a real declaration ("no rights granted"), distinct from a missing
    // field — isUnclearLicense is what folds them together for display.
    expect(normalizeLicense({ license: 'UNLICENSED' })).toBe('UNLICENSED')
  })
})

describe('isUnclearLicense', () => {
  it('flags values that cannot be resolved from metadata', () => {
    expect(isUnclearLicense(null)).toBe(true)
    expect(isUnclearLicense('')).toBe(true)
    expect(isUnclearLicense('UNLICENSED')).toBe(true)
    expect(isUnclearLicense('unlicensed')).toBe(true)
    expect(isUnclearLicense('SEE LICENSE IN LICENSE.md')).toBe(true)
    expect(isUnclearLicense('see license in ./COMMERCIAL.txt')).toBe(true)
  })

  it('does not confuse the SPDX id `Unlicense` with npm’s `UNLICENSED`', () => {
    // `Unlicense` is a public-domain dedication — the near-opposite of
    // UNLICENSED's "no rights granted". Real packages use it (e.g. tweetnacl),
    // so a substring or prefix match here would badly misreport them.
    expect(isUnclearLicense('Unlicense')).toBe(false)
    expect(isUnclearLicense('unlicense')).toBe(false)
    expect(formatLicense('Unlicense')).toBe('Unlicense')
  })

  it('does not flag resolvable licenses, permissive or not', () => {
    expect(isUnclearLicense('MIT')).toBe(false)
    expect(isUnclearLicense('Apache-2.0')).toBe(false)
    // No editorial judgement: copyleft is perfectly clear.
    expect(isUnclearLicense('GPL-3.0-only')).toBe(false)
    expect(isUnclearLicense('AGPL-3.0-or-later')).toBe(false)
    expect(isUnclearLicense('(MIT OR Apache-2.0)')).toBe(false)
  })
})

describe('formatLicense', () => {
  it('labels absence and the file escape hatch', () => {
    expect(formatLicense(null)).toBe('no license')
    expect(formatLicense('')).toBe('no license')
    expect(formatLicense('SEE LICENSE IN LICENSE.md')).toBe('see LICENSE file')
  })

  it('passes everything else through verbatim', () => {
    expect(formatLicense('MIT')).toBe('MIT')
    expect(formatLicense('UNLICENSED')).toBe('UNLICENSED')
    expect(formatLicense('GPL-3.0-only')).toBe('GPL-3.0-only')
  })
})

describe('truncateLicense', () => {
  it('leaves real SPDX ids intact', () => {
    // The longest common id is 17 chars, under the 18-char budget.
    expect('AGPL-3.0-or-later'.length).toBeLessThanOrEqual(LICENSE_INLINE_MAX)
    expect(truncateLicense('AGPL-3.0-or-later')).toBe('AGPL-3.0-or-later')
    expect(truncateLicense('MIT')).toBe('MIT')
  })

  it('clips long expressions with an ellipsis', () => {
    const clipped = truncateLicense('(MIT OR Apache-2.0 OR GPL-2.0-only)')
    expect(clipped).toHaveLength(LICENSE_INLINE_MAX)
    expect(clipped.endsWith('…')).toBe(true)
  })
})

describe('fetchLicenses', () => {
  // Manifest body per package name; `null` means the request fails.
  const manifests: Record<string, unknown> = {
    'lic-mit': { license: 'MIT', dist: { unpackedSize: 1000 } },
    'lic-object': { license: { type: 'MIT', url: 'http://example.com' } },
    'lic-array': { licenses: [{ type: 'MIT' }, { type: 'GPL-2.0' }] },
    'lic-none': { dist: { unpackedSize: 1000 } },
    'lic-unlicensed': { license: 'UNLICENSED' },
    'lic-seefile': { license: 'SEE LICENSE IN LICENSE.md' },
    'lic-memo': { license: 'MIT' },
    'lic-shared': { license: 'MIT', dist: { unpackedSize: 2000 } },
    '@lic/scoped': { license: 'ISC' },
  }

  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      const u = String(url)
      const match = u.match(/registry\.npmjs\.org\/(.+)\/latest$/)
      const name = match ? decodeURIComponent(match[1].replace('%2f', '/')) : ''
      const body = manifests[name]
      if (!body) return { ok: false } as unknown as Response
      return { ok: true, json: async () => body } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps the declared license per package', async () => {
    const map = await fetchLicenses(['lic-mit', 'lic-object', 'lic-array'])
    expect(map.get('lic-mit')).toEqual({ license: 'MIT' })
    expect(map.get('lic-object')).toEqual({ license: 'MIT' })
    expect(map.get('lic-array')).toEqual({ license: 'MIT OR GPL-2.0' })
  })

  it('reports null — not absence — when the manifest declares no license', async () => {
    const map = await fetchLicenses(['lic-none'])
    expect(map.has('lic-none')).toBe(true)
    expect(map.get('lic-none')).toEqual({ license: null })
  })

  it('keeps npm’s two escape hatches as declared strings', async () => {
    const map = await fetchLicenses(['lic-unlicensed', 'lic-seefile'])
    expect(map.get('lic-unlicensed')).toEqual({ license: 'UNLICENSED' })
    expect(map.get('lic-seefile')).toEqual({ license: 'SEE LICENSE IN LICENSE.md' })
  })

  it('omits the package entirely when the packument never resolved', async () => {
    // The load-bearing invariant: unknown must not be representable as
    // `{ license: null }`, or one slow network call flags every result as
    // having no license. See ADR 0009.
    const map = await fetchLicenses(['lic-missing'])
    expect(map.has('lic-missing')).toBe(false)
  })

  it('omits the package when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const map = await fetchLicenses(['lic-throws'])
    expect(map.has('lic-throws')).toBe(false)
  })

  it('path-encodes scoped names', async () => {
    await fetchLicenses(['@lic/scoped'])
    expect(String(fetchMock.mock.calls[0][0])).toContain('@lic%2fscoped')
  })

  it('memoizes results so repeated names are not refetched', async () => {
    await fetchLicenses(['lic-memo'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockClear()
    const map = await fetchLicenses(['lic-memo'])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(map.get('lic-memo')).toEqual({ license: 'MIT' })
  })

  it('returns an empty map for no names (no request)', async () => {
    const map = await fetchLicenses([])
    expect(map.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shares one packument request with the install-size signal', async () => {
    // Both families derive from the same memoized manifest, so enabling the
    // license signal must not double registry traffic.
    const sizes = await fetchInstallSizes(['lic-shared'])
    const licenses = await fetchLicenses(['lic-shared'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sizes.get('lic-shared')).toBe(2000)
    expect(licenses.get('lic-shared')).toEqual({ license: 'MIT' })
  })
})
