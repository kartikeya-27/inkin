import { useEffect } from 'react'
import { useEditingActions } from '../editing/EditingContext'
import type { UseFlowSyncResult } from '../editing/sync'
import type { EditorStoreInstance } from '../store'
import { useEditorStoreApi } from '../store'

/**
 * `useKeymap` — the keyboard accessibility layer for `<DiagramStudio>`.
 *
 * What this hook owns (editable mode only — no-op when read-only):
 *   - **Arrow keys**: nudge every selected node by 10 px (the canonical
 *     a11y nudge step). The store mirror of selection (Phase 6 wired
 *     `select` change events into SelectionSlice) is the source of truth.
 *   - **Enter on a focused node**: begin editing that node's label. We
 *     read xyflow's focused node from the document active element's
 *     `data-id` attribute (xyflow's documented contract for keyboard
 *     navigation; it sets `data-id` on every node element).
 *   - **Esc**: cancel the active inline edit if one is in flight;
 *     otherwise clear the selection.
 *
 * What this hook deliberately does NOT own:
 *   - **Delete / Backspace**: handled by xyflow's built-in `deleteKeyCode`
 *     prop (set in `GraphRenderer.tsx`). xyflow emits `remove` change
 *     events which the sync hook (Phase 6) dispatches as `DeleteNode` /
 *     `DeleteEdge` patches with cascade.
 *   - **Tab navigation between nodes**: handled by xyflow's
 *     `nodesFocusable={true}` (set in `GraphRenderer.tsx` when editable).
 *   - **Pan / zoom (arrows for viewport)**: xyflow's default arrow-key
 *     pan is disabled when a node is selected because our handler
 *     intercepts arrows first; it remains on when no selection is active.
 *
 * The keymap attaches to a container ref rather than `document` so two
 * `<DiagramStudio>` instances on the same page don't cross-fire (each has
 * its own keymap rooted at its own wrapper). Events that bubble out of the
 * canvas (e.g. typing in an `<EditableLabel>`) carry the stopPropagation
 * set by the EditableLabel itself, so a Delete inside an input doesn't
 * trigger the node deletion.
 */

export interface UseKeymapOptions {
  /**
   * Wrapper element ref to attach the keydown handler to. We accept the
   * RefObject (not the bare `.current`) so the effect can read the latest
   * value after React attaches the ref — at hook-call time `.current` is
   * null on the first render.
   */
  readonly target: React.RefObject<HTMLElement | null>
  /** When false, the hook is a complete no-op (read-only mode). */
  readonly enabled: boolean
  /**
   * Patch dispatcher — needed to emit `MoveNode` patches for arrow-key
   * nudges. Exposed by `useFlowSync`. The hook deliberately does not
   * subscribe to the parsed Diagram; it just needs a way to dispatch.
   */
  readonly dispatchMoveNode: (nodeId: string, dx: number, dy: number) => void
}

/** Pixel step for arrow-key nudges. Matches the plan's keyboard a11y floor. */
const NUDGE_STEP = 10

export function useKeymap({ target, enabled, dispatchMoveNode }: UseKeymapOptions): void {
  const storeApi = useEditorStoreApi()
  const editing = useEditingActions()

  useEffect(() => {
    if (!enabled) return
    const element = target.current
    if (element === null) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Inline edit is active: only handle Esc (cancel) here; let the
      // EditableLabel's own keydown handler deal with the rest (Enter
      // commits, character keys edit the input). EditableLabel
      // stopsPropagation on its own keys so they won't reach us.
      const state = storeApi.getState()
      if (state.editTarget !== null) {
        if (event.key === 'Escape') {
          event.preventDefault()
          editing?.cancel()
        }
        return
      }

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          const selected = state.selectedNodeIds
          if (selected.size === 0) return // Let xyflow's default arrow-pan handle it.
          event.preventDefault()
          const [dx, dy] = arrowDelta(event.key)
          for (const id of selected) dispatchMoveNode(id, dx, dy)
          return
        }
        case 'Enter': {
          // Read xyflow's focused node from the DOM. xyflow tags each node
          // element with a `data-id` attribute; when keyboard-focused
          // (Tab), the node element is `document.activeElement`.
          const focusedId = activeElementNodeId()
          if (focusedId === null) return
          event.preventDefault()
          // We don't know the current label here without reading the
          // parsed diagram, which the keymap deliberately doesn't subscribe
          // to. The convention: open the edit with an empty initial draft,
          // and BaseNode's `onStartEdit` re-initializes via its own
          // `editing.startEdit(target, currentLabel)` call when the user
          // double-clicks. For Enter we just signal "start editing this
          // node's label" with a sentinel that BaseNode's subsequent
          // re-render picks up. The simpler implementation: use
          // editing.startEdit directly with empty initial text; the
          // EditableLabel auto-selects so the user types over it anyway.
          editing?.startEdit({ kind: 'node-label', id: focusedId }, '')
          return
        }
        case 'Escape': {
          // No active edit (checked above). Clear selection.
          state.clearSelection()
          return
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
    }
  }, [target, enabled, storeApi, editing, dispatchMoveNode])
}

/**
 * Build a `nudgeNode(nodeId, dx, dy)` callback that reads the current
 * absolute position from the parsed schema, adds the delta, and dispatches
 * a `MoveNode` patch via the sync hook's narrow `dispatchMoveNode` verb.
 *
 * DiagramStudio constructs this once and passes it into `useKeymap`. The
 * keymap stays schema-agnostic (it never reads `parsedDiagram` directly),
 * and the sync hook keeps its internal patch dispatcher private.
 */
export function buildArrowKeyNudger(
  sync: Pick<UseFlowSyncResult, 'parsedDiagram' | 'dispatchMoveNode'>,
): (nodeId: string, dx: number, dy: number) => void {
  return (nodeId, dx, dy) => {
    const parsed = sync.parsedDiagram
    if (parsed === null) return
    const node = parsed.nodes.find((n) => n.id === nodeId)
    if (node === undefined) return
    const current = node.position ?? { x: 0, y: 0 }
    sync.dispatchMoveNode(nodeId, { x: current.x + dx, y: current.y + dy })
  }
}

function arrowDelta(key: string): [number, number] {
  switch (key) {
    case 'ArrowUp':
      return [0, -NUDGE_STEP]
    case 'ArrowDown':
      return [0, NUDGE_STEP]
    case 'ArrowLeft':
      return [-NUDGE_STEP, 0]
    case 'ArrowRight':
      return [NUDGE_STEP, 0]
    default:
      return [0, 0]
  }
}

/**
 * Read the id of the currently keyboard-focused xyflow node, by looking up
 * `data-id` on the document's active element. xyflow's accessibility
 * contract: focusable node elements carry `data-id="<nodeId>"`. Returns
 * null when no node is focused (e.g., focus is on the canvas pane).
 */
function activeElementNodeId(): string | null {
  const active = typeof document !== 'undefined' ? document.activeElement : null
  if (active === null) return null
  const id = active.getAttribute('data-id')
  return id !== null && id.length > 0 ? id : null
}

export type { EditorStoreInstance }
// Re-exported for the keymap test + DiagramStudio wiring.
export { NUDGE_STEP }
