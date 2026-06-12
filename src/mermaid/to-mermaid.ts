/**
 * `toMermaid` — emit an inkin `Diagram` as Mermaid `flowchart` text.
 * Phase 7 of the 0.6.0 plan.
 *
 * The reverse of `fromMermaid`. inkin's `Diagram` is a flat graph with
 * no `flowchart` / `stateDiagram` discriminator, so `toMermaid` always
 * emits a `flowchart` — a state diagram imported via `fromMermaid`
 * round-trips back through the flat-graph representation, which is the
 * round-trip contract (semantic equivalence at the `Diagram` level, not
 * byte-identical Mermaid text — decision #7).
 *
 * Canonical output forms (see
 * `notes/mermaid-grammar-snapshot/grammar-snapshot.md`):
 *
 *   Node { shape: 'rect',     label: L }  → `id[L]`
 *   Node { shape: 'terminal', label: L }  → `id((L))`
 *   Edge { style: 'solid',  label?: L }   → `from --> to`   / `from -->|L| to`
 *   Edge { style: 'dashed', label?: L }   → `from -.-> to`  / `from -.->|L| to`
 *   Cluster { id, label }                 → `subgraph id[label]` … `end`
 *   Flow                                  → dropped (one console.warn)
 *
 * Every node is declared explicitly (with its label) so the round-trip
 * preserves labels; clustered nodes are declared inside their
 * `subgraph` block, the rest at top level, and all edges follow.
 *
 * Attribution: Mermaid output syntax per mermaid-js/mermaid HEAD
 * `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5` (MIT). Emitter is inkin's
 * own.
 */

import type { Diagram as DiagramType, Edge, Node } from '../schema/types'

export interface ToMermaidOptions {
  /**
   * Flowchart layout direction written into the header
   * (`flowchart <dir>`). inkin's `Diagram` doesn't store a direction
   * (it's a render-time layout concern), so the caller supplies it.
   * Default `'TB'`.
   */
  readonly direction?: 'TB' | 'BT' | 'LR' | 'RL'
}

/**
 * Emit a `Diagram` as Mermaid `flowchart` source text.
 *
 * @param diagram A valid inkin `Diagram`.
 * @param options Output options (layout direction).
 * @returns Mermaid flowchart source. Deterministic for a given input.
 */
export function toMermaid(diagram: DiagramType, options?: ToMermaidOptions): string {
  const direction = options?.direction ?? 'TB'
  const lines: string[] = [`flowchart ${direction}`]

  if (diagram.flows !== undefined && diagram.flows.length > 0) {
    console.warn(
      "[inkin] toMermaid: `flows` aren't representable in Mermaid (no animation primitive); dropped from the export.",
    )
  }

  const clusters = diagram.clusters ?? []
  const clusterIds = new Set(clusters.map((c) => c.id))

  // Group nodes by cluster membership. A node whose `cluster` doesn't
  // resolve to a declared cluster (shouldn't happen for a valid Diagram
  // — `superRefine` enforces it — but defensive) is treated as top-level.
  const byCluster = new Map<string, Node[]>()
  const topLevel: Node[] = []
  for (const node of diagram.nodes) {
    if (node.cluster !== undefined && clusterIds.has(node.cluster)) {
      const arr = byCluster.get(node.cluster) ?? []
      arr.push(node)
      byCluster.set(node.cluster, arr)
    } else {
      topLevel.push(node)
    }
  }

  // Subgraphs first, each with its child node declarations.
  for (const cluster of clusters) {
    lines.push(`subgraph ${cluster.id}${clusterLabelSuffix(cluster.id, cluster.label)}`)
    for (const node of byCluster.get(cluster.id) ?? []) {
      lines.push(`  ${emitNode(node)}`)
    }
    lines.push('end')
  }

  // Top-level node declarations.
  for (const node of topLevel) {
    lines.push(emitNode(node))
  }

  // All edges (inkin edges don't carry cluster membership, so they're
  // always written at the top level — they reference nodes by id).
  for (const edge of diagram.edges) {
    lines.push(emitEdge(edge))
  }

  return lines.join('\n')
}

/** `subgraph id[label]` suffix. When the label equals the id, Mermaid
 * renders the id anyway, so the bracket is omitted for a cleaner output
 * (`subgraph id`) — both round-trip to the same cluster. */
function clusterLabelSuffix(id: string, label: string): string {
  return label === id ? '' : `[${label}]`
}

/** A single node declaration in canonical form. */
function emitNode(node: Node): string {
  if (node.shape === 'terminal') {
    return `${node.id}((${node.label}))`
  }
  return `${node.id}[${node.label}]`
}

/** A single edge in canonical form. */
function emitEdge(edge: Edge): string {
  const arrow = edge.style === 'dashed' ? '-.->' : '-->'
  if (edge.label !== undefined && edge.label.length > 0) {
    return `${edge.from} ${arrow}|${edge.label}| ${edge.to}`
  }
  return `${edge.from} ${arrow} ${edge.to}`
}
