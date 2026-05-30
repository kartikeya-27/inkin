import type { StateCreator } from 'zustand'
import type { EditorStore } from './index'

/**
 * Selection slice — mirrors xyflow's visual selection into the editor store so
 * components (EditableLabel, the keymap layer, downstream consumers) can read
 * selection via Zustand selectors without prop-drilling through the React
 * tree.
 *
 * Why `ReadonlySet<string>` per kind instead of a single array or a tagged
 * union: selection is a high-frequency lookup (every node and edge checks
 * `isSelected` on render to apply the selection ring). Sets give O(1)
 * membership and React's strict-equality bailout keeps subscribers from
 * re-rendering on identical selection changes. The Readonly modifier is
 * type-level — JavaScript Sets don't enforce immutability at runtime — but
 * paired with the setter pattern below (which never mutates in place) it's
 * the correct contract.
 *
 * Why three fields (nodes / edges / clusters) instead of one tagged union:
 * the consumer of each is distinct — node components render a different
 * affordance from edge components, and clusters from both. Splitting up
 * front means a node component subscribes only to `selectedNodeIds` and
 * never re-renders when an edge is selected.
 *
 * Setter semantics: `setSelection` accepts a partial of the three fields
 * and only writes when the proposed value differs from current (size +
 * element-membership equality). Identical selection → no state change →
 * subscribers don't re-render. This is the "Set identity preserved" gate
 * the Phase 3 verification checks for. `clearSelection` is a convenience
 * that sets all three back to the shared empty constant.
 */

/**
 * Shared empty Set constant. Used as initial state and as the "cleared"
 * target so reference equality holds across resets.
 */
const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>()

export interface SelectionState {
  readonly selectedNodeIds: ReadonlySet<string>
  readonly selectedEdgeIds: ReadonlySet<string>
  readonly selectedClusterIds: ReadonlySet<string>
}

export interface SelectionActions {
  /**
   * Replace any subset of the three selection fields. Fields omitted from
   * `next` stay untouched. Fields whose proposed value equals (size +
   * element-membership) the current value are skipped — the existing Set
   * reference is preserved and subscribers do not re-render.
   */
  setSelection(next: {
    readonly nodes?: ReadonlySet<string>
    readonly edges?: ReadonlySet<string>
    readonly clusters?: ReadonlySet<string>
  }): void

  /**
   * Clear all three selection fields back to the shared empty Set. Fields
   * that are already empty (by reference equality with the shared constant)
   * are skipped, so calling on an already-empty store does not re-render.
   */
  clearSelection(): void
}

export type SelectionSlice = SelectionState & SelectionActions

/**
 * Element-membership equality for Sets. `a === b` short-circuits the
 * common "user passed back the existing reference" case; size + has-loop
 * handles "user constructed a new Set with identical contents".
 */
function selectionEquals(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

/**
 * Writable buffer for accumulating field updates before calling `set`.
 * `SelectionState`'s fields are `readonly`, so we can't reuse
 * `Partial<SelectionState>` here.
 */
type SelectionUpdate = {
  selectedNodeIds?: ReadonlySet<string>
  selectedEdgeIds?: ReadonlySet<string>
  selectedClusterIds?: ReadonlySet<string>
}

/**
 * True when the update buffer has at least one field set. Used to skip
 * `set` entirely on no-op updates — Zustand notifies subscribers on every
 * `set` call (even with `{}`), and we want identical-selection writes to
 * be invisible to listeners.
 */
function hasAnyUpdate(updates: SelectionUpdate): boolean {
  return (
    updates.selectedNodeIds !== undefined ||
    updates.selectedEdgeIds !== undefined ||
    updates.selectedClusterIds !== undefined
  )
}

export const createSelectionSlice: StateCreator<EditorStore, [], [], SelectionSlice> = (
  set,
  get,
) => ({
  selectedNodeIds: EMPTY_SELECTION,
  selectedEdgeIds: EMPTY_SELECTION,
  selectedClusterIds: EMPTY_SELECTION,

  setSelection(next) {
    const state = get()
    const updates: SelectionUpdate = {}
    if (next.nodes !== undefined && !selectionEquals(next.nodes, state.selectedNodeIds)) {
      updates.selectedNodeIds = next.nodes
    }
    if (next.edges !== undefined && !selectionEquals(next.edges, state.selectedEdgeIds)) {
      updates.selectedEdgeIds = next.edges
    }
    if (next.clusters !== undefined && !selectionEquals(next.clusters, state.selectedClusterIds)) {
      updates.selectedClusterIds = next.clusters
    }
    if (hasAnyUpdate(updates)) set(updates)
  },

  clearSelection() {
    const state = get()
    const updates: SelectionUpdate = {}
    if (state.selectedNodeIds !== EMPTY_SELECTION) updates.selectedNodeIds = EMPTY_SELECTION
    if (state.selectedEdgeIds !== EMPTY_SELECTION) updates.selectedEdgeIds = EMPTY_SELECTION
    if (state.selectedClusterIds !== EMPTY_SELECTION) {
      updates.selectedClusterIds = EMPTY_SELECTION
    }
    if (hasAnyUpdate(updates)) set(updates)
  },
})

// Exported for tests + the keymap layer.
export { EMPTY_SELECTION, selectionEquals }
