import { Handle, Position } from '@xyflow/react'
import { cn } from '../lib/cn'
import type { InkinNodeData } from '../translate'
import styles from './BaseNode.module.css'

/**
 * Shared building block for every Inkin node variant (RectNode, TerminalNode).
 *
 * This is NOT itself an xyflow node component — it's a presentational wrapper
 * that each variant uses internally. The variant component supplies its own
 * outer-wrapper class name (e.g. `RectNode.module.css#root` for the rectangle
 * border, or `TerminalNode.module.css#root` for the double-stroke effect),
 * and BaseNode handles the rest: label layout, optional sublabel, and the
 * xyflow handles that anchor edges.
 *
 * Handles in 0.2.0:
 *   - Two handles per node: source on the right, target on the left.
 *   - Functional but visually invisible (opacity: 0, no border, no fill).
 *   - `isConnectable={false}` — read-only renderer; consumers can't drag-to-connect.
 *   - LR layout is assumed (matches dagre's default direction). TB/RL layouts
 *     render edges that visually curve around — multi-direction handle support
 *     lands in a future minor when the editor surface justifies the complexity.
 */

export interface BaseNodeProps {
  readonly data: InkinNodeData
  /**
   * Outer-wrapper class from the variant's CSS Module (RectNode or TerminalNode).
   * Explicitly `string | undefined` (not bare-optional) because under
   * `exactOptionalPropertyTypes`, CSS Module class accesses (typed as
   * `string | undefined` by `noUncheckedIndexedAccess`) can only be passed
   * to a prop whose type also includes `undefined`. `cn()` then filters
   * the falsy case when composing.
   */
  readonly className?: string | undefined
}

export function BaseNode({ data, className }: BaseNodeProps) {
  return (
    <div className={cn(styles.root, className)}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        isConnectable={false}
      />

      <div className={styles.label}>{data.label}</div>
      {data.sublabel !== undefined && <div className={styles.sublabel}>{data.sublabel}</div>}
    </div>
  )
}
