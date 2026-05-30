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

/** Choose dependency vs devDependency for an install. */
export async function pickDepType(): Promise<{ dev: boolean }> {
  const dev = ensure(
    await p.select<boolean>({
      message: 'Dependency type',
      options: [
        { value: false, label: 'dependencies' },
        { value: true, label: 'devDependencies' },
      ],
      initialValue: false,
    }),
  )
  return { dev }
}

export { p as clack }
