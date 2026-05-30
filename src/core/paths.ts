import { homedir } from 'node:os'
import { join } from 'node:path'

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
