import ansis from 'ansis'

import { addTags, removeTags } from '../core/store.ts'

export function runTag(name: string, tags: string[]): void {
  if (!name || tags.length === 0) {
    console.log(ansis.yellow('Usage: siz tag <package> <tag> [...tags]'))
    return
  }
  const pkg = addTags(name, tags)
  console.log(
    `${ansis.green('+')} ${ansis.bold(name)}  ${pkg.tags.map((t) => ansis.yellow(`#${t}`)).join(' ')}`,
  )
}

export function runUntag(name: string, tags: string[]): void {
  if (!name || tags.length === 0) {
    console.log(ansis.yellow('Usage: siz untag <package> <tag> [...tags]'))
    return
  }
  const pkg = removeTags(name, tags)
  if (!pkg) {
    console.log(ansis.yellow(`${name} is not tracked.`))
    return
  }
  const remaining = pkg.tags.length
    ? pkg.tags.map((t) => ansis.yellow(`#${t}`)).join(' ')
    : ansis.dim('(no tags)')
  console.log(`${ansis.red('-')} ${ansis.bold(name)}  ${remaining}`)
}
