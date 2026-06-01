import type { StateCreator } from 'zustand'
import type { EditorStore } from './index'

/**
 * Inline-edit slice — tracks the single active label edit.
 *
 * Why a single slot (`editTarget: ... | null`) instead of a Map keyed by
 * target id: by design only one inline edit can be active at a time. The
 * UX is commit-on-blur — focusing into a second label commits or cancels
 * the first. Modeling that as a single slot is honest and removes a class
 * of bugs ("stale ghost edit on a node that lost focus three operations
 * ago"). The opposite shape — a Map of pending edits — would let multiple
 * inputs accept keystrokes simultaneously, which we don't render.
 *
 * Why the slice doesn't know about the schema or Patches: `commitEdit`
 * returns the committed `{ target, text }` and clears the slot, leaving
 * patch construction to the caller (the sync hook in phase 6). Keeping
 * `editing/` and `store/` independent of each other this way means the
 * store has no schema-coupled types and the editing layer has no
 * Zustand-coupled types — each can be tested in isolation.
 *
 * Phase 9's `<EditableLabel>` reads `editTarget` to decide whether to
 * render the `<input>` or the static `<div>`; reads `draftText` to bind
 * the input value; calls `updateDraft` on every keystroke and either
 * `commitEdit` (Enter / blur) or `cancelEdit` (Esc).
 */

/**
 * Where in the diagram an inline edit is active. The kind dictates which
 * schema field commit lands on:
 *   - `node-label`    → `Node.label`
 *   - `node-sublabel` → `Node.sublabel`
 *   - `edge-label`    → `Edge.label`
 *   - `cluster-label` → `Cluster.label` (new in 0.4.0 / Phase 18 — Cluster
 *                       gets an inline-rename affordance via its header)
 *
 * For edges, `id` is the effective edge id (explicit `Edge.id` or the
 * auto-derived `${from}->${to}` form — same convention the reducer's
 * `SetField` arm uses).
 */
export interface EditTarget {
  readonly kind: 'node-label' | 'node-sublabel' | 'edge-label' | 'cluster-label'
  readonly id: string
}

/**
 * The result of a successful `commitEdit`. Returned to the caller so a
 * `SetField` patch can be constructed without the slice having to know
 * about the Patch union.
 */
export interface CommittedEdit {
  readonly target: EditTarget
  readonly text: string
}

export interface EditState {
  readonly editTarget: EditTarget | null
  readonly draftText: string
}

export interface EditActions {
  /**
   * Begin editing the given target with the provided initial text. If a
   * different edit is already active, it is silently discarded (the
   * Phase 9 component takes care of committing-then-starting in normal
   * UX flow; this action is a low-level setter). When the target equals
   * the current `editTarget` and the initial text matches `draftText`,
   * the call is a no-op (no subscriber notification).
   */
  startEdit(target: EditTarget, initialText: string): void

  /**
   * Update the in-flight draft text. Called on every keystroke from the
   * `<input>` in `<EditableLabel>`. No-op (no notification) if the new
   * text equals the current draft.
   */
  updateDraft(text: string): void

  /**
   * Commit and clear the active edit. Returns the committed value so
   * the caller can dispatch a `SetField` patch. Returns `null` when no
   * edit is active (Esc-then-blur, or out-of-order calls).
   */
  commitEdit(): CommittedEdit | null

  /**
   * Discard the active edit and clear the slot. No-op when no edit is
   * active.
   */
  cancelEdit(): void
}

export type EditSlice = EditState & EditActions

function editTargetEquals(a: EditTarget | null, b: EditTarget | null): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return a.kind === b.kind && a.id === b.id
}

export const createEditSlice: StateCreator<EditorStore, [], [], EditSlice> = (set, get) => ({
  editTarget: null,
  draftText: '',

  startEdit(target, initialText) {
    const state = get()
    if (editTargetEquals(state.editTarget, target) && state.draftText === initialText) return
    set({ editTarget: target, draftText: initialText })
  },

  updateDraft(text) {
    if (get().draftText === text) return
    set({ draftText: text })
  },

  commitEdit() {
    const state = get()
    if (state.editTarget === null) return null
    const committed: CommittedEdit = { target: state.editTarget, text: state.draftText }
    set({ editTarget: null, draftText: '' })
    return committed
  },

  cancelEdit() {
    if (get().editTarget === null) return
    set({ editTarget: null, draftText: '' })
  },
})

// Exported for tests + the EditableLabel component.
export { editTargetEquals }
