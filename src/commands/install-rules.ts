import ansis from 'ansis'

import { loadRules, partitionByRules } from '../core/rules.ts'
import { clack } from '../ui/prompts.ts'
import { formatBlockedNotice } from '../ui/render.ts'

/**
 * Apply the dependency-rules guardrail to a set of install items. Returns the
 * allowed subset, or `null` when every item is blocked (the caller should abort).
 * Emits the `--no-rules` bypass notice and the blocked-package notice as side
 * effects. Pure rule evaluation lives in `core/rules.ts`.
 */
export function applyInstallRules<T>(
  items: T[],
  getName: (item: T) => string,
  opts: { cwd?: string; noRules?: boolean; abortOutro: string },
): T[] | null {
  if (opts.noRules) {
    clack.log.warn(ansis.yellow('⚠ Dependency rules bypassed (--no-rules)'))
    return items
  }
  const loaded = loadRules(opts.cwd)
  if (!loaded) return items

  const { allowed, blocked } = partitionByRules(items, loaded.rules, getName)
  if (blocked.length) {
    clack.log.warn(
      formatBlockedNotice(
        blocked.map((b) => ({ name: getName(b.item), reason: b.reason })),
        loaded.path,
      ),
    )
    if (allowed.length === 0) {
      clack.log.error('All selected packages are blocked by dependency rules.')
      clack.outro(opts.abortOutro)
      process.exitCode = 1
      return null
    }
  }
  return allowed
}
