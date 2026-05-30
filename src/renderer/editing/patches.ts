/**
 * The Patch discriminated union — the only shape a schema-mutating event can
 * take inside `@inkin/core@0.3.0`.
 *
 * Why a discriminated union (and not, say, a function-per-mutation): a single
 * `Patch` value is serializable, transport-friendly, and uniformly testable.
 * Every drag-end, connect, delete, and inline-edit-commit produces exactly one
 * Patch, which flows through {@link applyPatch} (pure reducer) and then
 * through `safeParse` (defense in depth) before reaching the consumer's
 * `onChange`. Future undo / redo (post-1.0) can stack Patches without a
 * second machinery.
 *
 * 0.3.0 deliberately ships six variants only — the minimum for the canvas-
 * driven editing experience (drag, connect, delete, inline-edit). Variants
 * for shape, style, cluster assignment, palette-driven Add* operations, and
 * cluster rename land in 0.4.0 alongside the Inspector / Palette chrome that
 * actually surfaces them. Adding a variant later is a non-breaking change.
 *
 * Each variant carries the minimum data needed to mutate — not the whole
 * object. Identifiers are strings; positions are concrete `{ x, y }`. Keeping
 * Patches narrow makes the reducer arms one-liners and undo trivial.
 */

/**
 * Move a node to a new absolute canvas position. The caller (sync hook) is
 * responsible for converting xyflow's cluster-relative coordinates back to
 * schema-absolute before constructing the Patch, so the reducer stays
 * cluster-agnostic.
 */
export interface MoveNodePatch {
  readonly kind: 'MoveNode'
  readonly nodeId: string
  readonly position: { readonly x: number; readonly y: number }
}

/**
 * Create a new edge between two existing nodes. The reducer auto-generates an
 * explicit `id` only when the auto-derived `${from}->${to}` form would clash
 * with an existing edge (parallel-edge case); single edges between unique
 * node pairs keep the implicit id form, matching how authored diagrams look.
 */
export interface ConnectEdgePatch {
  readonly kind: 'ConnectEdge'
  readonly from: string
  readonly to: string
}

/**
 * Remove a node by id. Cascade rules: every edge incident to the node is
 * removed; every flow that referenced one of those edges has that entry
 * stripped from its ordered edge list; any flow whose edge list becomes
 * empty is dropped entirely. Cascade is the reducer's job — callers do not
 * issue companion `DeleteEdge` patches.
 */
export interface DeleteNodePatch {
  readonly kind: 'DeleteNode'
  readonly nodeId: string
}

/**
 * Remove an edge by id. Cascade rule: any flow that referenced the edge has
 * that entry stripped; an emptied flow is dropped.
 */
export interface DeleteEdgePatch {
  readonly kind: 'DeleteEdge'
  readonly edgeId: string
}

/**
 * Remove a cluster by id. Child nodes are NOT deleted — instead their
 * `cluster` field is stripped (the nodes return to the top level of the
 * diagram). This preserves a consumer's data when a cluster is removed
 * accidentally; deletion of children, if desired, is a separate sequence
 * of `DeleteNode` patches.
 */
export interface DeleteClusterPatch {
  readonly kind: 'DeleteCluster'
  readonly clusterId: string
}

/**
 * Inline-edit commit — set a single string field on a Node or Edge.
 *
 * Why one variant covers three (node label, node sublabel, edge label)
 * rather than three separate Patch kinds: the wire shape is identical, the
 * dispatch path is identical, and the reducer arm collapses to a single
 * `target.kind` switch. The same Patch shape extends cleanly when 0.4.0
 * adds Inspector-driven shape/style/cluster edits — those become new
 * entries on the `SetFieldTarget` union, not new top-level Patch kinds.
 *
 * Empty string is a valid value — consumers may intentionally clear a
 * label. Stripping versus storing-empty is the consumer's decision via
 * `onChange`; the reducer faithfully stores what was committed.
 */
export interface SetFieldPatch {
  readonly kind: 'SetField'
  readonly target: SetFieldTarget
  readonly value: string
}

export type SetFieldTarget =
  | { readonly kind: 'node-label'; readonly id: string }
  | { readonly kind: 'node-sublabel'; readonly id: string }
  | { readonly kind: 'edge-label'; readonly id: string }

export type Patch =
  | MoveNodePatch
  | ConnectEdgePatch
  | DeleteNodePatch
  | DeleteEdgePatch
  | DeleteClusterPatch
  | SetFieldPatch
