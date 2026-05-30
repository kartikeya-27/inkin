import {
  applyEdgeChanges,
  applyNodeChanges,
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
import { translate, xyflowPositionToAbsolute } from '../translate'
import { applyPatch } from './apply-patch'
import type { Patch } from './patches'

/**
 * `useFlowSync` — the controlled-state-sync hook that bridges the inkin
 * schema (`value: DiagramInput`) and xyflow's internal node/edge store.
 *
 * Read path (Phase 5):
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
 * Write path (Phase 6):
 *   - Partition every `NodeChange` / `EdgeChange` by `type` (and for
 *     position changes, by the `dragging` flag) into "stay local" vs
 *     "escape via onChange":
 *       - `position` with `dragging: true`   → stay local (drag-during)
 *       - `position` with `dragging: false`  → escape: `MoveNode` patch
 *       - `dimensions` / `select`            → stay local (xyflow needs it)
 *       - `remove`                           → escape: `DeleteNode` / `DeleteEdge` patch
 *       - `add` / `replace`                  → stay local (xyflow won't emit
 *                                              these from UI in 0.3.0)
 *   - `onConnect(connection)`                → escape: `ConnectEdge` patch.
 *     Reducer auto-generates an explicit id only on parallel-edge collision;
 *     single connections keep the implicit form.
 *
 * All escapes go through a single dispatcher: `applyPatch(diagram, patch)`
 * runs the pure reducer; `safeParse(next)` is the defense-in-depth gate —
 * if the reducer ever produced invalid output (a bug in our code, not in
 * the consumer's input), `onChange` is NOT called and a `console.error`
 * surfaces the issues with the failed patch attached for diagnosis. This
 * trades a silent visual stall for never emitting a broken Diagram, which
 * matches the "schema is the single source of truth" contract.
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

  // We don't use xyflow's bundled `onNodesChange` / `onEdgesChange` directly —
  // our wrapped versions below intercept changes for the write-path partition.
  const [nodes, _setNodes] = useNodesState<Node>(initial.ok ? initial.nodes : [])
  const [edges, _setEdges] = useEdgesState<Edge>(initial.ok ? initial.edges : [])

  // Schema-authoritative parsed diagram. Mutates whenever `value` / `layout`
  // change (re-seed effect below) AND after every successfully-dispatched
  // patch (so back-to-back patches inside a single React tick compound
  // correctly without waiting for the consumer's value cycle).
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

  // --- Latest-state refs for the write path -------------------------------

  // Position changes from xyflow are cluster-relative when the dragged node
  // has a `parentId`. Converting back to schema-absolute requires the parent
  // cluster's xyflow `position` field, which lives in our `nodes` array.
  // We mirror it into a ref so callbacks (recreated only when their deps
  // change) always read the latest xyflow state without forcing a re-bind
  // on every node update.
  const nodesRef = useRef<Node[]>(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // Keep the latest onChange in a ref too so the dispatcher callback
  // doesn't re-create whenever the consumer passes a fresh function
  // reference (a very common case in React land).
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // --- Patch dispatcher ---------------------------------------------------

  /**
   * Apply a patch against the latest-known parsed diagram, re-validate the
   * result (defense in depth), and escape to the consumer's `onChange` only
   * if validation succeeds. The dispatcher is intentionally synchronous —
   * a single user event produces a single onChange call.
   */
  const dispatchPatch = useCallback((patch: Patch): void => {
    const parsed = parsedRef.current
    if (parsed === null) {
      // No schema to mutate (current value is unparseable). Drop the patch
      // silently — xyflow shouldn't be firing schema-mutating events when
      // the canvas isn't rendered, but a stray event during the transition
      // would land here.
      return
    }

    const next = applyPatch(parsed, patch)
    const validation = safeParse(next)
    if (!validation.success) {
      console.error(
        '[inkin] internal reducer produced an invalid Diagram; onChange suppressed. Patch:',
        patch,
        'issues:',
        validation.error.issues,
      )
      return
    }

    parsedRef.current = validation.data
    onChangeRef.current?.(validation.data)
  }, [])

  // --- Change handlers ----------------------------------------------------

  const onNodesChange = useCallback<OnNodesChange>(
    (changes: NodeChange[]) => {
      // Always apply locally — xyflow needs every change (dimensions,
      // selection, position-during-drag) reflected in its store, even when
      // editing is off (read-only mode still measures nodes, just doesn't
      // let the user move them).
      _setNodes((current) => applyNodeChanges(changes, current))

      if (!isEditable) return

      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false && change.position) {
          // Drag-end. Convert xyflow's (possibly cluster-relative) position
          // back to schema-absolute using the cluster's xyflow origin.
          const xyNodes = nodesRef.current
          const node = xyNodes.find((n) => n.id === change.id)
          if (node === undefined) continue
          const parent = node.parentId
            ? xyNodes.find((n) => n.id === node.parentId)
            : undefined
          const absolute = xyflowPositionToAbsolute(change.position, parent?.position)
          dispatchPatch({ kind: 'MoveNode', nodeId: change.id, position: absolute })
        } else if (change.type === 'remove') {
          dispatchPatch({ kind: 'DeleteNode', nodeId: change.id })
        }
        // Other change types (`select`, `dimensions`, `position` with
        // `dragging: true`, `add`, `replace`) stay local — no patch.
      }
    },
    [_setNodes, isEditable, dispatchPatch],
  )

  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes: EdgeChange[]) => {
      _setEdges((current) => applyEdgeChanges(changes, current))

      if (!isEditable) return

      for (const change of changes) {
        if (change.type === 'remove') {
          dispatchPatch({ kind: 'DeleteEdge', edgeId: change.id })
        }
        // `select` and `add`/`replace` stay local.
      }
    },
    [_setEdges, isEditable, dispatchPatch],
  )

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      if (!isEditable) return
      // xyflow's `Connection` has optional source/target; reject incomplete
      // ones rather than guessing.
      if (
        connection.source === null ||
        connection.source === undefined ||
        connection.target === null ||
        connection.target === undefined
      ) {
        return
      }
      dispatchPatch({
        kind: 'ConnectEdge',
        from: connection.source,
        to: connection.target,
      })
    },
    [isEditable, dispatchPatch],
  )

  // `onNodesDelete` / `onEdgesDelete` are not the source of truth for
  // deletion — xyflow also fires a `remove` change through
  // `onNodesChange` / `onEdgesChange`, which is where the dispatch lives.
  // These callbacks exist for the public API surface (GraphRenderer wires
  // them so consumers passing through don't see undefined holes) but
  // intentionally do nothing.
  const onNodesDelete = useCallback((_deleted: Node[]) => {}, [])
  const onEdgesDelete = useCallback((_deleted: Edge[]) => {}, [])

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
