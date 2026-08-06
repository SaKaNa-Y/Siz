/**
 * The **signal window** — which rows of a result set are worth paying for.
 *
 * Eager result signals (install size, license, deprecation, provenance,
 * downloads) cost one or more network requests per package, but the interactive
 * box only ever shows about ten rows at a time. This module decides, purely,
 * which slice of a result list gets fetched: the rows on screen plus a small
 * prefetch margin so scrolling stays ahead of the network. Everything else fills
 * in as the user scrolls, and the process-scoped memos in ./packument.ts and
 * ./trust.ts mean a name is never fetched twice.
 *
 * Non-interactive output (`--list` / `--json`) prints every result, so it does
 * not window — it fetches signals for the whole set.
 */

/** Rows the interactive box shows at once; the window tracks this many. */
export const SIGNAL_VIEWPORT_ROWS = 10

/** Extra rows fetched either side of the viewport so scrolling isn't a stall. */
export const SIGNAL_PREFETCH_MARGIN = 5

export interface SignalWindowOptions {
  /** Rows visible at once. Defaults to {@link SIGNAL_VIEWPORT_ROWS}. */
  viewport?: number
  /** Rows prefetched either side. Defaults to {@link SIGNAL_PREFETCH_MARGIN}. */
  margin?: number
}

/** Half-open index range `[start, end)` of a result list. */
export interface SignalWindow {
  start: number
  end: number
}

/**
 * The slice of a `count`-long result list whose signals should be fetched, given
 * the focused row. The viewport is centred on the focus, clamped to the list,
 * then widened by the prefetch margin. Centring is deliberately more generous
 * than the prompt's own scrolling (which only slides far enough to keep the
 * cursor on screen), so the rows it is about to reveal are already in flight.
 */
export function signalWindow(
  count: number,
  focusIndex: number,
  opts: SignalWindowOptions = {},
): SignalWindow {
  if (count <= 0) return { start: 0, end: 0 }

  const viewport = Math.max(1, opts.viewport ?? SIGNAL_VIEWPORT_ROWS)
  const margin = Math.max(0, opts.margin ?? SIGNAL_PREFETCH_MARGIN)
  const focus = Math.min(Math.max(focusIndex, 0), count - 1)

  // Centre the viewport on the focus, then slide it back inside the list so a
  // focus near either end still gets a full viewport's worth.
  let start = focus - Math.floor((viewport - 1) / 2)
  let end = start + viewport
  if (start < 0) {
    end -= start
    start = 0
  }
  if (end > count) {
    start = Math.max(0, start - (end - count))
    end = count
  }

  return { start: Math.max(0, start - margin), end: Math.min(count, end + margin) }
}

export interface WindowNamesOptions extends SignalWindowOptions {
  /** Names already fetched (or in flight) — dropped from the result. */
  exclude?: ReadonlySet<string>
}

/** The names inside {@link signalWindow}, minus any already accounted for. */
export function windowNames(
  names: readonly string[],
  focusIndex: number,
  opts: WindowNamesOptions = {},
): string[] {
  const { start, end } = signalWindow(names.length, focusIndex, opts)
  const slice = names.slice(start, end)
  return opts.exclude ? slice.filter((name) => !opts.exclude!.has(name)) : slice
}
