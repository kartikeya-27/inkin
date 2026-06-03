import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  ReactFlow,
} from '@xyflow/react'
import type { Flow } from '../schema/types'
import { clusterNodeTypes } from './clusters'
import { edgeTypes } from './edges'
import { FlowLayer } from './flows'
import { nodeTypes as rendererNodeTypes } from './nodes'

/**
 * The xyflow canvas — receives pre-translated nodes/edges and renders them with
 * inkin's custom node, edge, and cluster components, plus xyflow's built-in
 * `<Background>` (dotted background grid) and optional viewport `<Controls>` /
 * `<MiniMap>`.
 *
 * MUST be rendered inside a `<ReactFlowProvider>` — DiagramStudio handles that.
 *
 * Edit-mode toggle: `editable` flips xyflow's top-level
 * `nodesDraggable` / `nodesConnectable` / `elementsSelectable` flags. When
 * false (no `onChange` provided to DiagramStudio), the canvas stays read-only
 * — drag, connect, select are all disabled, pan/zoom remain. When true, the
 * change-event bundle from `useFlowSync` wires drag-end / connect / delete /
 * inline-edit dispatch.
 *
 * Per-node policy still wins over the top-level flag — cluster nodes carry
 * `connectable: false` in `translate.ts` always (the schema doesn't allow
 * edges to reference clusters). 0.4.0 / Phase 18 lifted clusters' previous
 * `selectable: false, draggable: false` overrides so they inherit `editable`
 * the same way regular nodes do.
 *
 * `deleteKeyCode={['Backspace', 'Delete']}` is the documented xyflow knob for
 * keyboard-driven node and edge deletion. xyflow fires a `remove` change
 * through `onNodesChange` / `onEdgesChange`, which the sync hook dispatches
 * as `DeleteNode` / `DeleteEdge` / `DeleteCluster` patches (cascade is the
 * reducer's job).
 *
 * `multiSelectionKeyCode={'Shift'}` (Phase 20): xyflow's default is `Control`
 * on Windows/Linux and `Meta` on Mac — Shift+click does NOT extend selection
 * without this override. The user's smoke caught a Windows user reaching for
 * Shift first (the universal design-tool convention) and getting silent
 * single-selection. We override to `'Shift'` because xyflow v12's KeyCode
 * type doesn't accept OR-combinations of modifiers (`string[]` is AND, not
 * OR). 'Shift' is the right single choice — Figma, Sketch, tldraw, and
 * Excalidraw all multi-select on Shift+click.
 */

// Composed once at module scope; the maps never change.
const nodeTypes = { ...rendererNodeTypes, ...clusterNodeTypes }

const DELETE_KEYS = ['Backspace', 'Delete']
// xyflow's KeyCode type (string | string[]) treats arrays as AND-combinations
// and offers no OR-combination escape hatch in v12. xyflow's own default
// (Meta on Mac, Control on Win/Linux) was the cross-OS approach but
// invisible to Shift-first users — the user's smoke confirmed Shift+click
// silently replaced selection. Picking a single, universally available
// modifier solves the discoverability gap; 'Shift' is what every design
// tool (Figma, Sketch, tldraw, Excalidraw) uses for multi-select.
const MULTI_SELECT_KEY = 'Shift'

export interface GraphRendererProps {
  readonly nodes: Node[]
  readonly edges: Edge[]
  readonly showMinimap: boolean
  readonly showControls: boolean
  /**
   * Editing toggle — flips drag / connect / select on. Defaults to false so
   * the existing 0.2.0 read-only invocation path stays byte-for-byte
   * identical.
   */
  readonly editable?: boolean
  /**
   * Flow definitions from the parsed diagram (0.5.0). When present and
   * non-empty, `<FlowLayer>` mounts as the last child of `<ReactFlow>` and
   * renders one animated token per flow. Undefined / empty → no overlay.
   * Diagrams without `flows` see zero behavior change vs 0.4.x.
   */
  readonly flows?: readonly Flow[] | undefined
  /** From `useFlowSync` — forwarded to `<ReactFlow onNodesChange>`. */
  readonly onNodesChange?: OnNodesChange
  /** From `useFlowSync` — forwarded to `<ReactFlow onEdgesChange>`. */
  readonly onEdgesChange?: OnEdgesChange
  /** From `useFlowSync` — forwarded to `<ReactFlow onConnect>`. */
  readonly onConnect?: OnConnect
  /** From `useFlowSync` — forwarded to `<ReactFlow onNodesDelete>`. */
  readonly onNodesDelete?: (deleted: Node[]) => void
  /** From `useFlowSync` — forwarded to `<ReactFlow onEdgesDelete>`. */
  readonly onEdgesDelete?: (deleted: Edge[]) => void
  /**
   * From `useFlowSync` — forwarded to `<ReactFlow onNodeDragStop>`. Powers
   * the 0.4.0 cross-cluster drag-and-drop reassignment: the sync hook
   * compares the dropped node's intersection set against its current
   * schema cluster and dispatches a `SetField{node-cluster}` patch when
   * they differ.
   */
  readonly onNodeDragStop?: OnNodeDrag<Node>
  /**
   * From `useFlowSync` — forwarded to `<ReactFlow onPaneClick>`. When a
   * Palette tool is armed (`InteractionSlice.mode !== 'idle'`), the
   * click coordinates are projected to flow space and an `AddNode` /
   * `AddCluster` patch fires. In `'idle'` mode it's a no-op so xyflow's
   * default clear-selection behavior stays intact.
   */
  readonly onPaneClick?: (event: React.MouseEvent) => void
}

export function GraphRenderer({
  nodes,
  edges,
  showMinimap,
  showControls,
  editable = false,
  flows,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodesDelete,
  onEdgesDelete,
  onNodeDragStop,
  onPaneClick,
}: GraphRendererProps) {
  // xyflow's prop types reject `undefined` under exactOptionalPropertyTypes,
  // so the optional handler props are passed via conditional spread — only
  // included when the consumer actually wired them up.
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      {...(onNodesChange !== undefined && { onNodesChange })}
      {...(onEdgesChange !== undefined && { onEdgesChange })}
      {...(onConnect !== undefined && { onConnect })}
      {...(onNodesDelete !== undefined && { onNodesDelete })}
      {...(onEdgesDelete !== undefined && { onEdgesDelete })}
      {...(onNodeDragStop !== undefined && { onNodeDragStop })}
      {...(onPaneClick !== undefined && { onPaneClick })}
      nodesDraggable={editable}
      nodesConnectable={editable}
      elementsSelectable={editable}
      nodesFocusable={editable}
      deleteKeyCode={editable ? DELETE_KEYS : null}
      multiSelectionKeyCode={editable ? MULTI_SELECT_KEY : null}
      // Auto-fit the viewport to show all nodes on initial mount; without this,
      // diagrams larger than the container's initial viewport render off-screen.
      fitView
    >
      <Background />
      {showControls && <Controls showInteractive={false} />}
      {showMinimap && <MiniMap />}
      {/*
        `<FlowLayer>` mounts as the last child of `<ReactFlow>` so it sits
        inside `<ReactFlowProvider>`'s store and its `useNodes()` /
        `useEdges()` / `useViewport()` hooks resolve. It renders an
        absolutely-positioned SVG overlay with `pointer-events: none` so
        clicks fall through to nodes / edges / the canvas pane underneath.
        Returns null when `flows` is undefined / empty, so 0.4.x consumers
        see zero behavior change.
      */}
      <FlowLayer flows={flows} />
    </ReactFlow>
  )
}
