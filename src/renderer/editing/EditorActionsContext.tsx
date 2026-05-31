import { createContext, useContext, useMemo } from 'react'
import type { SetFieldTarget } from './patches'
import type { DispatchAddClusterArgs, DispatchAddNodeArgs, UseFlowSyncResult } from './sync'

/**
 * `EditorActionsContext` — exposes the broader patch-dispatch verbs to
 * Inspector + Palette in 0.4.0.
 *
 * Why this lives *next to* {@link EditingContext} rather than absorbing
 * its actions:
 *
 *   - `EditingContext` owns the inline-label-edit state machine
 *     (`startEdit` → `updateDraft` → `commit` / `cancel`). It's consumed
 *     by `<EditableLabel>` inside `BaseNode` / `LabeledEdge` — a narrow,
 *     hot path.
 *   - `EditorActionsContext` is a thinner pass-through of the new 0.4.0
 *     dispatcher verbs (`dispatchSetField`, `dispatchAddNode`,
 *     `dispatchAddCluster`, `dispatchAssignCluster`). Consumed by the
 *     Inspector form fields and the Palette tools — different surfaces,
 *     different cadence.
 *
 * Folding both into one context would mean every `<EditableLabel>`
 * subscribes to verbs it doesn't use (and vice versa for Inspector
 * subscribing to inline-edit slot transitions). Keeping them separate
 * means React's context-equality bailout works narrowly.
 *
 * Both contexts mount inside the single {@link EditingProvider} mount
 * point — there's no separate `<EditorActionsProvider>` to remember;
 * presence of either context value is the editable-mode signal.
 *
 * `useEditorActions()` returns `null` outside the provider (read-only
 * mode). Inspector / Palette branch on the null case to render
 * read-only equivalents (or, more likely, not render at all — the
 * `inspector` / `palette` props default to `'off'` in read-only mode).
 */

export interface EditorActions {
  /**
   * Set a single field on a node, edge, or cluster. Used by every
   * Inspector form control on commit (label / sublabel TextInput on
   * Enter or blur; shape / style / cluster `<Select>` on change).
   */
  dispatchSetField(target: SetFieldTarget, value: string): void

  /**
   * Append a new node to the diagram. Caller mints the id via
   * `mintUniqueId(existingNodeIds)` from `src/renderer/lib/id.ts`.
   * Position and optional fields come from the click context.
   */
  dispatchAddNode(args: DispatchAddNodeArgs): void

  /**
   * Append a new empty cluster. Caller mints the id. The Palette's
   * drag-rect gesture is consumed for tool intent only; the rect
   * coords don't persist (Decision #11 in the 0.4.0 plan — no schema
   * change required for AddCluster).
   */
  dispatchAddCluster(args: DispatchAddClusterArgs): void

  /**
   * Reassign or unassign a node's cluster. `undefined` clusterId
   * unassigns (uses the empty-string sentinel internally). Used by
   * the Inspector cluster `<Select>` and by the Phase 9 cross-cluster
   * drag detection.
   */
  dispatchAssignCluster(nodeId: string, clusterId: string | undefined): void
}

const EditorActionsContext = createContext<EditorActions | null>(null)

/**
 * Read the EditorActionsContext. Returns `null` in read-only mode
 * (no provider mounted). Inspector / Palette branch on this null case
 * — though in practice they're not even rendered when null.
 */
export function useEditorActions(): EditorActions | null {
  return useContext(EditorActionsContext)
}

export interface EditorActionsProviderProps {
  readonly dispatchSetField: UseFlowSyncResult['dispatchSetField']
  readonly dispatchAddNode: UseFlowSyncResult['dispatchAddNode']
  readonly dispatchAddCluster: UseFlowSyncResult['dispatchAddCluster']
  readonly dispatchAssignCluster: UseFlowSyncResult['dispatchAssignCluster']
  readonly children: React.ReactNode
}

/**
 * Mount the EditorActionsContext. Co-mounted by the same
 * {@link EditingProvider} that mounts the inline-edit context, so
 * Inspector + Palette + EditableLabel can all consume their respective
 * action surfaces from the same provider boundary.
 */
export function EditorActionsProvider({
  dispatchSetField,
  dispatchAddNode,
  dispatchAddCluster,
  dispatchAssignCluster,
  children,
}: EditorActionsProviderProps) {
  const actions = useMemo<EditorActions>(
    () => ({
      dispatchSetField,
      dispatchAddNode,
      dispatchAddCluster,
      dispatchAssignCluster,
    }),
    [dispatchSetField, dispatchAddNode, dispatchAddCluster, dispatchAssignCluster],
  )
  return <EditorActionsContext.Provider value={actions}>{children}</EditorActionsContext.Provider>
}
