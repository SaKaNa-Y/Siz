import { describe, expect, it } from 'vitest'

import {
  buildBundleInstallCommands,
  buildInstallCommand,
  buildInstallCommands,
  buildRemoveCommand,
  formatCommand,
  parseSpec,
} from '../src/core/pm.ts'

describe('buildInstallCommand', () => {
  it('builds npm install (deps)', () => {
    const cmd = buildInstallCommand('npm', ['react', 'vue'])
    expect(formatCommand(cmd)).toBe('npm i react vue')
  })

  it('builds pnpm add with dev flag', () => {
    const cmd = buildInstallCommand('pnpm', ['vitest'], { dev: true })
    expect(formatCommand(cmd)).toBe('pnpm add -D vitest')
  })

  it('builds yarn add (deps)', () => {
    const cmd = buildInstallCommand('yarn', ['lodash'])
    expect(formatCommand(cmd)).toBe('yarn add lodash')
  })

  it('uses bun -d for dev deps', () => {
    const cmd = buildInstallCommand('bun', ['typescript'], { dev: true })
    expect(formatCommand(cmd)).toBe('bun add -d typescript')
  })

  it('npm dev dependency uses -D', () => {
    const cmd = buildInstallCommand('npm', ['eslint'], { dev: true })
    expect(formatCommand(cmd)).toBe('npm i -D eslint')
  })

  it('deno add has no dev flag', () => {
    const cmd = buildInstallCommand('deno', ['@std/assert'], { dev: true })
    // No dev flag injected for deno.
    expect(cmd.args).not.toContain('-D')
    expect(cmd.args).not.toContain('-d')
    expect(cmd.args).toContain('@std/assert')
  })
})

describe('buildInstallCommands', () => {
  it('splits mixed prod/dev into two commands', () => {
    const cmds = buildInstallCommands('pnpm', [
      { name: 'react', dev: false },
      { name: 'vitest', dev: true },
      { name: 'eslint', dev: true },
    ])
    expect(cmds.map(formatCommand)).toEqual(['pnpm add react', 'pnpm add -D vitest eslint'])
  })

  it('returns a single command when all are prod', () => {
    const cmds = buildInstallCommands('npm', [
      { name: 'react', dev: false },
      { name: 'vue', dev: false },
    ])
    expect(cmds.map(formatCommand)).toEqual(['npm i react vue'])
  })

  it('returns a single dev command when all are dev', () => {
    const cmds = buildInstallCommands('bun', [{ name: 'typescript', dev: true }])
    expect(cmds.map(formatCommand)).toEqual(['bun add -d typescript'])
  })

  it('drops the dev flag for deno', () => {
    const cmds = buildInstallCommands('deno', [{ name: '@std/assert', dev: true }])
    expect(cmds).toHaveLength(1)
    expect(cmds[0].args).not.toContain('-D')
    expect(cmds[0].args).not.toContain('-d')
  })

  it('returns no commands for an empty selection', () => {
    expect(buildInstallCommands('npm', [])).toEqual([])
  })
})

describe('buildBundleInstallCommands', () => {
  it('passes version specs through and groups prod into one command', () => {
    const cmds = buildBundleInstallCommands('pnpm', [
      { spec: 'react@^18.2.0', depType: 'dependencies' },
      { spec: 'vue@~3.4.0', depType: 'dependencies' },
    ])
    expect(cmds.map(formatCommand)).toEqual(['pnpm add react@^18.2.0 vue@~3.4.0'])
  })

  it('splits dev specs into a separate -D command', () => {
    const cmds = buildBundleInstallCommands('pnpm', [
      { spec: 'react@^18.2.0', depType: 'dependencies' },
      { spec: 'vitest@^2.0.0', depType: 'devDependencies' },
    ])
    expect(cmds.map(formatCommand)).toEqual(['pnpm add react@^18.2.0', 'pnpm add -D vitest@^2.0.0'])
  })

  it('installs peer deps with the manager save flag', () => {
    const peer = { spec: 'react@^18.2.0', depType: 'peerDependencies' as const }
    expect(formatCommand(buildBundleInstallCommands('npm', [peer])[0])).toBe(
      'npm i --save-peer react@^18.2.0',
    )
    expect(formatCommand(buildBundleInstallCommands('pnpm', [peer])[0])).toBe(
      'pnpm add --save-peer react@^18.2.0',
    )
    expect(formatCommand(buildBundleInstallCommands('yarn', [peer])[0])).toBe(
      'yarn add --peer react@^18.2.0',
    )
    expect(formatCommand(buildBundleInstallCommands('bun', [peer])[0])).toBe(
      'bun add --peer react@^18.2.0',
    )
  })

  it('installs optional deps with the manager save flag', () => {
    const opt = { spec: 'fsevents@^2.3.0', depType: 'optionalDependencies' as const }
    expect(formatCommand(buildBundleInstallCommands('npm', [opt])[0])).toBe(
      'npm i --save-optional fsevents@^2.3.0',
    )
    expect(formatCommand(buildBundleInstallCommands('pnpm', [opt])[0])).toBe(
      'pnpm add --save-optional fsevents@^2.3.0',
    )
    expect(formatCommand(buildBundleInstallCommands('yarn', [opt])[0])).toBe(
      'yarn add --optional fsevents@^2.3.0',
    )
    expect(formatCommand(buildBundleInstallCommands('bun', [opt])[0])).toBe(
      'bun add --optional fsevents@^2.3.0',
    )
  })

  it('splits a mixed selection into one command per bucket, in stable order', () => {
    const cmds = buildBundleInstallCommands('pnpm', [
      { spec: 'vitest@^2.0.0', depType: 'devDependencies' },
      { spec: 'fsevents@^2.3.0', depType: 'optionalDependencies' },
      { spec: 'react@^18.2.0', depType: 'dependencies' },
      { spec: 'react-dom@^18.2.0', depType: 'peerDependencies' },
    ])
    expect(cmds.map(formatCommand)).toEqual([
      'pnpm add react@^18.2.0',
      'pnpm add -D vitest@^2.0.0',
      'pnpm add --save-peer react-dom@^18.2.0',
      'pnpm add --save-optional fsevents@^2.3.0',
    ])
  })

  it('degrades peer/optional to a single flagless command for deno', () => {
    const cmds = buildBundleInstallCommands('deno', [
      { spec: '@std/assert@^1.0.0', depType: 'dependencies' },
      { spec: 'react@^18.2.0', depType: 'peerDependencies' },
      { spec: 'fsevents@^2.3.0', depType: 'optionalDependencies' },
    ])
    expect(cmds.map(formatCommand)).toEqual([
      'deno add @std/assert@^1.0.0 react@^18.2.0 fsevents@^2.3.0',
    ])
  })

  it('returns no commands for an empty selection', () => {
    expect(buildBundleInstallCommands('npm', [])).toEqual([])
  })
})

describe('buildRemoveCommand', () => {
  it('uses npm uninstall', () => {
    expect(formatCommand(buildRemoveCommand('npm', ['lodash']))).toBe('npm uninstall lodash')
  })

  it('uses pnpm/yarn/bun/deno remove', () => {
    expect(formatCommand(buildRemoveCommand('pnpm', ['lodash']))).toBe('pnpm remove lodash')
    expect(formatCommand(buildRemoveCommand('yarn', ['lodash']))).toBe('yarn remove lodash')
    expect(formatCommand(buildRemoveCommand('bun', ['lodash']))).toBe('bun remove lodash')
    expect(formatCommand(buildRemoveCommand('deno', ['lodash']))).toBe('deno remove lodash')
  })

  it('removes multiple packages in one command', () => {
    expect(formatCommand(buildRemoveCommand('npm', ['react', 'vue']))).toBe(
      'npm uninstall react vue',
    )
  })
})

describe('parseSpec', () => {
  it('returns the bare name when there is no version', () => {
    expect(parseSpec('react')).toEqual({ name: 'react' })
  })

  it('splits a name and version', () => {
    expect(parseSpec('react@18')).toEqual({ name: 'react', version: '18' })
  })

  it('keeps a scoped name intact without a version', () => {
    expect(parseSpec('@scope/pkg')).toEqual({ name: '@scope/pkg' })
  })

  it('splits a scoped name and version', () => {
    expect(parseSpec('@scope/pkg@1.2.3')).toEqual({ name: '@scope/pkg', version: '1.2.3' })
  })

  it('treats a dist-tag as the version part', () => {
    expect(parseSpec('react@next')).toEqual({ name: 'react', version: 'next' })
  })
})
