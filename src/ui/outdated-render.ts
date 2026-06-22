import ansis from 'ansis'

import type { DiffLevel } from '../core/upgrade.ts'

import { colorForDiff } from './upgrade-render.ts'

/** A single table row: one outdated dependency, optionally tagged with a source group. */
export interface OutdatedRow {
  name: string
  current: string
  wanted: string
  latest: string
  latestDiff: DiffLevel
  /** Group header to print before this row (manifest dir / catalog tag); omit for a flat list. */
  group?: string
}

/** Counts for the trailing summary line. */
export interface OutdatedCounts {
  total: number
  upToDate: number
  skipped: number
}

const HEAD = { name: 'Package', current: 'Current', wanted: 'Wanted', latest: 'Latest' }

/**
 * Aligned `Package / Current / Wanted / Latest` table. `current`/`wanted` render
 * gray; `latest` is tinted by bump severity (red/major, yellow/minor, green/patch).
 * When `grouped`, a dim source header is printed each time the row's `group` changes.
 */
export function renderOutdatedTable(rows: OutdatedRow[], opts: { grouped?: boolean } = {}): string {
  const nameW = Math.max(HEAD.name.length, ...rows.map((r) => r.name.length))
  const curW = Math.max(HEAD.current.length, ...rows.map((r) => r.current.length))
  const wantW = Math.max(HEAD.wanted.length, ...rows.map((r) => r.wanted.length))

  const lines: string[] = []
  lines.push(
    ansis.dim(
      `${HEAD.name.padEnd(nameW)}  ${HEAD.current.padEnd(curW)}  ${HEAD.wanted.padEnd(wantW)}  ${HEAD.latest}`,
    ),
  )

  let lastGroup: string | undefined
  for (const r of rows) {
    if (opts.grouped && r.group !== lastGroup) {
      if (r.group) lines.push(ansis.dim(r.group))
      lastGroup = r.group
    }
    const indent = opts.grouped ? '  ' : ''
    lines.push(
      `${indent}${r.name.padEnd(nameW)}  ${ansis.gray(r.current.padEnd(curW))}  ${ansis.gray(r.wanted.padEnd(wantW))}  ${colorForDiff(r.latestDiff)(r.latest)}`,
    )
  }
  return lines.join('\n')
}

/** One-line tally, e.g. `3 outdated · 12 up to date · 2 skipped`. */
export function renderOutdatedSummary(counts: OutdatedCounts): string {
  const parts = [`${counts.total} outdated`]
  if (counts.upToDate) parts.push(ansis.dim(`${counts.upToDate} up to date`))
  if (counts.skipped) parts.push(ansis.dim(`${counts.skipped} skipped`))
  return parts.join(ansis.dim(' · '))
}
