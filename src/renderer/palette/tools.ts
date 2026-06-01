import type { Diagram } from '../../schema/types'
import type { DispatchAddClusterArgs, DispatchAddNodeArgs } from '../editing/sync'
import { mintUniqueId } from '../lib/id'
import type { InteractionMode } from '../store/interaction'

/**
 * Placement-mode helpers. Pure functions — the canvas's pointer handler
 * calls these on the right event, they mint an id, build a dispatcher
 * args object, fire the dispatch, and reset the interaction mode.
 *
 * Keeping the translation pure (no React, no event objects) makes the
 * logic exhaustively testable; canvas wiring just supplies the inputs.
 */

const DEFAULT_NODE_LABEL = 'New node'
const DEFAULT_CLUSTER_LABEL = 'New cluster'

export interface HandlePlacementClickOptions {
  /** Current InteractionSlice mode. */
  readonly mode: InteractionMode
  /** The schema-absolute point where the user clicked (post-`project()`). */
  readonly point: { readonly x: number; readonly y: number }
  /** The parsed diagram (for collision-free id minting). */
  readonly diagram: Diagram
  /** From `useFlowSync()` — fires an `AddNode` patch. */
  readonly dispatchAddNode: (args: DispatchAddNodeArgs) => void
  /** From `useFlowSync()` — fires an `AddCluster` patch. */
  readonly dispatchAddCluster: (args: DispatchAddClusterArgs) => void
  /** From the InteractionSlice — resets `mode` to `'idle'`. */
  readonly exitPlacementMode: () => void
  /**
   * 0.4.0 (Phase 18) — if the placement click landed inside an existing
   * cluster's bounds, the caller passes that cluster's id here and a
   * `placing-node` dispatch parents the new node into it. The Inspector's
   * Cluster dropdown is the equivalent path for already-placed nodes.
   *
   * Caller (`sync.onPaneClick`) is responsible for the bounds lookup via
   * xyflow's spatial index — keeping this arg as a plain id keeps
   * tools.ts pure (no xyflow import).
   */
  readonly parentClusterId?: string
}

/**
 * Translate a click event in a placement mode into a creation patch.
 *
 * - `mode === 'placing-node'` → mints a fresh node id (6-char, collision-
 *   checked against existing nodes), dispatches `AddNode` with the click
 *   coordinates as the new node's `position`, exits placement mode.
 * - `mode === 'placing-cluster'` → mints a cluster id, dispatches
 *   `AddCluster` (empty cluster; per Decision #11 the rect coords aren't
 *   persisted in 0.4.0; user re-parents nodes into it via drag or
 *   Inspector dropdown), exits placement mode.
 * - `mode === 'idle'` → no-op.
 *
 * Exits mode AFTER the dispatch so the canvas's cursor doesn't snap back
 * to default before the new entity has rendered.
 */
export function handlePlacementClick(options: HandlePlacementClickOptions): void {
  const {
    mode,
    point,
    diagram,
    dispatchAddNode,
    dispatchAddCluster,
    exitPlacementMode,
    parentClusterId,
  } = options

  if (mode === 'placing-node') {
    const existing = new Set(diagram.nodes.map((node) => node.id))
    const id = mintUniqueId(existing)
    dispatchAddNode({
      id,
      label: DEFAULT_NODE_LABEL,
      position: point,
      // Phase 18 — auto-parent into the cluster under the click point so
      // "Add Node inside a cluster's bounds" matches what the user sees
      // happen visually.
      ...(parentClusterId !== undefined && { cluster: parentClusterId }),
    })
    exitPlacementMode()
    return
  }

  if (mode === 'placing-cluster') {
    const existing = new Set((diagram.clusters ?? []).map((cluster) => cluster.id))
    const id = mintUniqueId(existing)
    dispatchAddCluster({ id, label: DEFAULT_CLUSTER_LABEL })
    exitPlacementMode()
    return
  }

  // 'idle' — nothing to do. Canvas should not have called this in idle
  // mode anyway, but defensive no-op keeps the function safe.
}

export { DEFAULT_CLUSTER_LABEL, DEFAULT_NODE_LABEL }
