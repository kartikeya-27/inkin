import type { Node, NodeProps } from '@xyflow/react'
import type { InkinNodeData } from '../translate'
import { BaseNode } from './BaseNode'
import styles from './TerminalNode.module.css'

/**
 * The terminal/end-state node variant: a rounded rectangle with a double-stroke
 * border (CSS box-shadow trick — see TerminalNode.module.css). Typical use:
 * accept/reject states in a state machine, "Complete"/"Failed" terminal nodes,
 * etc. Maps to the schema's `shape: 'terminal'` enum value.
 */

export type TerminalNodeType = Node<InkinNodeData, 'terminal'>

export function TerminalNode({ id, data }: NodeProps<TerminalNodeType>) {
  return <BaseNode id={id} data={data} className={styles.root} />
}
