import type { Agent } from 'package-manager-detector'

import { spawn } from 'node:child_process'
import { resolveCommand } from 'package-manager-detector/commands'
import { detect } from 'package-manager-detector/detect'

import type { BundleDepType } from './types.ts'

export interface InstallCommand {
  command: string
  args: string[]
}

/**
 * Per-agent flag for installing as a devDependency.
 * Most managers accept `-D`; bun uses `-d`; deno has no dev concept.
 */
const DEV_FLAG: Partial<Record<Agent, string>> = {
  npm: '-D',
  pnpm: '-D',
  'pnpm@6': '-D',
  yarn: '-D',
  'yarn@berry': '-D',
  bun: '-d',
  // deno: intentionally omitted (no dev dependencies)
}

/**
 * Detect the package manager for a directory.
 * Falls back to npm when nothing can be detected.
 */
export async function detectPM(cwd: string = process.cwd()): Promise<Agent> {
  const result = await detect({ cwd })
  return result?.agent ?? 'npm'
}

/**
 * Build the install command for an agent (pure — no side effects).
 * `dev` adds the manager-specific devDependency flag.
 */
export function buildInstallCommand(
  agent: Agent,
  names: string[],
  opts: { dev?: boolean } = {},
): InstallCommand {
  const devFlag = opts.dev ? DEV_FLAG[agent] : undefined
  const args = [...(devFlag ? [devFlag] : []), ...names]
  const resolved = resolveCommand(agent, 'add', args)
  if (!resolved) {
    // Fallback to npm semantics if the agent is somehow unknown.
    return { command: 'npm', args: ['install', ...args] }
  }
  return { command: resolved.command, args: resolved.args }
}

/**
 * Build install commands for a batch of packages, each tagged as a regular
 * dependency or a devDependency. Splits into up to two commands (one per dep
 * type), skipping empty groups. Pure — no side effects.
 */
export function buildInstallCommands(
  agent: Agent,
  selections: { name: string; dev: boolean }[],
): InstallCommand[] {
  const prod = selections.filter((s) => !s.dev).map((s) => s.name)
  const dev = selections.filter((s) => s.dev).map((s) => s.name)
  const cmds: InstallCommand[] = []
  if (prod.length) cmds.push(buildInstallCommand(agent, prod))
  if (dev.length) cmds.push(buildInstallCommand(agent, dev, { dev: true }))
  return cmds
}

/** A package install spec (e.g. `react@^18.2.0`) tagged with its dependency type. */
export interface SpecSelection {
  spec: string
  depType: BundleDepType
}

/**
 * Build install commands for a bundle: specs already carry their version range
 * (managers accept `pkg@range` for `add`), so they flow through untouched.
 * Splits devDependencies from everything else into up to two commands.
 *
 * NOTE: v1 has no per-manager peer/optional flags, so peer/optional install as
 * regular dependencies. The true dep type is still stored in the bundle for a
 * future `--save-peer`/`--save-optional` pass. Pure — no side effects.
 */
const isDev = (d: BundleDepType) => d === 'devDependencies'

export function buildBundleInstallCommands(
  agent: Agent,
  selections: SpecSelection[],
): InstallCommand[] {
  const prod = selections.filter((s) => !isDev(s.depType)).map((s) => s.spec)
  const dev = selections.filter((s) => isDev(s.depType)).map((s) => s.spec)
  const cmds: InstallCommand[] = []
  if (prod.length) cmds.push(buildInstallCommand(agent, prod))
  if (dev.length) cmds.push(buildInstallCommand(agent, dev, { dev: true }))
  return cmds
}

/**
 * Build the uninstall command for an agent (pure — no side effects). The
 * manager's own `remove`/`uninstall` edits package.json, so no manifest
 * mutation is needed. Falls back to npm semantics for an unknown agent.
 */
export function buildRemoveCommand(agent: Agent, names: string[]): InstallCommand {
  const resolved = resolveCommand(agent, 'uninstall', names)
  if (!resolved) return { command: 'npm', args: ['uninstall', ...names] }
  return { command: resolved.command, args: resolved.args }
}

/**
 * Split a package spec into its bare name and optional version part, scope-aware:
 * `react@18` → `{ name: 'react', version: '18' }`, `@scope/pkg@1.2.3` →
 * `{ name: '@scope/pkg', version: '1.2.3' }`, `@scope/pkg` and `react` → no
 * version. Used to key name-based logic (rules, favorites, bundles) off a spec
 * that may carry a version, while the version still flows through to the PM.
 */
export function parseSpec(spec: string): { name: string; version?: string } {
  const at = spec.lastIndexOf('@')
  // `at <= 0` covers both no `@` (react) and a leading-only `@` (@scope/pkg).
  if (at <= 0) return { name: spec }
  return { name: spec.slice(0, at), version: spec.slice(at + 1) }
}

/**
 * Build the plain install/sync command (e.g. `pnpm install`) — applies the
 * version ranges already written in package.json without adding new packages.
 * Used by `siz upgrade`, where `add` would re-resolve to latest and clobber the
 * minor/patch ceiling we just wrote. Pure — no side effects.
 */
export function buildSyncCommand(agent: Agent): InstallCommand {
  const resolved = resolveCommand(agent, 'install', [])
  if (!resolved) return { command: 'npm', args: ['install'] }
  return { command: resolved.command, args: resolved.args }
}

/** Human-readable form of an install command, e.g. `pnpm add -D react`. */
export function formatCommand(cmd: InstallCommand): string {
  return [cmd.command, ...cmd.args].join(' ')
}

/**
 * Run an install command, streaming output to the user's terminal.
 * Resolves with the process exit code.
 */
export function runInstall(cmd: InstallCommand, cwd: string = process.cwd()): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd.command, cmd.args, {
      cwd,
      stdio: 'inherit',
      // On Windows, npm/pnpm/yarn are .cmd shims that require a shell.
      shell: process.platform === 'win32',
    })
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 0))
  })
}
