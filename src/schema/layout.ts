import dagre from '@dagrejs/dagre'
import type { Diagram } from './types'

/**
 * Pluggable auto-layout interface. v0.1.0 ships `dagreLayout`; v1.2.0 adds
 * `elkLayout` for nested-cluster auto-layout. Consumers can supply their own.
 */
export interface LayoutEngine {
  /**
   * Take a Diagram with possibly-unpositioned nodes, return a Diagram with
   * every node carrying a `position`. Nodes that already have a `position`
   * MUST be preserved verbatim (user-provided positions win).
   */
  layout(diagram: Diagram): Diagram
}

export interface LayoutOptions {
  /** 'LR' = left-to-right (default), 'TB' = top-to-bottom, etc. — passed to dagre. */
  direction?: 'TB' | 'BT' | 'LR' | 'RL'
  /** Horizontal spacing between nodes in the same rank. */
  nodesep?: number
  /** Vertical spacing between ranks. */
  ranksep?: number
}

const NODE_WIDTH = 180
const NODE_HEIGHT_BASE = 60
const NODE_HEIGHT_WITH_SUBLABEL = 84

function nodeHeight(hasSublabel: boolean): number {
  return hasSublabel ? NODE_HEIGHT_WITH_SUBLABEL : NODE_HEIGHT_BASE
}

// Module-scoped flag — the nested-cluster warning fires once per process,
// not per layout() call. Consumers running layout in a tight loop don't get spammed.
let _nestedClusterWarningEmitted = false

/**
 * Default layout engine: @dagrejs/dagre 1.x (maintained fork of dagre).
 * Handles flat clusters via dagre's compound-graph support. Nested clusters
 * are flattened with a console warning (full nested support lands in 1.2.0
 * with elkjs).
 */
export function createDagreLayout(options: LayoutOptions = {}): LayoutEngine {
  const direction = options.direction ?? 'LR'
  const nodesep = options.nodesep ?? 50
  const ranksep = options.ranksep ?? 80

  return {
    layout(diagram: Diagram): Diagram {
      // If every node already has a position, skip the dagre run entirely.
      if (diagram.nodes.every((n) => n.position !== undefined)) {
        return diagram
      }

      const g = new dagre.graphlib.Graph({ compound: true, multigraph: true })
      g.setGraph({ rankdir: direction, nodesep, ranksep, marginx: 20, marginy: 20 })
      g.setDefaultEdgeLabel(() => ({}))

      // Warn once per process if nested clusters are present — 0.x renderers flatten them.
      if (!_nestedClusterWarningEmitted && diagram.clusters?.some((c) => c.parent !== undefined)) {
        _nestedClusterWarningEmitted = true
        console.warn(
          '[inkin] nested clusters (Cluster.parent) are accepted by the schema but flattened in 0.x renderers. Full nested rendering lands in 1.2.0 with elkjs. (This warning fires once per process.)',
        )
      }

      // Register clusters as compound parents in dagre. We give them tiny placeholder
      // dimensions; dagre expands them to fit their children.
      if (diagram.clusters) {
        for (const cluster of diagram.clusters) {
          g.setNode(cluster.id, { label: cluster.label, width: 1, height: 1 })
        }
      }

      // Register nodes.
      for (const node of diagram.nodes) {
        g.setNode(node.id, {
          width: NODE_WIDTH,
          height: nodeHeight(node.sublabel !== undefined),
        })
        if (node.cluster !== undefined) {
          g.setParent(node.id, node.cluster)
        }
      }

      // Register edges.
      for (const edge of diagram.edges) {
        g.setEdge(edge.from, edge.to)
      }

      dagre.layout(g)

      // Read positions back, preserving user-provided positions.
      const positionedNodes = diagram.nodes.map((node) => {
        if (node.position !== undefined) return node
        const dagreNode = g.node(node.id)
        const h = nodeHeight(node.sublabel !== undefined)
        // dagre gives center coords; inkin's Position is top-left.
        return {
          ...node,
          position: {
            x: dagreNode.x - NODE_WIDTH / 2,
            y: dagreNode.y - h / 2,
          },
        }
      })

      return { ...diagram, nodes: positionedNodes }
    },
  }
}

/** Default exported engine — dagre with sensible defaults. */
export const dagreLayout: LayoutEngine = createDagreLayout()

/** Convenience wrapper: `layout(diagram)` uses the default dagre engine. */
export function layout(diagram: Diagram, engine: LayoutEngine = dagreLayout): Diagram {
  return engine.layout(diagram)
}
