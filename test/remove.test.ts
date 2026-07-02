import { beforeEach, describe, expect, it, vi } from 'vitest'

import { detectPM, runInstall } from '../src/core/pm.ts'
import { discoverManifests } from '../src/core/project.ts'
import { removeFavorite } from '../src/core/store.ts'

vi.mock('../src/core/store.ts', () => ({ removeFavorite: vi.fn(() => true) }))

// Keep the real command builders + parseSpec; stub only PM detection and exec.
vi.mock('../src/core/pm.ts', async (importActual) => {
  const actual = await importActual<typeof import('../src/core/pm.ts')>()
  return {
    ...actual,
    detectPM: vi.fn(async () => 'pnpm'),
    runInstall: vi.fn(async (_cmd: import('../src/core/pm.ts').InstallCommand, _cwd?: string) => 0),
  }
})

// Single-manifest project by default (no monorepo picker).
vi.mock('../src/core/project.ts', async (importActual) => {
  const actual = await importActual<typeof import('../src/core/project.ts')>()
  return {
    ...actual,
    discoverManifests: vi.fn(async () => [
      { path: '/proj/package.json', raw: '{}', data: {}, deps: [] },
    ]),
  }
})

vi.mock('../src/ui/prompts.ts', () => ({
  clack: { intro: vi.fn(), outro: vi.fn(), log: { step: vi.fn(), error: vi.fn() } },
  pickInstallTarget: vi.fn(),
}))

const { runRemove } = await import('../src/commands/remove.ts')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(detectPM).mockResolvedValue('pnpm')
  vi.mocked(runInstall).mockResolvedValue(0)
  vi.mocked(discoverManifests).mockResolvedValue([
    { path: '/proj/package.json', raw: '{}', data: {}, deps: [] },
  ])
})

describe('runRemove mode dispatch', () => {
  it('removes favorites with --fav and never runs the package manager', async () => {
    await runRemove(['react', 'vue'], { fav: true })
    expect(removeFavorite).toHaveBeenCalledWith('react')
    expect(removeFavorite).toHaveBeenCalledWith('vue')
    expect(runInstall).not.toHaveBeenCalled()
  })

  it('uninstalls by default via the detected package manager', async () => {
    await runRemove(['lodash'])
    expect(removeFavorite).not.toHaveBeenCalled()
    expect(vi.mocked(runInstall).mock.calls[0][0]).toEqual({
      command: 'pnpm',
      args: ['remove', 'lodash'],
    })
  })

  it('strips a version spec before uninstalling', async () => {
    await runRemove(['react@18', 'vue'])
    expect(vi.mocked(runInstall).mock.calls[0][0].args).toEqual(['remove', 'react', 'vue'])
  })
})
