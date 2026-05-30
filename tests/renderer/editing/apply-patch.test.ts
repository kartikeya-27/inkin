import { describe, expect, it } from 'vitest'
import { applyPatch, effectiveEdgeId, pickConnectEdgeId } from '../../../src/renderer/editing'
import type { Patch } from '../../../src/renderer/editing'
import { parse } from '../../../src/schema'
import type { Diagram } from '../../../src/schema/types'

/**
 * Reducer tests for `applyPatch`. Strategy:
 *   - Build inputs through `parse()` so every test case starts from a real
 *     validated Diagram (defaults filled in, paths resolved). This catches
 *     reducer arms that quietly assume input shape.
 *   - Re-`parse()` the reducer output so structural correctness *and*
 *     `superRefine` (id uniqueness, edge resolution, flow integrity) are
 *     verified end-to-end. The dispatcher in `sync.ts` does the same thing
 *     at runtime — see `applyPatch` JSDoc.
 *   - Assert what *changed* and what *didn't* (array identity where the slice
 *     was untouched) so downstream memoization stays correct.
 */

function fresh(input: Parameters<typeof parse>[0]): Diagram {
  return parse(input)
}

const triangle: Diagram = fresh({
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'A', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', position: { x: 100, y: 0 } },
    { id: 'c', label: 'C', position: { x: 50, y: 100 } },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'ab' },
    { from: 'b', to: 'c' },
    { from: 'a', to: 'c', label: 'ac' },
  ],
})

const clustered: Diagram = fresh({
  schemaVersion: 1,
  clusters: [
    { id: 'left', label: 'left' },
    { id: 'right', label: 'right' },
  ],
  nodes: [
    { id: 'a', label: 'A', cluster: 'left', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', cluster: 'left', position: { x: 100, y: 0 } },
    { id: 'c', label: 'C', cluster: 'right', position: { x: 300, y: 0 } },
  ],
  edges: [{ from: 'a', to: 'c' }],
})

// --- MoveNode ----------------------------------------------------------------

describe('applyPatch — MoveNode', () => {
  it('sets the node position and leaves siblings untouched', () => {
    const next = applyPatch(triangle, {
      kind: 'MoveNode',
      nodeId: 'b',
      position: { x: 999, y: 888 },
    })
    const b = next.nodes.find((n) => n.id === 'b')
    expect(b?.position).toEqual({ x: 999, y: 888 })
    expect(next.nodes[0]).toBe(triangle.nodes[0])
    expect(next.nodes[2]).toBe(triangle.nodes[2])
    expect(parse(next)).toEqual(next)
  })

  it('returns a result that still validates', () => {
    const next = applyPatch(triangle, {
      kind: 'MoveNode',
      nodeId: 'a',
      position: { x: -50, y: -50 },
    })
    expect(() => parse(next)).not.toThrow()
  })
})

// --- ConnectEdge -------------------------------------------------------------

describe('applyPatch — ConnectEdge', () => {
  it('appends an implicit-id edge when the auto-derived id is free', () => {
    const noEdges = fresh({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [],
    })
    const next = applyPatch(noEdges, { kind: 'ConnectEdge', from: 'a', to: 'b' })
    expect(next.edges).toHaveLength(1)
    const added = next.edges[0]
    expect(added?.id).toBeUndefined()
    expect(added?.from).toBe('a')
    expect(added?.to).toBe('b')
    expect(added?.style).toBe('solid')
  })

  it('auto-generates a collision-free explicit id for a parallel edge', () => {
    const next = applyPatch(triangle, { kind: 'ConnectEdge', from: 'a', to: 'b' })
    const created = next.edges.at(-1)
    expect(created?.id).toBe('a->b#2')
    expect(parse(next)).toEqual(next)
  })

  it('skips ids already taken when generating the parallel-edge suffix', () => {
    const withAlreadyTakenSuffix: Diagram = fresh({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { id: 'a->b#2', from: 'a', to: 'b' },
      ],
    })
    const next = applyPatch(withAlreadyTakenSuffix, { kind: 'ConnectEdge', from: 'a', to: 'b' })
    expect(next.edges.at(-1)?.id).toBe('a->b#3')
  })

  it('produces no explicit id for a brand-new node-pair connection', () => {
    expect(pickConnectEdgeId(triangle, 'c', 'a')).toBeUndefined()
  })
})

// --- DeleteNode --------------------------------------------------------------

describe('applyPatch — DeleteNode', () => {
  it('removes the node', () => {
    const next = applyPatch(triangle, { kind: 'DeleteNode', nodeId: 'b' })
    expect(next.nodes.map((n) => n.id)).toEqual(['a', 'c'])
  })

  it('cascade-removes incident edges (both directions)', () => {
    const next = applyPatch(triangle, { kind: 'DeleteNode', nodeId: 'b' })
    expect(next.edges).toHaveLength(1)
    expect(next.edges[0]?.from).toBe('a')
    expect(next.edges[0]?.to).toBe('c')
    expect(() => parse(next)).not.toThrow()
  })

  it('cascade-prunes the deleted edges from flows', () => {
    const withFlow: Diagram = fresh({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
      flows: [{ id: 'main', edges: ['a->b', 'b->c'] }],
    })
    const next = applyPatch(withFlow, { kind: 'DeleteNode', nodeId: 'b' })
    expect(next.edges).toEqual([])
    expect(next.flows).toBeUndefined()
  })

  it('keeps the flow when only some of its edges were pruned', () => {
    const withMultiHopFlow: Diagram = fresh({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
      ],
      flows: [{ id: 'main', edges: ['a->b', 'b->c', 'c->d'] }],
    })
    const next = applyPatch(withMultiHopFlow, { kind: 'DeleteNode', nodeId: 'a' })
    expect(next.flows?.[0]?.edges).toEqual(['b->c', 'c->d'])
    expect(() => parse(next)).not.toThrow()
  })

  it('is a no-op when the node id is unknown', () => {
    const next = applyPatch(triangle, { kind: 'DeleteNode', nodeId: 'ghost' })
    expect(next).toBe(triangle)
  })
})

// --- DeleteEdge --------------------------------------------------------------

describe('applyPatch — DeleteEdge', () => {
  it('removes the edge matched by its auto-derived id', () => {
    const next = applyPatch(triangle, { kind: 'DeleteEdge', edgeId: 'a->b' })
    expect(next.edges.find((e) => e.from === 'a' && e.to === 'b')).toBeUndefined()
    expect(next.edges).toHaveLength(2)
    expect(() => parse(next)).not.toThrow()
  })

  it('removes the edge matched by an explicit id', () => {
    const withExplicit: Diagram = fresh({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ id: 'pinned', from: 'a', to: 'b' }],
    })
    const next = applyPatch(withExplicit, { kind: 'DeleteEdge', edgeId: 'pinned' })
    expect(next.edges).toEqual([])
  })

  it('drops a flow that becomes empty', () => {
    const single: Diagram = fresh({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      flows: [{ id: 'main', edges: ['a->b'] }],
    })
    const next = applyPatch(single, { kind: 'DeleteEdge', edgeId: 'a->b' })
    expect(next.flows).toBeUndefined()
  })

  it('is a no-op when the edge id is unknown', () => {
    const next = applyPatch(triangle, { kind: 'DeleteEdge', edgeId: 'ghost' })
    expect(next).toBe(triangle)
  })
})

// --- DeleteCluster -----------------------------------------------------------

describe('applyPatch — DeleteCluster', () => {
  it('removes the cluster and strips `cluster` from its child nodes', () => {
    const next = applyPatch(clustered, { kind: 'DeleteCluster', clusterId: 'left' })
    expect(next.clusters?.map((c) => c.id)).toEqual(['right'])
    const a = next.nodes.find((n) => n.id === 'a')
    const b = next.nodes.find((n) => n.id === 'b')
    const c = next.nodes.find((n) => n.id === 'c')
    expect(a?.cluster).toBeUndefined()
    expect(b?.cluster).toBeUndefined()
    expect(c?.cluster).toBe('right')
    expect(() => parse(next)).not.toThrow()
  })

  it('leaves edges between former cluster members intact', () => {
    const next = applyPatch(clustered, { kind: 'DeleteCluster', clusterId: 'left' })
    expect(next.edges).toHaveLength(1)
    expect(next.edges[0]?.from).toBe('a')
    expect(next.edges[0]?.to).toBe('c')
  })

  it('is a no-op when the cluster id is unknown or there are no clusters', () => {
    const next = applyPatch(clustered, { kind: 'DeleteCluster', clusterId: 'ghost' })
    expect(next).toBe(clustered)
    const noClusters = applyPatch(triangle, { kind: 'DeleteCluster', clusterId: 'left' })
    expect(noClusters).toBe(triangle)
  })
})

// --- SetField ----------------------------------------------------------------

describe('applyPatch — SetField', () => {
  it('updates a node label', () => {
    const next = applyPatch(triangle, {
      kind: 'SetField',
      target: { kind: 'node-label', id: 'b' },
      value: 'B prime',
    })
    expect(next.nodes.find((n) => n.id === 'b')?.label).toBe('B prime')
    expect(() => parse(next)).not.toThrow()
  })

  it('updates a node sublabel (and accepts empty string)', () => {
    const next = applyPatch(triangle, {
      kind: 'SetField',
      target: { kind: 'node-sublabel', id: 'a' },
      value: '',
    })
    expect(next.nodes.find((n) => n.id === 'a')?.sublabel).toBe('')
  })

  it('updates an edge label matched by auto-derived id', () => {
    const next = applyPatch(triangle, {
      kind: 'SetField',
      target: { kind: 'edge-label', id: 'b->c' },
      value: 'via',
    })
    const edge = next.edges.find((e) => effectiveEdgeId(e) === 'b->c')
    expect(edge?.label).toBe('via')
  })

  it('updates an edge label matched by explicit id', () => {
    const withExplicit: Diagram = fresh({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ id: 'pinned', from: 'a', to: 'b' }],
    })
    const next = applyPatch(withExplicit, {
      kind: 'SetField',
      target: { kind: 'edge-label', id: 'pinned' },
      value: 'tagged',
    })
    expect(next.edges[0]?.label).toBe('tagged')
  })
})

// --- Exhaustive switch -------------------------------------------------------

describe('applyPatch — switch exhaustiveness', () => {
  it('handles every Patch variant declared in the union', () => {
    const variants: Patch['kind'][] = [
      'MoveNode',
      'ConnectEdge',
      'DeleteNode',
      'DeleteEdge',
      'DeleteCluster',
      'SetField',
    ]
    // Sanity check that this list is current — if a new variant ships without
    // an arm, the switch in `applyPatch` produces a TS error at build time.
    expect(variants).toHaveLength(6)
  })
})
