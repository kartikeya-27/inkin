import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
} from '@xyflow/react'
import { clusterNodeTypes } from './clusters'
import { edgeTypes } from './edges'
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
 * `selectable: false, draggable: false, connectable: false` in `translate.ts`
 * regardless of `editable`, so cluster manipulation never enters scope here
 * (cross-cluster drag + rename land in 0.4.0 alongside the Inspector chrome).
 *
 * `deleteKeyCode={['Backspace', 'Delete']}` is the documented xyflow knob for
 * keyboard-driven node and edge deletion. xyflow fires a `remove` change
 * through `onNodesChange` / `onEdgesChange`, which the sync hook dispatches
 * as `DeleteNode` / `DeleteEdge` patches (cascade is the reducer's job).
 */

// Composed once at module scope; the maps never change.
const nodeTypes = { ...rendererNodeTypes, ...clusterNodeTypes }

const DELETE_KEYS = ['Backspace', 'Delete']

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
}

export function GraphRenderer({
  nodes,
  edges,
  showMinimap,
  showControls,
  editable = false,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodesDelete,
  onEdgesDelete,
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
      nodesDraggable={editable}
      nodesConnectable={editable}
      elementsSelectable={editable}
      nodesFocusable={editable}
      deleteKeyCode={editable ? DELETE_KEYS : null}
      // Auto-fit the viewport to show all nodes on initial mount; without this,
      // diagrams larger than the container's initial viewport render off-screen.
      fitView
    >
      <Background />
      {showControls && <Controls showInteractive={false} />}
      {showMinimap && <MiniMap />}
    </ReactFlow>
  )
}
