import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runInstallSelections } from '../src/commands/install-runner.ts'
import { assertNoRemovedFlags } from '../src/commands/removed-flags.ts'
import { addToBundle } from '../src/core/store.ts'

// Mock the store, install runner, and prompts so runAdd's mode dispatch can be
// asserted without touching the real data store or the network.
vi.mock('../src/core/store.ts', () => ({ addToBundle: vi.fn() }))

vi.mock('../src/commands/install-runner.ts', () => ({
  runInstallSelections: vi.fn(async () => {}),
}))

vi.mock('../src/ui/prompts.ts', () => ({ clack: { intro: vi.fn(), outro: vi.fn() } }))

const { runAdd } = await import('../src/commands/add.ts')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runAdd mode dispatch', () => {
  it('installs by default, passing dep type and specs through', async () => {
    await runAdd(['react', 'vue@18'], { dev: true, noRules: true })
    expect(runInstallSelections).toHaveBeenCalledWith(
      [
        { name: 'react', dev: true },
        { name: 'vue@18', dev: true },
      ],
      { noRules: true },
    )
    expect(addToBundle).not.toHaveBeenCalled()
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
})

describe('removed flags', () => {
  it('rejects --fav with a message naming the replacement flow', () => {
    expect(() => assertNoRemovedFlags(['add', 'zod', '--fav'])).toThrow(/--bundle/)
    expect(() => assertNoRemovedFlags(['rm', 'zod', '--fav'])).toThrow(/bundle rm/)
    // `--fav=true` is the same flag.
    expect(() => assertNoRemovedFlags(['add', 'zod', '--fav=true'])).toThrow(/favorites/)
  })

  it('leaves supported argv alone', () => {
    expect(() => assertNoRemovedFlags(['add', 'zod', '--bundle', 'stack'])).not.toThrow()
    expect(() => assertNoRemovedFlags(['add', 'favicon-tool'])).not.toThrow()
  })
})
