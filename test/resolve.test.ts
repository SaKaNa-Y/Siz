import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { discoverProjectDeps } from '../src/core/resolve.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'siz-resolve-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('discoverProjectDeps', () => {
  it('non-recursive: nearest manifest + its upgradable names', async () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { vue: '^3.0.0' }, devDependencies: { vitest: '^2.0.0' } }),
    )
    const scan = await discoverProjectDeps(dir)
    expect(scan.manifests.map((m) => m.path)).toEqual([join(dir, 'package.json')])
    expect(scan.queryNames.toSorted()).toEqual(['vitest', 'vue'])
  })

  it('recursive: workspace members, with query names deduped across manifests', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { vue: '^3.0.0' } }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
    const a = join(dir, 'packages', 'a')
    const b = join(dir, 'packages', 'b')
    mkdirSync(a, { recursive: true })
    mkdirSync(b, { recursive: true })
    writeFileSync(
      join(a, 'package.json'),
      JSON.stringify({ dependencies: { vue: '^3.0.0', zod: '^3.0.0' } }),
    )
    writeFileSync(join(b, 'package.json'), JSON.stringify({ dependencies: { vue: '^3.0.0' } }))

    const scan = await discoverProjectDeps(dir, { recursive: true })
    expect(scan.manifests.map((m) => m.path)).toEqual([
      join(dir, 'package.json'),
      join(a, 'package.json'),
      join(b, 'package.json'),
    ])
    // `vue` appears in all three manifests but is queried once.
    expect(scan.queryNames.toSorted()).toEqual(['vue', 'zod'])
  })

  it('includes pnpm catalog entries, deduped against manifest deps', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { vue: '^3.0.0' } }))
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'catalog:\n  react: ^18.0.0\n  vue: ^3.0.0\n')

    const scan = await discoverProjectDeps(dir)
    expect(scan.catalog?.path).toBe(join(dir, 'pnpm-workspace.yaml'))
    // `vue` is shared by the manifest and the catalog; it appears once.
    expect(scan.queryNames.toSorted()).toEqual(['react', 'vue'])
  })

  it('excludes non-registry specifiers from the query names', async () => {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        dependencies: {
          vue: '^3.0.0',
          local: 'workspace:*',
          aliased: 'npm:react@^18',
          tagged: 'latest',
        },
      }),
    )
    const scan = await discoverProjectDeps(dir)
    expect(scan.queryNames).toEqual(['vue'])
  })
})
