import type { Agent } from 'package-manager-detector'

import { spawn } from 'node:child_process'
import { resolveCommand } from 'package-manager-detector/commands'
import { detect } from 'package-manager-detector/detect'

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
