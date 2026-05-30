/**
 * `@inkin/core` editing primitives — internal barrel.
 *
 * This module is not exported from the public surface (the published
 * `@inkin/core` and `@inkin/core/schema` entries stay focused). Other parts
 * of the renderer import from this barrel so internal paths can be
 * reshuffled without churn elsewhere.
 *
 * `useFlowSync`, `EditableLabel`, and the editing context land here in
 * subsequent 0.3.0 phases.
 */

export { applyPatch, effectiveEdgeId, pickConnectEdgeId, pruneFlows } from './apply-patch'
export type {
  ConnectEdgePatch,
  DeleteClusterPatch,
  DeleteEdgePatch,
  DeleteNodePatch,
  MoveNodePatch,
  Patch,
  SetFieldPatch,
  SetFieldTarget,
} from './patches'
