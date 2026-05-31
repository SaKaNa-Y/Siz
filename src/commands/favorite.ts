import ansis from 'ansis'

import { setFavorite } from '../core/store.ts'

export function runFavorite(name: string, favorite: boolean): void {
  if (!name) {
    console.log(ansis.yellow(`Usage: siz ${favorite ? 'fav' : 'unfav'} <package>`))
    return
  }
  setFavorite(name, favorite)
  if (favorite) console.log(`${ansis.red('❤')} Favorited ${ansis.bold(name)}`)
  else console.log(`${ansis.dim('♡')} Unfavorited ${ansis.bold(name)}`)
}
