import type { DiagramInput } from '@inkin/core'

/**
 * Initial value for the "Editable playground" sample — a fresh starting
 * diagram tuned for exercising the 0.4.0 editing affordances:
 *
 *   Idea ─refine─→ Sketch ─release─→ Ship
 *                    │
 *                    └ ─note─→ [Constraint]  (inside the 'context' cluster)
 *
 *   - Three connected pipeline nodes (Idea → Sketch → Ship) so drag,
 *     multi-select, Delete cascade, and inline edit all have something
 *     to work on.
 *   - One annotation node ('Constraint') inside the `context` cluster,
 *     linked back to Sketch with a dashed edge so the cluster's purpose
 *     is legible at a glance. Replaces the earlier "two disconnected
 *     notes inside a cluster" seed which read as a layout bug.
 *   - All labels start non-empty (so double-click → input opens with
 *     text to replace, not a blank input).
 *   - One terminal-shape node (Ship) so users can see how shape persists
 *     across edits.
 *   - Positions explicit so dagre doesn't run on every consumer-side
 *     re-render in editable mode (saves a few ms per state change).
 *
 * The App's editable tab pairs this with `useState<DiagramInput>` so every
 * onChange round-trips into React state and the UI re-renders from there.
 */
export const editable: DiagramInput = {
  schemaVersion: 1,
  // Cluster id stays 'notes' so existing schema consumers and test
  // assertions still match by value; the user-visible label tells the
  // story.
  clusters: [{ id: 'notes', label: 'context' }],
  nodes: [
    // Top-level pipeline — drag-into-cluster targets.
    { id: 'a', label: 'Idea', position: { x: 0, y: 0 } },
    { id: 'b', label: 'Sketch', sublabel: 'rough draft', position: { x: 220, y: 0 } },
    { id: 'c', label: 'Ship', shape: 'terminal', position: { x: 440, y: 0 } },
    // Inside the `notes` cluster — drag-out-of-cluster target + sample
    // entry-point for the cross-cluster reassignment story.
    { id: 'n1', label: 'Constraint', cluster: 'notes', position: { x: 220, y: 220 } },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'refine' },
    { from: 'b', to: 'c', label: 'release' },
    // Dashed annotation edge into the cluster — makes the cluster's
    // intent ("notes about a particular pipeline step") read off the
    // canvas without needing a comment.
    { from: 'b', to: 'n1', label: 'note', style: 'dashed' },
  ],
}
