import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { dagreLayout } from '../../schema/layout'
import type { Diagram, DiagramInput } from '../../schema/types'
import { type InkinValidationError, safeParse } from '../../schema/validate'
import { translate } from '../translate'

/**
 * `useFlowSync` — the controlled-state-sync hook that bridges the inkin
 * schema (`value: DiagramInput`) and xyflow's internal node/edge store.
 *
 * Phase 5 (this commit) wires only the **read path**:
 *
 *   1. Parse `value` via `safeParse` (memoized on the `value` reference).
 *   2. Optionally run dagre auto-layout (`layout: 'auto'` default; `'manual'`
 *      trusts schema positions as-is).
 *   3. Translate to xyflow nodes/edges with `translate()`.
 *   4. Seed xyflow's local state via `useNodesState` / `useEdgesState` on
 *      first render; re-seed whenever the `value` reference or `layout`
 *      prop changes externally.
 *   5. Forward xyflow's change events through `applyNodeChanges` /
 *      `applyEdgeChanges` so dimensions, selection, and pan/zoom-driven
 *      transient state stay in sync with the rendered DOM.
 *
 * Phase 6 (next commit) fills in the **write path**: partition the
 * change events into "stay local" (drag-during, dimensions, viewport,
 * selection) vs "escape via onChange" (drag-end, connect, delete,
 * inline-edit commit), dispatch through `applyPatch` + `safeParse`
 * defense-in-depth, and call `onChange(next)` for the escapes only.
 *
 * The hook owns the parsed diagram (`parsedDiagram` in the result) so
 * Phase 6's patch dispatcher and the inline-edit commit path can read
 * the schema-authoritative snapshot without going back through the
 * consumer's `value`. `parsedDiagram` is `null` precisely when
 * `parseError` is non-null, and vice versa.
 *
 * `isEditable` is derived from whether `onChange` was provided (not from
 * a separate prop) — the canonical inkin contract: omit `onChange` for
 * read-only, supply it for editable. GraphRenderer reads this to flip
 * xyflow's `nodesDraggable` / `nodesConnectable` / `elementsSelectable`
 * in Phase 7.
 *
 * Read-only behavior on omitted `onChange`: all handlers still run
 * `applyNodeChanges` / `applyEdgeChanges` (because xyflow emits dimension
 * and selection changes even with edit flags off — those have to land
 * somewhere or the canvas measurements drift), but never call
 * `onChange`. Connect / delete handlers no-op completely: xyflow's
 * read-only flags will already have suppressed those events upstream.
 */

export interface UseFlowSyncOptions {
  readonly value: DiagramInput
  /** Auto-layout via dagre (default `'auto'`) or trust schema positions (`'manual'`). */
  readonly layout?: 'auto' | 'manual'
  /** Editing-mode opt-in. Omit for read-only. */
  readonly onChange?: (next: Diagram) => void
}

export interface UseFlowSyncResult {
  /** xyflow nodes — pass directly to `<ReactFlow nodes>`. */
  readonly nodes: Node[]
  /** xyflow edges — pass directly to `<ReactFlow edges>`. */
  readonly edges: Edge[]
  /** Pass to `<ReactFlow onNodesChange>`. */
  readonly onNodesChange: OnNodesChange
  /** Pass to `<ReactFlow onEdgesChange>`. */
  readonly onEdgesChange: OnEdgesChange
  /** Pass to `<ReactFlow onConnect>`. */
  readonly onConnect: OnConnect
  /** Pass to `<ReactFlow onNodesDelete>`. */
  readonly onNodesDelete: (deleted: Node[]) => void
  /** Pass to `<ReactFlow onEdgesDelete>`. */
  readonly onEdgesDelete: (deleted: Edge[]) => void
  /** True when `onChange` was provided. GraphRenderer flips edit flags on this. */
  readonly isEditable: boolean
  /**
   * Schema-authoritative parsed diagram. `null` exactly when `parseError`
   * is non-null. Phase 6's patch dispatcher uses this as the reducer input.
   */
  readonly parsedDiagram: Diagram | null
  /** Validation error from `safeParse`. `null` when `value` parses cleanly. */
  readonly parseError: InkinValidationError | null
}

/**
 * Internal helper: parse + optionally layout + translate. Returns null on
 * parse failure (the caller distinguishes via `parseError`).
 */
function computeTranslated(
  value: DiagramInput,
  layout: 'auto' | 'manual',
):
  | { readonly ok: true; readonly diagram: Diagram; readonly nodes: Node[]; readonly edges: Edge[] }
  | { readonly ok: false; readonly error: InkinValidationError } {
  const result = safeParse(value)
  if (!result.success) return { ok: false, error: result.error }
  const positioned = layout === 'auto' ? dagreLayout.layout(result.data) : result.data
  const { nodes, edges } = translate(positioned)
  return { ok: true, diagram: positioned, nodes, edges }
}

export function useFlowSync(options: UseFlowSyncOptions): UseFlowSyncResult {
  const { value, layout = 'auto', onChange } = options
  const isEditable = onChange !== undefined

  // --- Read path: parse + translate, seed xyflow's local state ------------

  // First render — compute initial xyflow state and parsed diagram in one shot.
  // useState's lazy initializer runs exactly once, dodging the re-translate
  // that a useMemo would cause when React's reference equality is conservative.
  const initial = useMemo(
    () => computeTranslated(value, layout),
    // We intentionally only compute the initial snapshot once on mount; the
    // useEffect below handles every subsequent external change. Using stable
    // empty deps here keeps the initial state honest to the first-render value
    // and avoids double-applying the same update.
    // biome-ignore lint/correctness/useExhaustiveDependencies: stable on-mount initializer; updates are handled by the useEffect below
    [],
  )

  const [nodes, _setNodes, onNodesChangeFromXyflow] = useNodesState<Node>(
    initial.ok ? initial.nodes : [],
  )
  const [edges, _setEdges, onEdgesChangeFromXyflow] = useEdgesState<Edge>(
    initial.ok ? initial.edges : [],
  )

  // We don't use xyflow's bundled onNodesChange / onEdgesChange directly —
  // we wrap them so Phase 6 can intercept patches. For Phase 5 the wraps are
  // pass-throughs. Reference them to keep the linter from flagging them as
  // unused; remove the references once Phase 6 wires the real dispatchers.
  void onNodesChangeFromXyflow
  void onEdgesChangeFromXyflow

  // Schema-authoritative parsed diagram. Mutates only when `value` /
  // `layout` change. Phase 6 reads this as the reducer input; Phase 5
  // surfaces it so the consumer (DiagramStudio) can branch on parseError.
  const parsedRef = useRef<Diagram | null>(initial.ok ? initial.diagram : null)
  const parseErrorRef = useRef<InkinValidationError | null>(
    initial.ok ? null : initial.error,
  )

  // Track the inputs that drove `parsedRef`/`parseErrorRef` so the read-path
  // effect below can detect a real external change vs a re-render with the
  // same `value` reference.
  const lastInputsRef = useRef<{ value: DiagramInput; layout: 'auto' | 'manual' }>({
    value,
    layout,
  })

  // --- Re-seed on external value/layout change ----------------------------

  useEffect(() => {
    const previousInputs = lastInputsRef.current
    if (previousInputs.value === value && previousInputs.layout === layout) {
      // First render after mount — initial state already correct, skip.
      return
    }
    lastInputsRef.current = { value, layout }

    const next = computeTranslated(value, layout)
    if (next.ok) {
      parsedRef.current = next.diagram
      parseErrorRef.current = null
      _setNodes(next.nodes)
      _setEdges(next.edges)
    } else {
      parsedRef.current = null
      parseErrorRef.current = next.error
      _setNodes([])
      _setEdges([])
    }
  }, [value, layout, _setNodes, _setEdges])

  // --- Change handlers (Phase 5: read path only) --------------------------

  // Wrap xyflow's change events so we update local state ourselves. Phase 6
  // intercepts these to fire patches before / instead of forwarding.
  const onNodesChange = useCallback<OnNodesChange>(
    (changes: NodeChange[]) => {
      _setNodes((current) => applyNodeChanges(changes, current))
    },
    [_setNodes],
  )

  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes: EdgeChange[]) => {
      _setEdges((current) => applyEdgeChanges(changes, current))
    },
    [_setEdges],
  )

  // Phase 5: connect / delete handlers exist so the GraphRenderer wiring is
  // already complete from Phase 7 onward, but they no-op in this commit.
  // Phase 6 fills them with ConnectEdge / DeleteNode / DeleteEdge patch
  // dispatch.
  const onConnect = useCallback<OnConnect>(
    (_connection: Connection) => {
      // intentional no-op — Phase 6
    },
    [],
  )

  const onNodesDelete = useCallback(
    (_deleted: Node[]) => {
      // intentional no-op — Phase 6
    },
    [],
  )

  const onEdgesDelete = useCallback(
    (_deleted: Edge[]) => {
      // intentional no-op — Phase 6
    },
    [],
  )

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodesDelete,
    onEdgesDelete,
    isEditable,
    parsedDiagram: parsedRef.current,
    parseError: parseErrorRef.current,
  }
}
