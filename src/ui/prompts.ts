import type { Agent } from 'package-manager-detector'

import * as p from '@clack/prompts'

import { listBundles } from '../core/store.ts'

/** Abort cleanly if the user cancels a prompt. */
export function ensure<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    process.exit(130)
  }
  return value as T
}

export type SetAction = 'install' | 'favorite' | 'track' | 'tag' | 'bundle' | 'copy' | 'cancel'

/** Action menu shown after one or more packages are selected. */
export async function pickSetAction(names: string[]): Promise<SetAction> {
  const label = names.length === 1 ? names[0] : `${names.length} packages`
  return ensure(
    await p.select<SetAction>({
      message: `What to do with ${label}?`,
      options: [
        { value: 'install', label: 'Install', hint: 'run your package manager' },
        { value: 'favorite', label: 'Favorite' },
        { value: 'track', label: 'Track (add to list)' },
        { value: 'tag', label: 'Add tags' },
        { value: 'bundle', label: 'Add to bundle', hint: 'save to a reusable set' },
        { value: 'copy', label: 'Show install command' },
        { value: 'cancel', label: 'Cancel' },
      ],
    }),
  )
}

/**
 * Pick an existing bundle, create a new one, or skip. Returns the chosen bundle
 * name, or undefined when the user skips. Shared by `siz add` and the search
 * flow's "Add to bundle" action.
 */
export async function pickOrCreateBundle(): Promise<string | undefined> {
  const existing = listBundles()
  type Choice = 'skip' | 'new' | (string & {})
  const options: { value: Choice; label: string; hint?: string }[] = [
    { value: 'skip', label: 'Skip', hint: "don't add to a bundle" },
    { value: 'new', label: 'New bundle' },
    ...existing.map((b) => ({ value: b.name, label: b.name })),
  ]

  const choice = ensure(await p.select<Choice>({ message: 'Add these to a bundle?', options }))
  if (choice === 'skip') return undefined
  if (choice !== 'new') return choice

  const name = ensure(
    await p.text({
      message: 'Bundle name',
      validate: (v) => (v?.trim() ? undefined : 'Name cannot be empty'),
    }),
  )
  return name.trim()
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
