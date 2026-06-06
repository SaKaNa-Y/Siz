import ansis from 'ansis'

import { removeFavorite } from '../core/store.ts'

export function runRemove(name: string): void {
  if (!name) {
    console.log(ansis.yellow('Usage: siz rm <package>'))
    return
  }
  const removed = removeFavorite(name)
  if (removed) console.log(`${ansis.red('-')} Removed favorite ${ansis.bold(name)}`)
  else console.log(ansis.yellow(`${name} is not a favorite.`))
}
