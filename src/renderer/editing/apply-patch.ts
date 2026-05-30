import type { Cluster, Diagram, Edge, Flow, Node } from '../../schema/types'
import type {
  ConnectEdgePatch,
  DeleteClusterPatch,
  DeleteEdgePatch,
  DeleteNodePatch,
  MoveNodePatch,
  Patch,
  SetFieldPatch,
} from './patches'

/**
 * Pure reducer for schema mutations. `applyPatch(diagram, patch)` returns the
 * next `Diagram` — same outer object identity is NOT guaranteed; treat the
 * result as opaque. Untouched slices keep array identity where possible (so
 * downstream memoization that selects, say, `clusters` doesn't invalidate on
 * an edge edit).
 *
 * Invariants this function upholds (all enforced by the schema's
 * `superRefine` and gated by `safeParse` at the dispatcher boundary):
 *
 *   - Edge id uniqueness — auto-derived (`${from}->${to}`) or explicit. The
 *     `ConnectEdge` arm assigns an explicit collision-free id only when the
 *     default would clash.
 *   - Edge endpoint resolution — every `from`/`to` must reference an
 *     existing `Node.id`. `DeleteNode` removes incident edges in the same
 *     pass to keep this invariant true.
 *   - Cluster reference resolution — every `Node.cluster` must reference an
 *     existing `Cluster.id`. `DeleteCluster` strips the field from child
 *     nodes (no dangling refs).
 *   - Flow edge resolution — every `Flow.edges[i]` must resolve to either
 *     an explicit edge id or the auto-derived form. `DeleteNode` /
 *     `DeleteEdge` prune affected flow entries; flows that empty out are
 *     dropped entirely.
 *
 * The dispatcher (in `sync.ts`) calls `safeParse` on the reducer output as
 * defense in depth. If a reducer arm ever produces invalid state, the bug
 * is caught before `onChange` fires — see `useFlowSync`.
 */
export function applyPatch(diagram: Diagram, patch: Patch): Diagram {
  switch (patch.kind) {
    case 'MoveNode':
      return applyMoveNode(diagram, patch)
    case 'ConnectEdge':
      return applyConnectEdge(diagram, patch)
    case 'DeleteNode':
      return applyDeleteNode(diagram, patch)
    case 'DeleteEdge':
      return applyDeleteEdge(diagram, patch)
    case 'DeleteCluster':
      return applyDeleteCluster(diagram, patch)
    case 'SetField':
      return applySetField(diagram, patch)
  }
}

// --- MoveNode ----------------------------------------------------------------

function applyMoveNode(diagram: Diagram, patch: MoveNodePatch): Diagram {
  const nodes = diagram.nodes.map<Node>((node) =>
    node.id === patch.nodeId
      ? { ...node, position: { x: patch.position.x, y: patch.position.y } }
      : node,
  )
  return { ...diagram, nodes }
}

// --- ConnectEdge -------------------------------------------------------------

/**
 * Compute the effective id of an edge — explicit if set, otherwise the
 * `${from}->${to}` form the schema uses for default identity. Matches the
 * helper used inside the schema's `superRefine`.
 */
function effectiveEdgeId(edge: Edge): string {
  return edge.id ?? `${edge.from}->${edge.to}`
}

/**
 * For a new edge `from → to`, decide whether an explicit `id` is required.
 * - If the default `${from}->${to}` form is unused, return `undefined` (the
 *   edge keeps the implicit id, matching how authored diagrams look).
 * - If the default would clash with an existing edge, generate the first
 *   collision-free `${from}->${to}#N` for N ≥ 2.
 */
function pickConnectEdgeId(diagram: Diagram, from: string, to: string): string | undefined {
  const base = `${from}->${to}`
  const taken = new Set<string>(diagram.edges.map(effectiveEdgeId))
  if (!taken.has(base)) return undefined
  let n = 2
  while (taken.has(`${base}#${n}`)) n++
  return `${base}#${n}`
}

function applyConnectEdge(diagram: Diagram, patch: ConnectEdgePatch): Diagram {
  const id = pickConnectEdgeId(diagram, patch.from, patch.to)
  const next: Edge =
    id === undefined
      ? { from: patch.from, to: patch.to, style: 'solid' }
      : { id, from: patch.from, to: patch.to, style: 'solid' }
  return { ...diagram, edges: [...diagram.edges, next] }
}

// --- DeleteNode --------------------------------------------------------------

function applyDeleteNode(diagram: Diagram, patch: DeleteNodePatch): Diagram {
  const nodes = diagram.nodes.filter((node) => node.id !== patch.nodeId)
  if (nodes.length === diagram.nodes.length) return diagram

  const removedEdgeIds = new Set<string>()
  const edges = diagram.edges.filter((edge) => {
    if (edge.from === patch.nodeId || edge.to === patch.nodeId) {
      removedEdgeIds.add(effectiveEdgeId(edge))
      return false
    }
    return true
  })

  return withPrunedFlows({ ...diagram, nodes, edges }, removedEdgeIds)
}

// --- DeleteEdge --------------------------------------------------------------

function applyDeleteEdge(diagram: Diagram, patch: DeleteEdgePatch): Diagram {
  const removed = new Set<string>([patch.edgeId])
  // Also accept the auto-derived form when the caller passes that.
  const edges = diagram.edges.filter((edge) => effectiveEdgeId(edge) !== patch.edgeId)
  if (edges.length === diagram.edges.length) return diagram
  return withPrunedFlows({ ...diagram, edges }, removed)
}

/**
 * Apply `pruneFlows` to the input diagram's `flows` and return a new diagram
 * with either the pruned array, or — if pruning empties the list — the
 * `flows` field stripped entirely. We drop the field rather than leave
 * `flows: []` because the schema treats `flows` as optional and consumers'
 * downstream filters read cleaner against absence than against an empty
 * array.
 */
function withPrunedFlows(base: Diagram, removed: ReadonlySet<string>): Diagram {
  if (base.flows === undefined) return base
  const pruned = pruneFlows(base.flows, removed)
  if (pruned.length === 0) {
    const { flows: _drop, ...rest } = base
    return rest as Diagram
  }
  if (pruned === base.flows) return base
  return { ...base, flows: pruned }
}

/**
 * Strip removed edge ids from every flow; drop flows that empty out.
 *
 * A flow's `edges` array is ordered and must have at least one entry per the
 * schema, so emptied flows cannot be preserved — they're removed entirely.
 *
 * Returns the input array reference when no flow was affected, so that
 * downstream memoization keyed on `flows` doesn't invalidate on an unrelated
 * change.
 */
function pruneFlows(flows: Flow[], removed: ReadonlySet<string>): Flow[] {
  let changed = false
  const pruned: Flow[] = []
  for (const flow of flows) {
    const filtered = flow.edges.filter((id) => !removed.has(id))
    if (filtered.length === 0) {
      changed = true
      continue
    }
    if (filtered.length === flow.edges.length) {
      pruned.push(flow)
      continue
    }
    changed = true
    pruned.push({ ...flow, edges: filtered })
  }
  return changed ? pruned : flows
}

// --- DeleteCluster -----------------------------------------------------------

function applyDeleteCluster(diagram: Diagram, patch: DeleteClusterPatch): Diagram {
  if (diagram.clusters === undefined) return diagram
  const clusters = diagram.clusters.filter((cluster) => cluster.id !== patch.clusterId)
  if (clusters.length === diagram.clusters.length) return diagram

  const nodes = diagram.nodes.map<Node>((node) => {
    if (node.cluster !== patch.clusterId) return node
    const { cluster: _stripped, ...rest } = node
    return rest as Node
  })

  return { ...diagram, nodes, clusters }
}

// --- SetField ----------------------------------------------------------------

function applySetField(diagram: Diagram, patch: SetFieldPatch): Diagram {
  switch (patch.target.kind) {
    case 'node-label': {
      const id = patch.target.id
      const nodes = diagram.nodes.map<Node>((node) =>
        node.id === id ? { ...node, label: patch.value } : node,
      )
      return { ...diagram, nodes }
    }
    case 'node-sublabel': {
      const id = patch.target.id
      const nodes = diagram.nodes.map<Node>((node) =>
        node.id === id ? { ...node, sublabel: patch.value } : node,
      )
      return { ...diagram, nodes }
    }
    case 'edge-label': {
      const id = patch.target.id
      const edges = diagram.edges.map<Edge>((edge) =>
        effectiveEdgeId(edge) === id ? { ...edge, label: patch.value } : edge,
      )
      return { ...diagram, edges }
    }
  }
}

// Re-export shared types so tests don't need a parallel import path.
export type { Cluster, Edge, Flow, Node }
// Exported for tests + sync hook. Pure helpers, no state.
export { effectiveEdgeId, pickConnectEdgeId, pruneFlows }
