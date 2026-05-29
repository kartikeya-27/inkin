import type { Node, NodeProps } from '@xyflow/react'
import type { InkinNodeData } from '../translate'
import { BaseNode } from './BaseNode'
import styles from './RectNode.module.css'

/**
 * The default node shape: a rounded rectangle with a 1px border. Used for
 * everything that isn't a state-machine terminal state. Maps to the schema's
 * `shape: 'rect'` enum value.
 */

export type RectNodeType = Node<InkinNodeData, 'rect'>

export function RectNode({ data }: NodeProps<RectNodeType>) {
  return <BaseNode data={data} className={styles.root} />
}
