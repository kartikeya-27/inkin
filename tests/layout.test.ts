import { describe, expect, it } from 'vitest'
import { createDagreLayout, type Diagram, layout, parse } from '../src/schema'

const sample: Diagram = parse({
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
})

describe('layout()', () => {
  it('returns positions for every node', () => {
    const out = layout(sample)
    for (const n of out.nodes) {
      expect(n.position).toBeDefined()
      expect(typeof n.position?.x).toBe('number')
      expect(typeof n.position?.y).toBe('number')
    }
  })

  it('preserves user-supplied positions verbatim', () => {
    const withFixed: Diagram = {
      ...sample,
      nodes: sample.nodes.map((n) => (n.id === 'a' ? { ...n, position: { x: -999, y: 42 } } : n)),
    }
    const out = layout(withFixed)
    const a = out.nodes.find((n) => n.id === 'a')
    expect(a?.position).toEqual({ x: -999, y: 42 })
  })

  it('is deterministic for fixed input (same input → same positions)', () => {
    const out1 = layout(sample)
    const out2 = layout(sample)
    for (const n1 of out1.nodes) {
      const n2 = out2.nodes.find((n) => n.id === n1.id)
      expect(n2?.position).toEqual(n1.position)
    }
  })

  it('respects custom layout direction', () => {
    const lr = layout(sample, createDagreLayout({ direction: 'LR' }))
    const tb = layout(sample, createDagreLayout({ direction: 'TB' }))
    // LR layout: x of 'c' should be > x of 'a'
    const lrA = lr.nodes.find((n) => n.id === 'a')!
    const lrC = lr.nodes.find((n) => n.id === 'c')!
    expect(lrC.position!.x).toBeGreaterThan(lrA.position!.x)
    // TB layout: y of 'c' should be > y of 'a'
    const tbA = tb.nodes.find((n) => n.id === 'a')!
    const tbC = tb.nodes.find((n) => n.id === 'c')!
    expect(tbC.position!.y).toBeGreaterThan(tbA.position!.y)
  })

  it('skips dagre entirely when all nodes already have positions', () => {
    const fullyPositioned: Diagram = {
      ...sample,
      nodes: sample.nodes.map((n, i) => ({ ...n, position: { x: i * 100, y: 0 } })),
    }
    const out = layout(fullyPositioned)
    expect(out.nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ])
  })

  it('handles clusters via dagre compound graphs', () => {
    const clustered = parse({
      schemaVersion: 1,
      clusters: [{ id: 'g', label: 'Group' }],
      nodes: [
        { id: 'a', label: 'A', cluster: 'g' },
        { id: 'b', label: 'B', cluster: 'g' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    })
    const out = layout(clustered)
    for (const n of out.nodes) {
      expect(n.position).toBeDefined()
    }
  })
})
