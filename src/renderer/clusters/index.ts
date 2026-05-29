import type { NodeTypes } from '@xyflow/react'
import { Cluster } from './Cluster'

/**
 * `src/renderer/clusters` — the cluster (subgraph) renderer + its slot in the
 * xyflow `nodeTypes` map. Kept in a separate folder from `nodes/` because
 * clusters are conceptually different from regular nodes (they are containers,
 * not leaves), even though xyflow models both as the same `Node` primitive.
 *
 * DiagramStudio composes this slot with `nodes/nodeTypes` into the full map
 * passed to `<ReactFlow nodeTypes={...} />`.
 */

export type { ClusterNodeType } from './Cluster'
export { Cluster } from './Cluster'

export const clusterNodeTypes: NodeTypes = {
  cluster: Cluster,
}
