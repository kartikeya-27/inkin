import type { StateCreator } from 'zustand'
import type { EditorStore } from './index'

/**
 * Interaction slice — transient UI mode state shared between the Palette
 * (which writes it on tool selection) and the canvas (which reads it on
 * pointer events).
 *
 * **`mode`** is the canonical state-machine field:
 *   - `'idle'` (default) — canvas interactions behave normally.
 *   - `'placing-node'` — the next canvas click adds a node at the click
 *     position; the cursor is `crosshair`.
 *   - `'placing-cluster'` — the next canvas drag-rectangle creates a
 *     cluster. `placementOrigin` captures the mousedown point; the
 *     mouseup handler reads it + the cursor position to decide whether
 *     to commit the cluster or treat the gesture as a click-cancel.
 *
 * **`placementOrigin`** is `null` outside of an active drag-rect. The
 * Palette / canvas wiring sets it on mousedown in `placing-cluster`
 * mode and clears it on mouseup or on exit. Independent from `mode`
 * so the canvas can introspect "are we mid-drag right now?" without
 * conflating "do we have a tool selected".
 *
 * **`hoveredClusterId`** is the id of the cluster currently under the
 * dragged node's center, set by `onNodeDrag` for the cross-cluster
 * reassignment visual hint, and cleared on drag-end. Null when no
 * drag is in progress, or when the dragged node isn't over any
 * cluster. Lives here (not in SelectionSlice) because hover ≠
 * selection — a hover passes; selection persists.
 *
 * All setters preserve state identity on no-op writes (the same
 * mode set twice, the same hover id set twice, etc.) so React
 * subscribers don't re-render on every mouse-move tick during a
 * drag. Matches the SelectionSlice's identity-preservation contract.
 *
 * Setter design: explicit verbs rather than a generic `setMode` so
 * the call sites read intent — `enterPlacementMode('placing-node')`
 * conveys "the user picked the Add Node tool"; `exitPlacementMode()`
 * conveys "we're done with that tool, also reset any related
 * placement state". Lower API surface for the Palette, less room for
 * "I forgot to clear `placementOrigin` after exit" bugs.
 */

/** Coordinates in the schema's absolute canvas space (post-`project()`). */
export interface PlacementPoint {
  readonly x: number
  readonly y: number
}

export type InteractionMode = 'idle' | 'placing-node' | 'placing-cluster'

/** Only the placing-* values are valid arguments to `enterPlacementMode`. */
export type PlacementMode = Exclude<InteractionMode, 'idle'>

export interface InteractionState {
  readonly mode: InteractionMode
  readonly placementOrigin: PlacementPoint | null
  readonly hoveredClusterId: string | null
}

export interface InteractionActions {
  /**
   * Enter a placement mode (Palette tool selected). No-op when the slice
   * is already in the requested mode — subscribers don't re-render on
   * an already-selected tool being clicked again.
   *
   * Switching directly from one placement mode to another clears
   * `placementOrigin` (different tool, different drag context).
   */
  enterPlacementMode(mode: PlacementMode): void

  /**
   * Return to `'idle'` and clear `placementOrigin`. No-op when already
   * idle AND origin is null. Used by Esc, by the visibility-change
   * listener, and by the canvas after a successful placement.
   */
  exitPlacementMode(): void

  /**
   * Set or clear the placement-rect origin point. Used by the canvas's
   * mousedown handler in `placing-cluster` mode to record where the
   * drag-rect started; mouseup reads it back. Identity preservation:
   * setting an x/y pair equal to the current origin is a no-op.
   */
  setPlacementOrigin(point: PlacementPoint | null): void

  /**
   * Set or clear the id of the cluster currently under a dragging node.
   * Set by `onNodeDrag` for visual highlighting during cross-cluster
   * drag-and-drop; cleared on `onNodeDragStop`. No-op when the id is
   * already the current value (so per-frame `onNodeDrag` ticks don't
   * re-render the world).
   */
  setHoveredCluster(id: string | null): void
}

export type InteractionSlice = InteractionState & InteractionActions

/**
 * True when two placement points have identical coordinates. Used by
 * `setPlacementOrigin` to skip notifications on no-op writes. `null`
 * checks short-circuit before this is called.
 */
function pointEquals(a: PlacementPoint, b: PlacementPoint): boolean {
  return a.x === b.x && a.y === b.y
}

export const createInteractionSlice: StateCreator<EditorStore, [], [], InteractionSlice> = (
  set,
  get,
) => ({
  mode: 'idle',
  placementOrigin: null,
  hoveredClusterId: null,

  enterPlacementMode(mode) {
    const state = get()
    if (state.mode === mode) return
    // Switching tools mid-stream resets the active drag-rect, if any.
    if (state.placementOrigin !== null) {
      set({ mode, placementOrigin: null })
      return
    }
    set({ mode })
  },

  exitPlacementMode() {
    const state = get()
    if (state.mode === 'idle' && state.placementOrigin === null) return
    set({ mode: 'idle', placementOrigin: null })
  },

  setPlacementOrigin(point) {
    const state = get()
    if (point === null) {
      if (state.placementOrigin === null) return
      set({ placementOrigin: null })
      return
    }
    if (state.placementOrigin !== null && pointEquals(state.placementOrigin, point)) return
    set({ placementOrigin: point })
  },

  setHoveredCluster(id) {
    if (get().hoveredClusterId === id) return
    set({ hoveredClusterId: id })
  },
})

// Re-exported for tests + the Palette tools layer.
export { pointEquals }
