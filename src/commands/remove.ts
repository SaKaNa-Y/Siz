import ansis from 'ansis'

import { untrack } from '../core/store.ts'

export function runRemove(name: string): void {
  if (!name) {
    console.log(ansis.yellow('Usage: siz rm <package>'))
    return
  }
  const removed = untrack(name)
  if (removed) console.log(`${ansis.red('-')} Untracked ${ansis.bold(name)}`)
  else console.log(ansis.yellow(`${name} is not tracked.`))
}
