import type { Agent } from 'package-manager-detector'

import * as p from '@clack/prompts'

/** Abort cleanly if the user cancels a prompt. */
export function ensure<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    process.exit(130)
  }
  return value as T
}

export type SetAction = 'install' | 'favorite' | 'track' | 'tag' | 'copy' | 'cancel'

/** Action menu shown after one or more packages are selected. */
export async function pickSetAction(names: string[]): Promise<SetAction> {
  const label = names.length === 1 ? names[0] : `${names.length} packages`
  return ensure(
    await p.select<SetAction>({
      message: `What to do with ${label}?`,
      options: [
        { value: 'install', label: '⬇  Install', hint: 'run your package manager' },
        { value: 'favorite', label: '❤  Favorite' },
        { value: 'track', label: '＋ Track (add to list)' },
        { value: 'tag', label: '🏷  Add tags' },
        { value: 'copy', label: '⧉  Show install command' },
        { value: 'cancel', label: '←  Cancel' },
      ],
    }),
  )
}

/** Package managers offered in the install picker. */
const PACKAGE_MANAGERS: Agent[] = ['npm', 'pnpm', 'yarn', 'bun', 'deno']

/** Choose the package manager for an install, defaulting to the detected one. */
export async function pickPackageManager(detected: Agent): Promise<Agent> {
  // Ensure the detected agent is offered even if it's a variant (e.g. yarn@berry).
  const options = PACKAGE_MANAGERS.includes(detected)
    ? PACKAGE_MANAGERS
    : [detected, ...PACKAGE_MANAGERS]
  return ensure(
    await p.select<Agent>({
      message: 'Package manager',
      initialValue: detected,
      options: options.map((agent) => ({
        value: agent,
        label: agent,
        hint: agent === detected ? 'detected' : undefined,
      })),
    }),
  )
}

export { p as clack }
