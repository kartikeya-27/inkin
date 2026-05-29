import { MarkerType, type Edge as XyEdge, type Node as XyNode } from '@xyflow/react'
import type { Diagram, Node as InkinNode } from '../schema/types'

/**
 * Pure schema-to-xyflow translation.
 *
 * Given a validated and (typically) pre-positioned {@link Diagram}, produces the
 * `{ nodes, edges }` arrays xyflow expects. Stateless and side-effect-free apart
 * from at-most-two once-per-process `console.warn` calls when the input has
 * known-quirky shape (nested clusters or unpositioned nodes).
 *
 * Cluster handling — the load-bearing part:
 *   1. Each {@link Diagram} cluster becomes an xyflow node with `type: 'cluster'`.
 *   2. Each child node (`Node.cluster === clusterId`) becomes an xyflow node with
 *      `parentId: clusterId` and `extent: 'parent'` — xyflow's compound-graph
 *      primitive gives drag-within-bounds + move-cluster-moves-children for free.
 *   3. Cluster nodes are emitted BEFORE child nodes in the output array so xyflow
 *      renders them behind their children (z-index follows array order).
 *   4. Cluster position + size are derived from the bounding box of the cluster's
 *      children (after the layout step has assigned positions). Child positions
 *      are then converted from absolute (what `layout()` produces) to relative
 *      (what xyflow expects when `parentId` is set).
 *   5. Cluster `parent` field (for nested clusters) is currently ignored with a
 *      console.warn — nested rendering lands in `1.2.0` with elkjs.
 *
 * The dimension constants below MUST stay in lockstep with `src/schema/layout.ts`
 * (the layout engine assumes these node sizes) and with the per-component CSS
 * Modules (which render nodes at these dimensions). Changing one without the
 * others produces visual bugs (mis-laid-out clusters, overlapping nodes).
 */

// Keep in sync with src/schema/layout.ts.
const NODE_WIDTH = 180
const NODE_HEIGHT_BASE = 60
const NODE_HEIGHT_WITH_SUBLABEL = 84

// Cluster visual constants — should match clusters/Cluster.module.css padding.
const CLUSTER_PADDING = 16
const CLUSTER_LABEL_HEIGHT = 28

// Minimum size for an empty cluster (no children laid out yet).
const EMPTY_CLUSTER_SIZE = { width: 200, height: 100 } as const

const FALLBACK_POSITION = { x: 0, y: 0 } as const

// Module-scoped flags so we don't spam consumers in render loops.
let _nestedClusterWarningEmitted = false
let _missingPositionWarningEmitted = false

/** Data attached to every regular (rect/terminal) xyflow node by translate(). */
export interface InkinNodeData extends Record<string, unknown> {
  readonly label: string
  readonly sublabel?: string
}

/** Data attached to every xyflow edge by translate(). */
export interface InkinEdgeData extends Record<string, unknown> {
  readonly label?: string
  readonly style: 'solid' | 'dashed'
}

/** Data attached to every cluster (group) xyflow node by translate(). */
export interface InkinClusterData extends Record<string, unknown> {
  readonly label: string
}

/** Result of {@link translate} — ready to hand directly to `<ReactFlow>`. */
export interface TranslatedDiagram {
  readonly nodes: XyNode[]
  readonly edges: XyEdge[]
}

function nodeHeight(hasSublabel: boolean): number {
  return hasSublabel ? NODE_HEIGHT_WITH_SUBLABEL : NODE_HEIGHT_BASE
}

/**
 * Compute the bounding box that contains all given children plus padding +
 * label area at the top. Returns absolute coordinates.
 */
function computeClusterBounds(children: readonly InkinNode[]): {
  x: number
  y: number
  width: number
  height: number
} {
  const positioned = children.filter((c) => c.position !== undefined)
  if (positioned.length === 0) {
    return { x: 0, y: 0, ...EMPTY_CLUSTER_SIZE }
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const child of positioned) {
    // biome-ignore lint/style/noNonNullAssertion: filtered above to defined-position children
    const pos = child.position!
    const h = nodeHeight(child.sublabel !== undefined)
    if (pos.x < minX) minX = pos.x
    if (pos.x + NODE_WIDTH > maxX) maxX = pos.x + NODE_WIDTH
    if (pos.y < minY) minY = pos.y
    if (pos.y + h > maxY) maxY = pos.y + h
  }

  return {
    x: minX - CLUSTER_PADDING,
    y: minY - CLUSTER_PADDING - CLUSTER_LABEL_HEIGHT,
    width: maxX - minX + CLUSTER_PADDING * 2,
    height: maxY - minY + CLUSTER_PADDING * 2 + CLUSTER_LABEL_HEIGHT,
  }
}

/**
 * Translate a positioned Diagram into xyflow's nodes + edges arrays.
 *
 * Expects every node to have a `position` (call `layout(diagram)` from
 * `@inkin/core/schema` first, or supply positions manually). Nodes without
 * positions are placed at (0, 0) and a console.warn is emitted once.
 */
export function translate(diagram: Diagram): TranslatedDiagram {
  if (!_nestedClusterWarningEmitted && diagram.clusters?.some((c) => c.parent !== undefined)) {
    _nestedClusterWarningEmitted = true
    console.warn(
      '[inkin] nested clusters (Cluster.parent) are accepted by the schema but flattened in the 0.x renderer. Nested cluster rendering lands in 1.2.0 with elkjs. (This warning fires once per process.)',
    )
  }

  // Group children by cluster for bbox computation.
  const childrenByCluster = new Map<string, InkinNode[]>()
  for (const node of diagram.nodes) {
    if (node.cluster !== undefined) {
      const list = childrenByCluster.get(node.cluster) ?? []
      list.push(node)
      childrenByCluster.set(node.cluster, list)
    }
  }

  // 1. Cluster nodes first — xyflow renders them behind children (z-index = array order).
  const clusterNodes: XyNode<InkinClusterData>[] = (diagram.clusters ?? []).map((cluster) => {
    const children = childrenByCluster.get(cluster.id) ?? []
    const bounds = computeClusterBounds(children)
    return {
      id: cluster.id,
      type: 'cluster',
      position: { x: bounds.x, y: bounds.y },
      data: { label: cluster.label },
      style: { width: bounds.width, height: bounds.height },
      // Read-only renderer (0.2.0): no selection, drag, or new connections.
      selectable: false,
      draggable: false,
      connectable: false,
    }
  })

  // Cluster absolute positions, for converting child absolute → relative below.
  const clusterAbsolutePositions = new Map<string, { x: number; y: number }>(
    clusterNodes.map((c) => [c.id, c.position]),
  )

  // 2. Regular nodes.
  const regularNodes: XyNode<InkinNodeData>[] = diagram.nodes.map((node) => {
    if (node.position === undefined && !_missingPositionWarningEmitted) {
      _missingPositionWarningEmitted = true
      console.warn(
        `[inkin] node "${node.id}" has no position. Call layout(diagram) from @inkin/core/schema before rendering, or supply explicit positions on each node. Falling back to (0, 0). (This warning fires once per process.)`,
      )
    }
    const absolutePos = node.position ?? FALLBACK_POSITION

    // When a node belongs to a cluster, xyflow expects its position to be RELATIVE
    // to the cluster's top-left, not absolute. Subtract the cluster's position.
    const parentPos =
      node.cluster !== undefined ? clusterAbsolutePositions.get(node.cluster) : undefined
    const position = parentPos
      ? { x: absolutePos.x - parentPos.x, y: absolutePos.y - parentPos.y }
      : absolutePos

    const data: InkinNodeData =
      node.sublabel !== undefined
        ? { label: node.label, sublabel: node.sublabel }
        : { label: node.label }

    const xyNode: XyNode<InkinNodeData> = {
      id: node.id,
      type: node.shape, // 'rect' | 'terminal' — matches keys in renderer/nodes/nodeTypes
      position,
      data,
      // Read-only renderer (0.2.0): same constraints as cluster nodes above.
      selectable: false,
      draggable: false,
      connectable: false,
    }

    if (node.cluster !== undefined) {
      xyNode.parentId = node.cluster
      xyNode.extent = 'parent'
    }

    return xyNode
  })

  // 3. Edges. Auto-derive id from `${from}->${to}` if the schema didn't supply one.
  // Every edge gets a closed-arrow marker at the target end — direction matters
  // in state machines and architecture diagrams; the arrowhead is the visual cue.
  // xyflow auto-generates the SVG <marker> defs for each unique marker config.
  const edges: XyEdge<InkinEdgeData>[] = diagram.edges.map((edge) => {
    const data: InkinEdgeData =
      edge.label !== undefined ? { label: edge.label, style: edge.style } : { style: edge.style }
    return {
      id: edge.id ?? `${edge.from}->${edge.to}`,
      type: 'labeled',
      source: edge.from,
      target: edge.to,
      data,
      markerEnd: { type: MarkerType.ArrowClosed },
    }
  })

  return {
    nodes: [...clusterNodes, ...regularNodes] as XyNode[],
    edges: edges as XyEdge[],
  }
}

/**
 * Test-only: reset the once-per-process warning flags so a test suite can
 * exercise the warning path multiple times. Not exported from the package's
 * public surface — internal to the renderer + its tests.
 */
export function __resetTranslateWarnings(): void {
  _nestedClusterWarningEmitted = false
  _missingPositionWarningEmitted = false
}
