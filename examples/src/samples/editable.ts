import type { DiagramInput } from '@inkin/core'

/**
 * Initial value for the "Editable playground" sample — a fresh starting
 * diagram tuned for exercising the editing affordances:
 *   - Three connected pipeline nodes (Idea → Sketch → Ship) so drag,
 *     multi-select, and Delete cascade all have something to work on.
 *   - Two extra nodes inside a `notes` cluster so the user can demo
 *     cross-cluster drag-and-drop (drag a notes node out, drag a pipeline
 *     node in) and the Inspector's cluster dropdown reassignment.
 *   - All labels start non-empty (so double-click → input opens with text
 *     to replace, not a blank input).
 *   - One terminal-shape node so users can see how shape persists across
 *     edits.
 *   - Positions explicit so dagre doesn't run on every consumer-side
 *     re-render in editable mode (saves a few ms per state change).
 *
 * The App's editable tab pairs this with `useState<DiagramInput>` so every
 * onChange round-trips into React state and the UI re-renders from there.
 */
export const editable: DiagramInput = {
  schemaVersion: 1,
  clusters: [{ id: 'notes', label: 'notes' }],
  nodes: [
    // Top-level pipeline — drag-into-cluster targets.
    { id: 'a', label: 'Idea', position: { x: 0, y: 0 } },
    { id: 'b', label: 'Sketch', sublabel: 'rough draft', position: { x: 220, y: 0 } },
    { id: 'c', label: 'Ship', shape: 'terminal', position: { x: 440, y: 0 } },
    // Inside the `notes` cluster — drag-out-of-cluster targets.
    { id: 'n1', label: 'Constraint', cluster: 'notes', position: { x: 0, y: 220 } },
    { id: 'n2', label: 'Open question', cluster: 'notes', position: { x: 220, y: 220 } },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'refine' },
    { from: 'b', to: 'c', label: 'release' },
  ],
}
