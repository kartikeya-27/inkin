import type { Edge as XyEdge, Node as XyNode } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { composeFlowPath } from '../../../src/renderer/flows/compose-path'
import type { Flow } from '../../../src/schema/types'

/**
 * Phase 1 of 0.5.0 — pure `composeFlowPath` helper.
 *
 * Determinism is the gate. The helper is exhaustively exercised against
 * known geometric inputs so a future xyflow `getSmoothStepPath` shape
 * change fails this suite immediately (instead of letting the animation
 * silently misbehave at render time).
 */

// Fixtures: three rect nodes in a horizontal row at y=0, default 180×60.
// Idea  Sketch  Ship
// (0,0) (240,0) (480,0)
const nodes: XyNode[] = [
  {
    id: 'a',
    type: 'rect',
    position: { x: 0, y: 0 },
    data: { label: 'Idea' },
    measured: { width: 180, height: 60 },
  },
  {
    id: 'b',
    type: 'rect',
    position: { x: 240, y: 0 },
    data: { label: 'Sketch' },
    measured: { width: 180, height: 60 },
  },
  {
    id: 'c',
    type: 'rect',
    position: { x: 480, y: 0 },
    data: { label: 'Ship' },
    measured: { width: 180, height: 60 },
  },
  {
    id: 'd',
    type: 'rect',
    position: { x: 0, y: 200 },
    data: { label: 'Aside' },
    measured: { width: 180, height: 60 },
  },
]

const edges: XyEdge[] = [
  { id: 'a->b', source: 'a', target: 'b', type: 'labeled' },
  { id: 'b->c', source: 'b', target: 'c', type: 'labeled' },
  { id: 'a->c', source: 'a', target: 'c', type: 'labeled' }, // non-adjacent in a 1-step path
  { id: 'a->d', source: 'a', target: 'd', type: 'labeled' }, // vertical-ish
]

function flow(id: string, edgeIds: string[]): Flow {
  return { id, edges: edgeIds, duration: 7000, delay: 0 }
}

describe('composeFlowPath — single-edge', () => {
  it('returns the raw xyflow path for a one-edge flow', () => {
    const d = composeFlowPath({ flow: flow('f1', ['a->b']), xyNodes: nodes, xyEdges: edges })
    expect(d).not.toBeNull()
    // getSmoothStepPath always returns a `d` starting with `M`.
    expect(d?.startsWith('M')).toBe(true)
  })

  it('the path connects source-right to target-left for a horizontal edge', () => {
    const d = composeFlowPath({ flow: flow('f1', ['a->b']), xyNodes: nodes, xyEdges: edges })
    expect(d).not.toBeNull()
    // Source point: a is at (0,0), 180×60 → right midpoint (180, 30).
    // Target point: b is at (240,0), 180×60 → left midpoint (240, 30).
    // The path must start at the source point (M 180 30) and end at
    // the target point (... 240 30) somewhere in the string.
    expect(d).toMatch(/^M\s*180[\s,]+30/)
    expect(d).toMatch(/240[\s,]+30\s*$/)
  })
})

describe('composeFlowPath — multi-edge concatenation', () => {
  it('joins two adjacent edges into one continuous path with one M total', () => {
    const d = composeFlowPath({
      flow: flow('f-chain', ['a->b', 'b->c']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    expect(d).not.toBeNull()
    // Exactly one leading M for the whole composed path — subsequent
    // segments are re-anchored with `L` so the token traces continuously.
    const mCount = (d?.match(/M/g) ?? []).length
    expect(mCount).toBe(1)
  })

  it('joins three edges into one continuous path with one M total', () => {
    const d = composeFlowPath({
      flow: flow('f-three', ['a->b', 'b->c', 'a->c']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    expect(d).not.toBeNull()
    const mCount = (d?.match(/M/g) ?? []).length
    expect(mCount).toBe(1)
  })

  it('non-adjacent edge sequence still composes (visual teleport accepted)', () => {
    // b->c then a->b is intentionally backwards / non-adjacent.
    // The schema permits this; the composed path produces a straight
    // L from c's left edge back to a's right edge, which is what we
    // tell consumers the renderer will draw.
    const d = composeFlowPath({
      flow: flow('f-back', ['b->c', 'a->b']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    expect(d).not.toBeNull()
    const mCount = (d?.match(/M/g) ?? []).length
    expect(mCount).toBe(1)
  })
})

describe('composeFlowPath — determinism', () => {
  it('identical inputs produce identical output', () => {
    const a = composeFlowPath({
      flow: flow('f1', ['a->b', 'b->c']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    const b = composeFlowPath({
      flow: flow('f1', ['a->b', 'b->c']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    expect(a).toBe(b)
  })

  it('different flow ids with identical edge sequences produce identical paths', () => {
    const a = composeFlowPath({
      flow: flow('flow-x', ['a->b']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    const b = composeFlowPath({
      flow: flow('flow-y', ['a->b']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    // Only `edges` should drive the geometry; id is render-side
    // metadata, never path-side.
    expect(a).toBe(b)
  })
})

describe('composeFlowPath — defensive resolution failures', () => {
  it('returns null when an edge id does not resolve', () => {
    const d = composeFlowPath({
      flow: flow('f', ['a->b', 'does-not-exist']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    expect(d).toBeNull()
  })

  it('returns null when an edge resolves but its source node is missing', () => {
    const orphanEdge: XyEdge = {
      id: 'orphan->b',
      source: 'orphan',
      target: 'b',
      type: 'labeled',
    }
    const d = composeFlowPath({
      flow: flow('f', ['orphan->b']),
      xyNodes: nodes,
      xyEdges: [...edges, orphanEdge],
    })
    expect(d).toBeNull()
  })

  it('returns null when an edge resolves but its target node is missing', () => {
    const orphanEdge: XyEdge = {
      id: 'a->ghost',
      source: 'a',
      target: 'ghost',
      type: 'labeled',
    }
    const d = composeFlowPath({
      flow: flow('f', ['a->ghost']),
      xyNodes: nodes,
      xyEdges: [...edges, orphanEdge],
    })
    expect(d).toBeNull()
  })

  it('returns null for a flow with an empty `edges` array (defensive — schema enforces min(1))', () => {
    // The schema's `flow.edges.min(1)` rejects this at parse time, so
    // reaching the renderer with `edges: []` would only happen if a
    // consumer bypasses validation. We still don't want to emit a
    // path with no segments.
    const d = composeFlowPath({
      flow: { id: 'f', edges: [], duration: 7000, delay: 0 },
      xyNodes: nodes,
      xyEdges: edges,
    })
    expect(d).toBeNull()
  })
})

describe('composeFlowPath — measured vs fallback dimensions', () => {
  it('uses node.measured.width/height when present', () => {
    const widened: XyNode = {
      ...nodes[0],
      measured: { width: 300, height: 80 },
    } as XyNode
    const widenedTarget: XyNode = {
      ...nodes[1],
      measured: { width: 300, height: 80 },
    } as XyNode

    const d = composeFlowPath({
      flow: flow('f', ['a->b']),
      xyNodes: [widened, widenedTarget],
      xyEdges: edges,
    })
    expect(d).not.toBeNull()
    // Source-right of a 300×80 node at (0,0) → (300, 40).
    expect(d).toMatch(/^M\s*300[\s,]+40/)
  })

  it('falls back to NODE_WIDTH_FALLBACK / NODE_HEIGHT_FALLBACK when measured is missing', () => {
    const unmeasured: XyNode = {
      id: 'u',
      type: 'rect',
      position: { x: 0, y: 0 },
      data: { label: 'U' },
    }
    const target: XyNode = {
      id: 'v',
      type: 'rect',
      position: { x: 300, y: 0 },
      data: { label: 'V' },
    }
    const edge: XyEdge = { id: 'u->v', source: 'u', target: 'v', type: 'labeled' }

    const d = composeFlowPath({
      flow: flow('f', ['u->v']),
      xyNodes: [unmeasured, target],
      xyEdges: [edge],
    })
    expect(d).not.toBeNull()
    // Source-right of unmeasured node at (0,0) → uses 180×60 fallback → (180, 30).
    expect(d).toMatch(/^M\s*180[\s,]+30/)
  })
})

describe('composeFlowPath — geometric integrity across orientations', () => {
  it('a horizontal flow path traces between source-right and target-left at the same Y', () => {
    const d = composeFlowPath({ flow: flow('f', ['a->b']), xyNodes: nodes, xyEdges: edges })
    expect(d).not.toBeNull()
    // Both endpoints have Y=30 (vertical center of 60px-tall nodes).
    // For a perfectly horizontal smooth-step path xyflow emits a
    // straight line, which contains the substring "L 240 30" (target
    // x with same Y).
    expect(d).toContain('240')
    expect(d).toContain('30')
  })

  it('a vertical-ish flow path involves both X and Y axis transitions', () => {
    const d = composeFlowPath({
      flow: flow('f', ['a->d']),
      xyNodes: nodes,
      xyEdges: edges,
    })
    expect(d).not.toBeNull()
    // a at (0,0), d at (0,200), both 180×60.
    // Source point (180, 30); target point (0, 230). Path must include
    // a Y-transition through ~115 area (mid-step). Just assert the path
    // body has more than one segment marker (L/Q/etc.) — proves
    // getSmoothStepPath emitted a real multi-step path, not a straight
    // line.
    const segmentMarkers = (d?.match(/[LQ]/g) ?? []).length
    expect(segmentMarkers).toBeGreaterThanOrEqual(2)
  })
})

describe('composeFlowPath — round-trip with explicit and implicit edge ids', () => {
  it('resolves a flow that references both explicit-id and auto-derived-id edges', () => {
    const mixedEdges: XyEdge[] = [
      // Explicit id (matches schema's `Edge.id` field).
      { id: 'first', source: 'a', target: 'b', type: 'labeled' },
      // Auto-derived id (mirrors `effectiveEdgeId(edge)` → `${from}->${to}`).
      { id: 'b->c', source: 'b', target: 'c', type: 'labeled' },
    ]
    const d = composeFlowPath({
      flow: flow('f', ['first', 'b->c']),
      xyNodes: nodes,
      xyEdges: mixedEdges,
    })
    expect(d).not.toBeNull()
    const mCount = (d?.match(/M/g) ?? []).length
    expect(mCount).toBe(1)
  })
})
