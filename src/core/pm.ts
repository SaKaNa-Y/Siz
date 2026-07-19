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
 * Per-dep-type, per-agent flag that routes an `add` into the right bucket.
 * `dependencies` needs no flag (the manager's default), so it is not listed.
 * Most managers accept `-D` for dev (bun uses `-d`); peer/optional use the
 * long, explicit forms. An agent absent from a bucket (e.g. deno everywhere,
 * which has no dev/peer/optional concept) falls back to a regular dependency.
 */
const SAVE_FLAG: Record<
  'devDependencies' | 'peerDependencies' | 'optionalDependencies',
  Partial<Record<Agent, string>>
> = {
  devDependencies: {
    npm: '-D',
    pnpm: '-D',
    'pnpm@6': '-D',
    yarn: '-D',
    'yarn@berry': '-D',
    bun: '-d',
  },
  peerDependencies: {
    npm: '--save-peer',
    pnpm: '--save-peer',
    'pnpm@6': '--save-peer',
    yarn: '--peer',
    'yarn@berry': '--peer',
    bun: '--peer',
  },
  optionalDependencies: {
    npm: '--save-optional',
    pnpm: '--save-optional',
    'pnpm@6': '--save-optional',
    yarn: '--optional',
    'yarn@berry': '--optional',
    bun: '--optional',
  },
}

/**
 * The `add` flag that routes a package into the given dependency bucket for an
 * agent, or `undefined` when none is needed/available: `dependencies` (the
 * manager default) and any bucket an agent can't express (e.g. deno) both map
 * to `undefined`, meaning "install as a regular dependency".
 */
export function saveFlag(agent: Agent, depType: BundleDepType): string | undefined {
  if (depType === 'dependencies') return undefined
  return SAVE_FLAG[depType][agent]
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
 * Build an `add` command for an agent, optionally prefixing a bucket flag
 * (e.g. `-D`, `--save-peer`). Pure — no side effects. Falls back to npm
 * semantics if the agent is somehow unknown.
 */
function buildAddCommand(agent: Agent, names: string[], flag?: string): InstallCommand {
  const args = [...(flag ? [flag] : []), ...names]
  const resolved = resolveCommand(agent, 'add', args)
  if (!resolved) return { command: 'npm', args: ['install', ...args] }
  return { command: resolved.command, args: resolved.args }
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
  return buildAddCommand(agent, names, opts.dev ? saveFlag(agent, 'devDependencies') : undefined)
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

/** Dep-type buckets in the order their install commands are emitted. */
const DEP_TYPE_ORDER: BundleDepType[] = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

/**
 * Build install commands for a bundle: specs already carry their version range
 * (managers accept `pkg@range` for `add`), so they flow through untouched.
 * Each dependency bucket is installed with its manager save flag (`-D`,
 * `--save-peer`, `--save-optional`, …), emitting one command per distinct flag
 * in a stable order. Buckets a manager can't express (e.g. deno's peer/optional)
 * resolve to no flag and merge into the flagless regular-dependency command.
 * Pure — no side effects.
 */
export function buildBundleInstallCommands(
  agent: Agent,
  selections: SpecSelection[],
): InstallCommand[] {
  // Group specs by the flag their dep type resolves to for this agent, keeping
  // `undefined` (regular deps + any unsupported bucket) as one flagless group.
  const groups = new Map<string | undefined, string[]>()
  for (const depType of DEP_TYPE_ORDER) {
    const specs = selections.filter((s) => s.depType === depType).map((s) => s.spec)
    if (!specs.length) continue
    const flag = saveFlag(agent, depType)
    const existing = groups.get(flag)
    if (existing) existing.push(...specs)
    else groups.set(flag, specs)
  }
  return [...groups].map(([flag, specs]) => buildAddCommand(agent, specs, flag))
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
