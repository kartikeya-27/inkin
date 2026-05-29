import { Background, Controls, type Edge, MiniMap, type Node, ReactFlow } from '@xyflow/react'
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
 * 0.2.0 is read-only: `nodesDraggable`, `nodesConnectable`, and
 * `elementsSelectable` are all false. Pan and zoom remain enabled (xyflow's
 * defaults) because navigation is not editing.
 */

// Composed once at module scope; the maps never change.
const nodeTypes = { ...rendererNodeTypes, ...clusterNodeTypes }

export interface GraphRendererProps {
  readonly nodes: Node[]
  readonly edges: Edge[]
  readonly showMinimap: boolean
  readonly showControls: boolean
}

export function GraphRenderer({ nodes, edges, showMinimap, showControls }: GraphRendererProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      // Read-only in 0.2.0 — editing arrives in 0.3.0.
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
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
