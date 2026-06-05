import type { Agent } from 'package-manager-detector'

import * as p from '@clack/prompts'
import { dirname } from 'node:path'
import process from 'node:process'

import type { ProjectManifest } from '../core/project.ts'

import { findPackageJson, relativeScope } from '../core/project.ts'
import { listBundles } from '../core/store.ts'

/** Abort cleanly if the user cancels a prompt. */
export function ensure<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.')
    process.exit(130)
  }
  return value as T
}

export type SetAction = 'install' | 'favorite' | 'track' | 'bundle' | 'cancel'

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
        { value: 'bundle', label: 'Add to bundle', hint: 'save to a reusable set' },
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

/** A selectable install target: a workspace directory plus its display label. */
export interface InstallTargetOption {
  /** Absolute directory the package manager should run in. */
  value: string
  label: string
  hint?: string
}

/**
 * Build the install-target options for {@link pickInstallTarget}. Pure (no prompt)
 * so the labelling/ordering is unit-testable. The manifest at `cwd` (the root/nearest
 * one) is listed first and used as the default; nested manifests are labelled by their
 * package name with a relative-dir hint.
 */
export function buildInstallTargetOptions(
  manifests: ProjectManifest[],
  cwd: string = process.cwd(),
): { options: InstallTargetOption[]; initialValue: string | undefined } {
  // The directory of the nearest package.json — the natural default target.
  const nearest = findPackageJson(cwd)
  const nearestDir = nearest ? dirname(nearest) : cwd

  const options = manifests.map((m): InstallTargetOption => {
    const dir = dirname(m.path)
    const scope = relativeScope(cwd, dir)
    const name = typeof m.data.name === 'string' ? m.data.name : undefined
    return {
      value: dir,
      label: name ?? (scope ?? '.'),
      hint: scope ?? 'root',
    }
  })

  // Root/nearest first so the default sits at the top of the list.
  options.sort((a, b) => {
    if (a.value === nearestDir) return -1
    if (b.value === nearestDir) return 1
    return a.value.localeCompare(b.value)
  })

  // After the root-first sort, the nearest manifest (if any) is options[0].
  const initialValue = options[0]?.value
  return { options, initialValue }
}

/** Choose which workspace directory to install into, defaulting to the nearest package.json. */
export async function pickInstallTarget(
  manifests: ProjectManifest[],
  cwd: string = process.cwd(),
): Promise<string> {
  const { options, initialValue } = buildInstallTargetOptions(manifests, cwd)
  return ensure(
    await p.select<string>({
      message: 'Install into which package?',
      initialValue,
      options,
    }),
  )
}

export { p as clack }
