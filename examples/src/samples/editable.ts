import type { DiagramInput } from '@inkin/core'

/**
 * Initial value for the "Editable playground" sample — a fresh starting
 * diagram that exercises the 0.4.0 editing affordances AND the 0.5.0
 * flow-animation feature in a single canvas:
 *
 *   Idea ─refine─→ Sketch ─release─→ Ship
 *                    │
 *                    └ ─annotate─→ [Constraint]  (inside the 'context' cluster)
 *
 * With an animated `pipeline` flow tracing `refine` → `release` so a
 * blue token loops Idea → Sketch → Ship every 6.5 s by default.
 *
 *   - Three connected pipeline nodes (Idea → Sketch → Ship) so drag,
 *     multi-select, Delete cascade, and inline edit all have something
 *     to work on.
 *   - One annotation node ('Constraint') inside the `context` cluster,
 *     linked back to Sketch with a dashed edge so the cluster's purpose
 *     is legible at a glance.
 *   - All labels start non-empty (so double-click → input opens with
 *     text to replace, not a blank input).
 *   - One terminal-shape node (Ship) so users can see how shape persists
 *     across edits.
 *   - Positions explicit so dagre doesn't run on every consumer-side
 *     re-render in editable mode (saves a few ms per state change).
 *   - Edges have explicit `id`s so the `pipeline` flow can reference
 *     them by readable name (vs the auto-derived `a->b` / `b->c` form).
 *     If a consumer renames an edge id, the flow's `edges` array would
 *     need updating in lockstep — explicit ids make that obvious.
 *
 * 0.5.0 flow behavior to demonstrate live in the playground:
 *
 *   - On first render: the `pipeline` token loops the full path.
 *   - User deletes the `release` edge (select it + Delete): the
 *     `pruneFlows` reducer cascade (shipped in 0.3.0) strips `release`
 *     from `flow.edges` before `onChange` fires. The token now only
 *     traces `refine` (Idea → Sketch) and loops there.
 *   - User then deletes the `refine` edge too: `flow.edges` would
 *     become empty → the reducer removes the flow entirely. No more
 *     token; the diagram is back to a plain editable graph.
 *
 * What the playground does NOT do (by design, master-plan locked):
 *
 *   - The Inspector has no `Flow` selection mode. Flows are
 *     declarative-only in 0.5.0. You cannot add a flow, change its
 *     speed / color, or re-introduce a deleted flow through the UI;
 *     mutate `value.flows` in your own state.
 *   - The Palette has no "add flow" tool. Same reason.
 *
 * Full flow-editor UI lands in 1.1.0 (post 1.0.0 schema freeze) per
 * the master plan. 0.5.0 is intentionally renderer-only — the cascade
 * prune is the only "editable interaction" with flows that ships.
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
    { id: 'refine', from: 'a', to: 'b', label: 'refine' },
    { id: 'release', from: 'b', to: 'c', label: 'release' },
    // Dashed annotation edge into the cluster — makes the cluster's
    // intent ("notes about a particular pipeline step") read off the
    // canvas without needing a comment. Not part of the pipeline flow.
    { id: 'annotate', from: 'b', to: 'n1', label: 'annotate', style: 'dashed' },
  ],
  // Single flow tracing the synchronous pipeline. Default theme accent
  // color, 6.5 s loop, no stagger. Delete an underlying edge to watch
  // the 0.3.0 `pruneFlows` cascade shrink (or remove) the flow live.
  flows: [{ id: 'pipeline', edges: ['refine', 'release'], duration: 6500 }],
}
