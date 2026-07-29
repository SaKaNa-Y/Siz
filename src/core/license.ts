/**
 * The **license signal** — the legal result-signal family, sibling to the
 * health-oriented trust signals and the weight-oriented size signals.
 *
 * Siz reports the license a package declares, verbatim. It deliberately does
 * **not** classify licenses as permissive or copyleft: whether GPL is a problem
 * is a fact about *your* project, not about the package, so that judgement is
 * left to the user (and to a future license-policy rule). The one thing siz does
 * flag is an **unclear license** — a value that cannot be resolved from registry
 * metadata alone, which means a human has to go look.
 *
 * See ADR 0009.
 */

import type { LicenseSignals } from './types.ts'

import { fetchManifests, type LicenseField, type PackageManifest } from './packument.ts'

/**
 * Max width of a license on a result row. 18 fits every real SPDX id whole
 * (`AGPL-3.0-or-later` is the long one, at 17); only multi-license expressions
 * truncate, and those expand in full on the focused row.
 */
export const LICENSE_INLINE_MAX = 18

/** npm's documented marker for "deliberately proprietary, no rights granted". */
const UNLICENSED = 'UNLICENSED'

/** npm's documented escape hatch for a license that isn't an SPDX id. */
const SEE_LICENSE_IN = /^SEE\s+LICENSE\s+IN\s+/i

/** One license entry as a trimmed string — a bare id or the `{ type }` object form. */
function entryToString(entry: unknown): string {
  if (typeof entry === 'string') return entry.trim()
  if (
    entry &&
    typeof entry === 'object' &&
    typeof (entry as { type?: unknown }).type === 'string'
  ) {
    return (entry as { type: string }).type.trim()
  }
  return ''
}

/** Collapse one license field (any of its four shapes) to a string, or '' if empty. */
function fieldToString(field: LicenseField | undefined): string {
  if (field === undefined || field === null) return ''
  const entries = Array.isArray(field) ? field : [field]
  // Multiple entries historically meant "dual licensed", i.e. a choice.
  return entries.map(entryToString).filter(Boolean).join(' OR ')
}

/**
 * The declared license as a single string, or `null` when the manifest declares
 * none. Understands every shape npm has accumulated:
 *
 * - `license: "MIT"` — the modern SPDX id or expression
 * - `license: { type: "MIT", url }` — deprecated object form
 * - `license: ["MIT", "Apache2"]` — a bare array (real: `pause-stream`)
 * - `licenses: [{ type: "MIT" }, …]` — older still, under a different key
 *
 * Reading the legacy forms is not pedantry: the packages that use them are old,
 * and reporting a plainly-MIT 2013 package as having no license would be a false
 * accusation from a signal whose whole job is legal accuracy.
 */
export function normalizeLicense(manifest: PackageManifest): string | null {
  // `license` wins over the older `licenses` when both are present.
  return fieldToString(manifest.license) || fieldToString(manifest.licenses) || null
}

/**
 * True when the license cannot be resolved from registry metadata alone — none
 * declared, `UNLICENSED`, or deferred to a file with `SEE LICENSE IN …`. These
 * differ legally but are identical in what they ask of you: go read something.
 *
 * Note this says nothing about the *terms*. `GPL-3.0-only` is perfectly clear.
 */
export function isUnclearLicense(license: string | null): boolean {
  if (license === null) return true
  const trimmed = license.trim()
  if (!trimmed) return true
  if (trimmed.toUpperCase() === UNLICENSED) return true
  return SEE_LICENSE_IN.test(trimmed)
}

/** Display form of a license: `'no license'` when none, a short label for the file escape hatch. */
export function formatLicense(license: string | null): string {
  if (license === null || !license.trim()) return 'no license'
  const trimmed = license.trim()
  if (SEE_LICENSE_IN.test(trimmed)) return 'see LICENSE file'
  return trimmed
}

/** Clip a license label to `max` chars, marking the cut with an ellipsis. */
export function truncateLicense(text: string, max: number = LICENSE_INLINE_MAX): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

/**
 * Fetch the declared license for each name, derived from the shared packument
 * layer — so it rides the same request install size already makes.
 *
 * Three states, and the distinction matters: `{ license: 'MIT' }` means a license
 * was declared, `{ license: null }` means the manifest resolved and declared
 * none, and **a name absent from the map** means the packument never resolved.
 * Callers must render nothing at all for that last case — flagging an unclear
 * license because the network was slow would accuse every package on the list.
 */
export async function fetchLicenses(names: string[]): Promise<Map<string, LicenseSignals>> {
  const manifests = await fetchManifests(names)

  const out = new Map<string, LicenseSignals>()
  for (const [name, manifest] of manifests) {
    out.set(name, { license: normalizeLicense(manifest) })
  }
  return out
}
