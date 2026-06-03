import { describe, expect, it, vi } from 'vitest'

import type { Bundle, BundlePackage } from '../src/core/types.ts'
import type { VersionInfo } from '../src/core/upgrade.ts'

/** Build a Bundle from a map of name → {strategy, depType}. */
function makeBundle(entries: Record<string, Omit<BundlePackage, 'name'>>): Bundle {
  const packages: Record<string, BundlePackage> = {}
  for (const [name, rest] of Object.entries(entries)) packages[name] = { name, ...rest }
  return { name: 'test', tags: [], packages, createdAt: '2024-01-01T00:00:00.000Z' }
}

// Mock only fetchVersionInfo; keep the real applyPrefix and everything else.
vi.mock('../src/core/upgrade.ts', async (importActual) => {
  const actual = await importActual<typeof import('../src/core/upgrade.ts')>()
  return {
    ...actual,
    fetchVersionInfo: vi.fn(async (names: string[]) => {
      const map = new Map<string, VersionInfo>()
      for (const name of names) {
        if (name === 'ghost') {
          map.set(name, { name, versions: [], latest: null, exists: false })
        } else if (name === 'tiny') {
          map.set(name, { name, versions: ['0.3.1'], latest: '0.3.1', exists: true })
        } else {
          map.set(name, { name, versions: ['18.2.0'], latest: '18.2.0', exists: true })
        }
      }
      return map
    }),
  }
})

const { resolveBundleInstall } = await import('../src/core/bundle.ts')

describe('resolveBundleInstall', () => {
  it('applies each version strategy to the resolved latest', async () => {
    const bundle = makeBundle({
      react: { strategy: 'caret', depType: 'dependencies' },
      vue: { strategy: 'tilde', depType: 'dependencies' },
      pin: { strategy: 'exact', depType: 'dependencies' },
      loose: { strategy: 'latest', depType: 'dependencies' },
    })

    const plan = await resolveBundleInstall(bundle)
    const spec = (name: string) => plan.items.find((i) => i.name === name)!.spec

    expect(spec('react')).toBe('react@^18.2.0')
    expect(spec('vue')).toBe('vue@~18.2.0')
    expect(spec('pin')).toBe('pin@18.2.0')
    expect(spec('loose')).toBe('loose') // latest defers to the package manager
    expect(plan.missing).toEqual([])
  })

  it('emits a 0.x version verbatim', async () => {
    const bundle = makeBundle({ tiny: { strategy: 'caret', depType: 'dependencies' } })
    const plan = await resolveBundleInstall(bundle)
    expect(plan.items[0].spec).toBe('tiny@^0.3.1')
  })

  it('falls back to a bare spec and flags packages not on npm', async () => {
    const bundle = makeBundle({ ghost: { strategy: 'caret', depType: 'dependencies' } })
    const plan = await resolveBundleInstall(bundle)
    expect(plan.items[0]).toMatchObject({ name: 'ghost', spec: 'ghost', missing: true })
    expect(plan.missing).toEqual(['ghost'])
  })
})
