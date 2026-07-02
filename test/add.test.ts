import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runInstallSelections } from '../src/commands/install-runner.ts'
import { resolveLatest } from '../src/core/meta.ts'
import { addFavorite, addToBundle } from '../src/core/store.ts'

// Mock the store, version resolver, install runner, and prompts so runAdd's mode
// dispatch can be asserted without touching the real data store or the network.
vi.mock('../src/core/store.ts', () => ({
  addToBundle: vi.fn(),
  addFavorite: vi.fn((p: { name: string; version?: string; category?: string }) => ({
    ...p,
    addedAt: 'x',
  })),
}))

vi.mock('../src/core/meta.ts', () => ({
  resolveLatest: vi.fn(async (name: string) => ({ name, version: '1.0.0', exists: true })),
}))

vi.mock('../src/commands/install-runner.ts', () => ({
  runInstallSelections: vi.fn(async () => {}),
}))

vi.mock('../src/ui/prompts.ts', () => ({ clack: { intro: vi.fn(), outro: vi.fn() } }))

const { runAdd } = await import('../src/commands/add.ts')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runAdd mode dispatch', () => {
  it('rejects --fav together with --bundle', async () => {
    await expect(runAdd(['react'], { fav: true, bundle: 'x' })).rejects.toThrow(/not both/)
  })

  it('installs by default, passing dep type and specs through', async () => {
    await runAdd(['react', 'vue@18'], { dev: true, noRules: true })
    expect(runInstallSelections).toHaveBeenCalledWith(
      [
        { name: 'react', dev: true },
        { name: 'vue@18', dev: true },
      ],
      { noRules: true },
    )
    expect(addFavorite).not.toHaveBeenCalled()
    expect(addToBundle).not.toHaveBeenCalled()
  })

  it('favorites with --fav, keyed on the bare name', async () => {
    await runAdd(['lodash@4'], { fav: true })
    expect(resolveLatest).toHaveBeenCalledWith('lodash')
    expect(addFavorite).toHaveBeenCalledWith(expect.objectContaining({ name: 'lodash' }))
    expect(runInstallSelections).not.toHaveBeenCalled()
  })

  it('records into a bundle, pinning an explicit @version as exact', async () => {
    await runAdd(['lodash@4.17.21', 'zod'], { bundle: 'stack' })
    expect(addToBundle).toHaveBeenCalledWith('stack', [
      { name: 'lodash', strategy: 'exact', depType: 'dependencies', version: '4.17.21' },
      { name: 'zod', strategy: 'caret', depType: 'dependencies' },
    ])
  })

  it('records bundle dev entries with the given strategy', async () => {
    await runAdd(['vitest'], { bundle: 'stack', dev: true, strategy: 'tilde' })
    expect(addToBundle).toHaveBeenCalledWith('stack', [
      { name: 'vitest', strategy: 'tilde', depType: 'devDependencies' },
    ])
  })

  it('warns but proceeds when --dev is combined with --fav', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runAdd(['react'], { fav: true, dev: true })
    expect(log.mock.calls.flat().join('\n')).toMatch(/--dev has no effect with --fav/)
    expect(addFavorite).toHaveBeenCalled()
    log.mockRestore()
  })
})
