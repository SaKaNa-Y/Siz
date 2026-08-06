import { describe, expect, it } from 'vitest'

import {
  SIGNAL_PREFETCH_MARGIN,
  SIGNAL_VIEWPORT_ROWS,
  signalWindow,
  windowNames,
} from '../src/core/window.ts'

const names = (count: number) => Array.from({ length: count }, (_, i) => `pkg-${i}`)

describe('signalWindow', () => {
  it('covers the whole list when it is shorter than the viewport', () => {
    expect(signalWindow(4, 0, { viewport: 10, margin: 5 })).toEqual({ start: 0, end: 4 })
    expect(signalWindow(4, 3, { viewport: 10, margin: 5 })).toEqual({ start: 0, end: 4 })
  })

  it('is empty for an empty list', () => {
    expect(signalWindow(0, 0, { viewport: 10, margin: 5 })).toEqual({ start: 0, end: 0 })
  })

  it('starts at the top of the list when focus is at the start', () => {
    // Viewport rows 0..9, plus a 5-row prefetch below.
    expect(signalWindow(50, 0, { viewport: 10, margin: 5 })).toEqual({ start: 0, end: 15 })
  })

  it('slides with focus in the middle of the list', () => {
    // Viewport centred on row 25 → rows 21..30, widened by 5 either side.
    expect(signalWindow(50, 25, { viewport: 10, margin: 5 })).toEqual({ start: 16, end: 36 })
  })

  it('clamps to the end of the list when focus is at the end', () => {
    expect(signalWindow(50, 49, { viewport: 10, margin: 5 })).toEqual({ start: 35, end: 50 })
  })

  it('clamps an out-of-range focus index', () => {
    expect(signalWindow(50, -3, { viewport: 10, margin: 5 })).toEqual({ start: 0, end: 15 })
    expect(signalWindow(50, 999, { viewport: 10, margin: 5 })).toEqual({ start: 35, end: 50 })
  })

  it('defaults to the viewport and prefetch constants', () => {
    const span = SIGNAL_VIEWPORT_ROWS + SIGNAL_PREFETCH_MARGIN
    expect(signalWindow(100, 0)).toEqual({ start: 0, end: span })
  })
})

describe('windowNames', () => {
  it('returns the names inside the window', () => {
    expect(windowNames(names(50), 0, { viewport: 4, margin: 1 })).toEqual([
      'pkg-0',
      'pkg-1',
      'pkg-2',
      'pkg-3',
      'pkg-4',
    ])
  })

  it('returns every name for a list shorter than the viewport', () => {
    expect(windowNames(names(3), 2, { viewport: 10, margin: 5 })).toEqual([
      'pkg-0',
      'pkg-1',
      'pkg-2',
    ])
  })

  it('drops names that were already fetched', () => {
    const fetched = new Set(['pkg-0', 'pkg-2'])
    expect(windowNames(names(50), 0, { viewport: 4, margin: 0, exclude: fetched })).toEqual([
      'pkg-1',
      'pkg-3',
    ])
  })
})
