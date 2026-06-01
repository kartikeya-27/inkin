import { createContext, useContext, useMemo } from 'react'
import { useEditorStoreApi } from '../store'
import type { EditTarget } from '../store/edit'
import { EditorActionsProvider } from './EditorActionsContext'
import type { UseFlowSyncResult } from './sync'

/**
 * `EditingContext` — exposes a small set of inline-edit actions that
 * `BaseNode` / `LabeledEdge` consume on user interaction:
 *   - `startEdit(target, initialText)` — begin editing a label slot
 *   - `commit(text)`                   — dispatch the `SetField` patch and
 *                                        clear the EditSlice slot
 *   - `cancel()`                       — clear the slot without committing
 *
 * Why a context (not a direct store dependency): the commit path needs both
 * the schema-side patch dispatch (`sync.dispatchSetField`, which lives in
 * `useFlowSync`) AND the store-side slot clear (`EditSlice.commitEdit`).
 * Putting them together here lets the consuming components stay narrow —
 * they call `commit(text)` and the context worries about the wiring.
 *
 * Why we provide the context ONLY in editable mode (presence is the signal):
 * `useEditingActions()` returns `null` when not in context, so a read-only
 * `BaseNode` doesn't have to know whether editing is on — it just renders a
 * plain `<div>` instead of an `<EditableLabel>`. This keeps the inline-edit
 * affordances completely absent in read-only mode (no hover-cursor, no
 * double-click handler), which matches the "same component, two visibly
 * different UIs" contract.
 */

export interface EditingActions {
  /**
   * Begin editing a label slot. `initialText` seeds the draft so the input
   * opens with the current value selected (the EditableLabel auto-selects
   * on mount). Replaces any active edit silently.
   */
  startEdit(target: EditTarget, initialText: string): void

  /**
   * Update the in-flight draft text. Called on every keystroke from the
   * EditableLabel's `onDraftChange`. No-op when text is unchanged.
   */
  updateDraft(text: string): void

  /**
   * Commit the active inline edit: dispatch a `SetField` patch with the
   * given text and clear the EditSlice slot. The text comes from the
   * EditableLabel's `onCommit(text)` callback rather than from the store's
   * draftText to avoid a race window where the input's latest keystroke
   * hasn't yet round-tripped through `updateDraft`. No-op when no edit is
   * active.
   */
  commit(text: string): void

  /**
   * Clear the active edit without dispatching. No-op when no edit is active.
   */
  cancel(): void
}

const EditingContext = createContext<EditingActions | null>(null)

/**
 * Read the EditingContext. Returns `null` in read-only mode (no provider
 * mounted), `EditingActions` in editable mode. Callers branch on the null
 * case to decide whether to render an `<EditableLabel>` (editable) or a
 * static `<div>` (read-only).
 */
export function useEditingActions(): EditingActions | null {
  return useContext(EditingContext)
}

export interface EditingProviderProps {
  /**
   * The `dispatchSetField` function returned by `useFlowSync`. Wraps the
   * internal patch dispatcher's SetField verb. Powers the inline-edit
   * commit path (label / sublabel / edge-label) and is also passed
   * through to {@link EditorActionsProvider} for Inspector field edits.
   */
  readonly dispatchSetField: UseFlowSyncResult['dispatchSetField']
  /**
   * New in 0.4.0 — forwarded to the {@link EditorActionsContext} mounted
   * inside this provider for Palette-driven node creation.
   */
  readonly dispatchAddNode: UseFlowSyncResult['dispatchAddNode']
  /**
   * New in 0.4.0 — forwarded for Palette-driven cluster creation.
   */
  readonly dispatchAddCluster: UseFlowSyncResult['dispatchAddCluster']
  /**
   * New in 0.4.0 — forwarded for Inspector cluster dropdown changes and
   * cross-cluster drag-and-drop reassignment.
   */
  readonly dispatchAssignCluster: UseFlowSyncResult['dispatchAssignCluster']
  readonly children: React.ReactNode
}

/**
 * Mount both editing-related contexts (inline-edit + general editor
 * actions) for the rendered tree. Only DiagramStudioInner mounts this,
 * and only when `useFlowSync` reports `isEditable: true`. Co-mounting
 * means a single provider boundary covers `<EditableLabel>` (inline
 * edits via {@link useEditingActions}) AND `<InspectorPanel>` /
 * `<Palette>` (broader action verbs via {@link useEditorActions}).
 */
export function EditingProvider({
  dispatchSetField,
  dispatchAddNode,
  dispatchAddCluster,
  dispatchAssignCluster,
  children,
}: EditingProviderProps) {
  const storeApi = useEditorStoreApi()

  const actions = useMemo<EditingActions>(
    () => ({
      startEdit(target, initialText) {
        storeApi.getState().startEdit(target, initialText)
      },
      updateDraft(text) {
        storeApi.getState().updateDraft(text)
      },
      commit(text) {
        // Read the current edit target snapshot, dispatch the SetField
        // patch with the explicitly-committed text (NOT the store's
        // draftText — see EditingActions.commit JSDoc), then clear the
        // slot. We use `cancelEdit` for the slot clear because we already
        // have the value we needed; `commitEdit` would just re-read the
        // draft text that we're intentionally ignoring.
        const state = storeApi.getState()
        if (state.editTarget === null) return
        const target = state.editTarget
        state.cancelEdit()
        dispatchSetField(target, text)
      },
      cancel() {
        storeApi.getState().cancelEdit()
      },
    }),
    [storeApi, dispatchSetField],
  )

  return (
    <EditingContext.Provider value={actions}>
      <EditorActionsProvider
        dispatchSetField={dispatchSetField}
        dispatchAddNode={dispatchAddNode}
        dispatchAddCluster={dispatchAddCluster}
        dispatchAssignCluster={dispatchAssignCluster}
      >
        {children}
      </EditorActionsProvider>
    </EditingContext.Provider>
  )
}
