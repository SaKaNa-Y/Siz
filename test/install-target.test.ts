import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { discoverManifests } from '../src/core/project.ts'
import { buildInstallTargetOptions } from '../src/ui/prompts.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'siz-target-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Lay out a small monorepo: root + packages/a + packages/b. */
function makeMonorepo(): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'root-pkg' }))
  for (const [sub, name] of [
    ['a', '@scope/a'],
    ['b', '@scope/b'],
  ] as const) {
    const pkgDir = join(dir, 'packages', sub)
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name }))
  }
}

describe('buildInstallTargetOptions', () => {
  it('lists the root/nearest manifest first and as the default', async () => {
    makeMonorepo()
    const manifests = await discoverManifests(dir, { recursive: true })
    const { options, initialValue } = buildInstallTargetOptions(manifests, dir)

    expect(options[0]).toMatchObject({ value: dir, label: 'root-pkg', hint: 'root' })
    expect(initialValue).toBe(dir)
  })

  it('labels nested manifests by package name with a relative-dir hint', async () => {
    makeMonorepo()
    const manifests = await discoverManifests(dir, { recursive: true })
    const { options } = buildInstallTargetOptions(manifests, dir)

    const a = options.find((o) => o.value === join(dir, 'packages', 'a'))
    expect(a).toMatchObject({ label: '@scope/a', hint: join('packages', 'a') })
  })

  it('falls back to the relative dir when a manifest has no name', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'root-pkg' }))
    const pkgDir = join(dir, 'packages', 'nameless')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{}')

    const manifests = await discoverManifests(dir, { recursive: true })
    const { options } = buildInstallTargetOptions(manifests, dir)

    const nameless = options.find((o) => o.value === pkgDir)
    expect(nameless?.label).toBe(join('packages', 'nameless'))
  })
})
