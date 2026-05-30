import { describe, expect, it } from 'vitest'
import { buildInstallCommand, formatCommand } from '../src/core/pm.ts'

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
