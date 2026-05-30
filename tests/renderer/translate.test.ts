import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetTranslateWarnings,
  type InkinClusterData,
  type InkinEdgeData,
  type InkinNodeData,
  translate,
  xyflowPositionToAbsolute,
} from '../../src/renderer/translate'
import { parse } from '../../src/schema'

beforeEach(() => {
  __resetTranslateWarnings()
})

describe('translate() — basic shape', () => {
  it('returns empty arrays for an empty diagram', () => {
    const { nodes, edges } = translate(parse({ schemaVersion: 1, nodes: [], edges: [] }))
    expect(nodes).toEqual([])
    expect(edges).toEqual([])
  })

  it('maps schema nodes to xyflow nodes with correct type and data', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        nodes: [
          { id: 'a', label: 'Start', position: { x: 0, y: 0 } },
          {
            id: 'b',
            label: 'End',
            sublabel: 'terminal',
            shape: 'terminal',
            position: { x: 200, y: 0 },
          },
        ],
        edges: [],
      }),
    )
    expect(nodes).toHaveLength(2)
    const [a, b] = nodes
    expect(a?.id).toBe('a')
    expect(a?.type).toBe('rect')
    expect(a?.position).toEqual({ x: 0, y: 0 })
    expect((a?.data as InkinNodeData).label).toBe('Start')
    expect((a?.data as InkinNodeData).sublabel).toBeUndefined()

    expect(b?.id).toBe('b')
    expect(b?.type).toBe('terminal')
    expect((b?.data as InkinNodeData).label).toBe('End')
    expect((b?.data as InkinNodeData).sublabel).toBe('terminal')
  })

  it('maps schema edges to xyflow edges with auto-derived id and style data', () => {
    const { edges } = translate(
      parse({
        schemaVersion: 1,
        nodes: [
          { id: 'a', label: 'A', position: { x: 0, y: 0 } },
          { id: 'b', label: 'B', position: { x: 200, y: 0 } },
        ],
        edges: [{ from: 'a', to: 'b', label: 'go' }],
      }),
    )
    expect(edges).toHaveLength(1)
    const edge = edges[0]
    expect(edge?.id).toBe('a->b')
    expect(edge?.source).toBe('a')
    expect(edge?.target).toBe('b')
    expect(edge?.type).toBe('labeled')
    expect((edge?.data as InkinEdgeData).label).toBe('go')
    expect((edge?.data as InkinEdgeData).style).toBe('solid')
  })

  it('uses explicit edge id when supplied', () => {
    const { edges } = translate(
      parse({
        schemaVersion: 1,
        nodes: [
          { id: 'a', label: 'A', position: { x: 0, y: 0 } },
          { id: 'b', label: 'B', position: { x: 200, y: 0 } },
        ],
        edges: [{ id: 'transition-1', from: 'a', to: 'b' }],
      }),
    )
    expect(edges[0]?.id).toBe('transition-1')
  })

  it('passes dashed style through to edge data', () => {
    const { edges } = translate(
      parse({
        schemaVersion: 1,
        nodes: [
          { id: 'a', label: 'A', position: { x: 0, y: 0 } },
          { id: 'b', label: 'B', position: { x: 200, y: 0 } },
        ],
        edges: [{ from: 'a', to: 'b', style: 'dashed' }],
      }),
    )
    expect((edges[0]?.data as InkinEdgeData).style).toBe('dashed')
  })

  it('sets markerEnd: ArrowClosed on every edge for direction indication', () => {
    const { edges } = translate(
      parse({
        schemaVersion: 1,
        nodes: [
          { id: 'a', label: 'A', position: { x: 0, y: 0 } },
          { id: 'b', label: 'B', position: { x: 200, y: 0 } },
          { id: 'c', label: 'C', position: { x: 400, y: 0 } },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c', style: 'dashed' },
        ],
      }),
    )
    for (const edge of edges) {
      expect(edge.markerEnd).toBeDefined()
      // xyflow's MarkerType.ArrowClosed is the string 'arrowclosed' in v12
      expect((edge.markerEnd as { type: string }).type).toBe('arrowclosed')
    }
  })
})

describe('translate() — read-only mode (0.2.0)', () => {
  it('marks every node as non-selectable, non-draggable, non-connectable', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'g', label: 'Group' }],
        nodes: [
          { id: 'a', label: 'A', cluster: 'g', position: { x: 0, y: 0 } },
          { id: 'b', label: 'B', cluster: 'g', position: { x: 100, y: 0 } },
        ],
        edges: [],
      }),
    )
    for (const node of nodes) {
      expect(node.selectable).toBe(false)
      expect(node.draggable).toBe(false)
      expect(node.connectable).toBe(false)
    }
  })
})

describe('translate() — clusters', () => {
  it('emits cluster nodes BEFORE their child nodes (z-index order)', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'g', label: 'Group' }],
        nodes: [
          { id: 'a', label: 'A', cluster: 'g', position: { x: 0, y: 0 } },
          { id: 'b', label: 'B', cluster: 'g', position: { x: 100, y: 0 } },
        ],
        edges: [],
      }),
    )
    expect(nodes[0]?.id).toBe('g')
    expect(nodes[0]?.type).toBe('cluster')
    expect(nodes[1]?.id).toBe('a')
    expect(nodes[2]?.id).toBe('b')
  })

  it('sets parentId and extent on children belonging to a cluster', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'g', label: 'Group' }],
        nodes: [{ id: 'a', label: 'A', cluster: 'g', position: { x: 0, y: 0 } }],
        edges: [],
      }),
    )
    const childNode = nodes.find((n) => n.id === 'a')
    expect(childNode?.parentId).toBe('g')
    expect(childNode?.extent).toBe('parent')
  })

  it('does NOT set parentId on nodes outside a cluster', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        nodes: [{ id: 'a', label: 'A', position: { x: 0, y: 0 } }],
        edges: [],
      }),
    )
    expect(nodes[0]?.parentId).toBeUndefined()
    expect(nodes[0]?.extent).toBeUndefined()
  })

  it('converts child position from absolute (layout output) to relative (xyflow expects)', () => {
    // Two children at absolute (100, 100) and (200, 100); cluster bounds should
    // start before (100, 100) due to padding+label, and children's relative
    // positions should be (childAbsX - clusterAbsX, childAbsY - clusterAbsY).
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'g', label: 'Group' }],
        nodes: [
          { id: 'a', label: 'A', cluster: 'g', position: { x: 100, y: 100 } },
          { id: 'b', label: 'B', cluster: 'g', position: { x: 200, y: 100 } },
        ],
        edges: [],
      }),
    )
    const cluster = nodes.find((n) => n.id === 'g')
    const childA = nodes.find((n) => n.id === 'a')

    // The cluster sits to the upper-left of its children (because of padding+label space).
    expect(cluster?.position.x).toBeLessThan(100)
    expect(cluster?.position.y).toBeLessThan(100)

    // Child A's relative position should be (100 - cluster.x, 100 - cluster.y).
    expect(childA?.position.x).toBe(100 - (cluster?.position.x ?? 0))
    expect(childA?.position.y).toBe(100 - (cluster?.position.y ?? 0))
  })

  it('computes cluster width/height to fully contain children + padding + label', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'g', label: 'Group' }],
        nodes: [
          { id: 'a', label: 'A', cluster: 'g', position: { x: 0, y: 0 } },
          // Node B is 200px to the right
          { id: 'b', label: 'B', cluster: 'g', position: { x: 200, y: 0 } },
        ],
        edges: [],
      }),
    )
    const cluster = nodes.find((n) => n.id === 'g')
    const style = cluster?.style as { width: number; height: number } | undefined

    // Children span from x=0 to x=380 (200 + 180px node width).
    // Cluster width should accommodate that + 2 * padding (16) = 380 + 32 = 412.
    expect(style?.width).toBe(412)
    // Children span y=0 to y=60 (base node height with no sublabel).
    // Cluster height = 60 + 2 * padding (16) + label space (28) = 120.
    expect(style?.height).toBe(120)
  })

  it('attaches the cluster label to cluster.data', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'g', label: 'My Cluster' }],
        nodes: [{ id: 'a', label: 'A', cluster: 'g', position: { x: 0, y: 0 } }],
        edges: [],
      }),
    )
    const cluster = nodes.find((n) => n.id === 'g')
    expect((cluster?.data as InkinClusterData).label).toBe('My Cluster')
  })

  it('handles empty clusters (no children) with a fallback size', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'empty', label: 'Empty Cluster' }],
        nodes: [],
        edges: [],
      }),
    )
    const cluster = nodes.find((n) => n.id === 'empty')
    expect(cluster).toBeDefined()
    expect(cluster?.style).toMatchObject({ width: 200, height: 100 })
  })
})

describe('translate() — warnings (once per process)', () => {
  it('warns about nested clusters exactly once even if called multiple times', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const input = parse({
      schemaVersion: 1,
      clusters: [
        { id: 'outer', label: 'Outer' },
        { id: 'inner', label: 'Inner', parent: 'outer' },
      ],
      nodes: [],
      edges: [],
    })

    translate(input)
    translate(input)
    translate(input)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('nested clusters')
    warn.mockRestore()
  })

  it('does NOT warn about nested clusters when none are nested', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    translate(
      parse({
        schemaVersion: 1,
        clusters: [{ id: 'g', label: 'Group' }],
        nodes: [],
        edges: [],
      }),
    )
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('warns once about unpositioned nodes and falls back to (0, 0)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const input = parse({
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'A' }], // no position
      edges: [],
    })
    const { nodes } = translate(input)
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('no position')
    warn.mockRestore()
  })

  it('preserves explicit positions verbatim (no warning)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        nodes: [{ id: 'a', label: 'A', position: { x: 42, y: -7 } }],
        edges: [],
      }),
    )
    expect(nodes[0]?.position).toEqual({ x: 42, y: -7 })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('xyflowPositionToAbsolute() — reverse of translate()s position conversion', () => {
  it('passes through unchanged when no parent is provided (top-level node)', () => {
    expect(xyflowPositionToAbsolute({ x: 42, y: -7 })).toEqual({ x: 42, y: -7 })
  })

  it('adds the parent cluster origin back when reversing a clustered child', () => {
    expect(xyflowPositionToAbsolute({ x: 50, y: 25 }, { x: 100, y: 200 })).toEqual({
      x: 150,
      y: 225,
    })
  })

  it('handles negative coordinates symmetrically', () => {
    expect(xyflowPositionToAbsolute({ x: -10, y: -20 }, { x: -30, y: -40 })).toEqual({
      x: -40,
      y: -60,
    })
  })

  it('round-trips both clustered and unclustered nodes through translate() within 1 px', () => {
    // A diagram mixing clustered children with a top-level loose node. Every node
    // must survive translate→reverse with a delta below 1 px from the original
    // schema-absolute position. Anything larger is a bug in the math.
    const source = parse({
      schemaVersion: 1,
      clusters: [
        { id: 'left', label: 'left' },
        { id: 'right', label: 'right' },
      ],
      nodes: [
        { id: 'a', label: 'A', cluster: 'left', position: { x: 100, y: 100 } },
        { id: 'b', label: 'B', cluster: 'left', position: { x: 200, y: 100 } },
        { id: 'c', label: 'C', cluster: 'right', position: { x: 500, y: 250 } },
        { id: 'loose', label: 'L', position: { x: -75, y: -200 } },
      ],
      edges: [],
    })

    const { nodes: xyNodes } = translate(source)
    const clustersById = new Map(xyNodes.filter((n) => n.type === 'cluster').map((c) => [c.id, c]))

    for (const original of source.nodes) {
      const xyNode = xyNodes.find((n) => n.id === original.id)
      expect(xyNode).toBeDefined()
      if (xyNode === undefined) continue

      const parent =
        xyNode.parentId !== undefined ? clustersById.get(xyNode.parentId) : undefined
      const recovered = xyflowPositionToAbsolute(xyNode.position, parent?.position)
      const expected = original.position ?? { x: 0, y: 0 }

      expect(Math.abs(recovered.x - expected.x)).toBeLessThan(1)
      expect(Math.abs(recovered.y - expected.y)).toBeLessThan(1)
    }
  })
})

describe('translate() — node data shape (exactOptionalPropertyTypes friendly)', () => {
  it('omits sublabel from data when the source node has no sublabel', () => {
    const { nodes } = translate(
      parse({
        schemaVersion: 1,
        nodes: [{ id: 'a', label: 'A', position: { x: 0, y: 0 } }],
        edges: [],
      }),
    )
    const data = nodes[0]?.data as InkinNodeData
    expect('sublabel' in data).toBe(false)
  })

  it('omits label from edge data when the source edge has no label', () => {
    const { edges } = translate(
      parse({
        schemaVersion: 1,
        nodes: [
          { id: 'a', label: 'A', position: { x: 0, y: 0 } },
          { id: 'b', label: 'B', position: { x: 200, y: 0 } },
        ],
        edges: [{ from: 'a', to: 'b' }],
      }),
    )
    const data = edges[0]?.data as InkinEdgeData
    expect('label' in data).toBe(false)
    expect(data.style).toBe('solid')
  })
})
