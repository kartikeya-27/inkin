import type { Node } from '@xyflow/react'
import type { Diagram } from '../../schema/types'

/**
 * Pure decision helper for cross-cluster drag-and-drop reassignment
 * (Phase 9). Extracted from `useFlowSync.onNodeDragStop` so the
 * decision logic can be unit-tested without mocking xyflow's
 * `useReactFlow` instance.
 *
 * Inputs:
 *   - `droppedNodeId`: the schema id of the node the user just dropped
 *   - `intersecting`: every xyflow node whose bounds overlap the dropped
 *     node's bounds (the result of `reactFlow.getIntersectingNodes`).
 *     The function filters this internally to `type === 'cluster'`.
 *   - `parsed`: the current schema-authoritative parsed Diagram, used
 *     to look up the dropped node's current `cluster` field.
 *
 * Output: a {@link ReassignmentDecision} when the cluster assignment
 * should change, `null` when there's nothing to dispatch (the node
 * isn't in the schema, the intersection set yields the same cluster as
 * before, or the node is currently outside all clusters and the drop
 * also lands outside).
 *
 * Pick policy for multiple intersecting clusters: smallest measured
 * area wins (the most-specific containment). Missing dimensions fall
 * back to `Number.POSITIVE_INFINITY` so candidates without measurements
 * never beat measured ones.
 */

export interface ReassignmentDecision {
  /** The value to pass to `SetField{node-cluster}`. Empty string strips the field. */
  readonly newCluster: string
}

export function pickClusterReassignment(
  droppedNodeId: string,
  intersecting: readonly Node[],
  parsed: Diagram,
): ReassignmentDecision | null {
  const schemaNode = parsed.nodes.find((node) => node.id === droppedNodeId)
  if (schemaNode === undefined) return null
  const currentCluster = schemaNode.cluster

  const clusterCandidates = intersecting.filter((node) => node.type === 'cluster')

  let smallest: Node | undefined
  let bestArea = Number.POSITIVE_INFINITY
  for (const candidate of clusterCandidates) {
    const w = candidate.measured?.width ?? candidate.width ?? Number.POSITIVE_INFINITY
    const h = candidate.measured?.height ?? candidate.height ?? Number.POSITIVE_INFINITY
    const area = w * h
    if (area < bestArea) {
      bestArea = area
      smallest = candidate
    }
  }

  const newCluster = smallest?.id // undefined when no cluster intersects

  // No-op when:
  //   - Node was top-level and remains top-level (both undefined).
  //   - Node was in cluster X and intersection still resolves to X.
  if (newCluster === currentCluster) return null

  // Reassign or unassign. Empty string is the documented unassign sentinel
  // for SetField{node-cluster} (see apply-patch.ts).
  return { newCluster: newCluster ?? '' }
}
