import type { Node, NodeProps } from '@xyflow/react'
import type { InkinClusterData } from '../translate'
import styles from './Cluster.module.css'

/**
 * The cluster (subgraph) renderer — a dashed-border container with a small
 * monospace label at the top-left.
 *
 * Composition with xyflow:
 *   - This component renders ONLY the outer frame (border + label). Children
 *     are NOT rendered here.
 *   - xyflow renders cluster-child nodes (any Node with `parentId === cluster.id`)
 *     as siblings of this cluster in the DOM, but visually inside the cluster's
 *     bounding box (because their positions are relative to the parent).
 *   - translate.ts assigns `style: { width, height }` to the cluster node
 *     based on the bounding box of its children. xyflow applies that to the
 *     wrapper element, and our `.root` class fills 100% of that wrapper.
 *
 * The cluster label is positioned absolutely inside the top-left area of the
 * frame. The 28px label-area reservation in translate.ts (CLUSTER_LABEL_HEIGHT)
 * ensures children don't overlap the label.
 */

export type ClusterNodeType = Node<InkinClusterData, 'cluster'>

export function Cluster({ data }: NodeProps<ClusterNodeType>) {
  return (
    <div className={styles.root}>
      <div className={styles.label}>{data.label}</div>
    </div>
  )
}
