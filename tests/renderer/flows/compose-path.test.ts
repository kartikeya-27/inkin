import { describe, expect, it } from 'vitest'
import { composeFlowPath } from '../../../src/renderer/flows/compose-path'

/**
 * `composeFlowPath` — string-concatenation contract.
 *
 * Phase 10 refactor (architecture change): the helper used to take
 * `(flow, xyNodes, xyEdges)` and re-compute SVG paths from node
 * positions. That approach can't match xyflow's internal handle-bounds
 * math (handle width, handle offset, node-vs-rendered-height
 * differences), producing tokens 6-12 px off the visible edges. The
 * post-Phase-10 helper takes the `d` attribute strings xyflow has
 * already rendered (`FlowLayer` reads them straight off
 * `.react-flow__edge[data-id] > path`) and just concatenates them, so
 * the engine's own geometry is the source of truth.
 *
 * This suite pins the only logic this helper still owns: M-stripping +
 * defensive null returns.
 */

describe('composeFlowPath — empty / null inputs', () => {
  it('returns null for an empty array', () => {
    expect(composeFlowPath([])).toBeNull()
  })

  it('returns null when any segment is an empty string', () => {
    expect(composeFlowPath([''])).toBeNull()
    expect(composeFlowPath(['M0 0L10 0', ''])).toBeNull()
    expect(composeFlowPath(['', 'M10 0L20 0'])).toBeNull()
  })
})

describe('composeFlowPath — single-segment passthrough', () => {
  it('returns a one-segment input verbatim', () => {
    const segment = 'M246 93.234L266 93.234L 294,93.234Q 300,93.234 300,99.234'
    expect(composeFlowPath([segment])).toBe(segment)
  })

  it('passes through unusual but valid path shapes (curves, multiple commands)', () => {
    const segment = 'M0 0Q 10 10 20 0L30 0C40 10,50 10,60 0Z'
    expect(composeFlowPath([segment])).toBe(segment)
  })
})

describe('composeFlowPath — multi-segment concatenation', () => {
  it('joins two segments into one continuous path with exactly one M', () => {
    const a = 'M0 0L10 0L20 0'
    const b = 'M20 0L30 0L40 0'
    const out = composeFlowPath([a, b])
    expect(out).not.toBeNull()
    const mCount = (out?.match(/M/g) ?? []).length
    expect(mCount).toBe(1)
    expect(out?.startsWith('M0 0')).toBe(true)
  })

  it('rewrites every subsequent segment`s leading M as L', () => {
    const a = 'M0 0L100 0'
    const b = 'M100 0L200 0'
    const c = 'M200 0L300 0'
    const out = composeFlowPath([a, b, c])
    expect(out).not.toBeNull()
    // Exactly one M total — original first segment's.
    expect((out?.match(/M/g) ?? []).length).toBe(1)
    // The rewritten join points (b's "M100 0" → "L 100 0", c's "M200 0"
    // → "L 200 0") create three L-commands at those break-points: the
    // first segment's `L100 0`, b's continuation `L 100 0`, b's own
    // `L200 0`, c's continuation `L 200 0`, and c's own `L300 0`. The
    // important invariant is that no `M` reappears past the first
    // command, AND the join coordinates show up as `L` continuations.
    expect(out).toMatch(/L\s*100\s+0/)
    expect(out).toMatch(/L\s*200\s+0/)
    expect(out).toMatch(/L\s*300\s+0/)
  })

  it('preserves the first segment intact and only mutates the continuations', () => {
    const a = 'M5 5L15 15L25 25'
    const b = 'M25 25L35 35'
    const out = composeFlowPath([a, b])
    expect(out?.startsWith(a)).toBe(true)
  })

  it('handles xyflow`s real-world path shape (comma + space separators)', () => {
    // Sample from xyflow's `getSmoothStepPath` output in a real browser:
    const a = 'M246 93.234375L266 93.234375L 294,93.234375Q 300,93.234375 300,99.234375'
    const b = 'M546 267.234375L566 267.234375L600 267.234375L 634,267.234375'
    const out = composeFlowPath([a, b])
    expect(out).not.toBeNull()
    expect((out?.match(/M/g) ?? []).length).toBe(1)
    // The join is at b's start (546, 267.234) → becomes `L 546 267.234`.
    expect(out).toMatch(/L\s*546\s+267\.234375/)
  })
})

describe('composeFlowPath — defensive: malformed segments', () => {
  it('passes a segment with no leading M through unchanged (defensive)', () => {
    // If a future xyflow version emits a path that doesn't start with
    // `M`, the helper still produces a string — wrong shape, but not
    // null/crash. The Phase 9 Playwright spec is the gate against that
    // ever shipping unnoticed.
    const a = 'M0 0L10 0'
    const b = 'L20 0L30 0' // no M
    const out = composeFlowPath([a, b])
    expect(out).not.toBeNull()
    expect(out).toContain(a)
    expect(out).toContain(b)
  })
})

describe('composeFlowPath — determinism', () => {
  it('identical inputs produce byte-identical outputs', () => {
    const inputs = ['M0 0L10 0', 'M10 0L20 0', 'M20 0L30 0']
    expect(composeFlowPath(inputs)).toBe(composeFlowPath(inputs))
  })
})
