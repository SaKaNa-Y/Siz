import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Walk up from `cwd` to the filesystem root, returning the nearest `filename`. */
export function findUp(filename: string, cwd: string = process.cwd()): string | undefined {
  let dir = cwd
  while (dir) {
    const candidate = join(dir, filename)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined // reached the filesystem root
    dir = parent
  }
  return undefined
}

/**
 * Resolve the per-user config directory for Siz.
 *
 * This intentionally lives in the user's home directory — NOT inside the
 * installed npm package — so updating/reinstalling Siz can never touch the
 * user's tracked packages or settings.
 *
 * Resolution order:
 *  - Windows: %APPDATA%\siz  (falls back to ~/AppData/Roaming/siz)
 *  - Otherwise: $XDG_CONFIG_HOME/siz  (falls back to ~/.config/siz)
 */
export function getConfigDir(): string {
  const home = homedir()

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
    return join(appData, 'siz')
  }

  const xdg = process.env.XDG_CONFIG_HOME || join(home, '.config')
  return join(xdg, 'siz')
}

/** Absolute path to the Siz data file. */
export function getDataFile(): string {
  return join(getConfigDir(), 'data.json')
}
