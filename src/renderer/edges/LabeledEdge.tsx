import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react'
import { cn } from '../lib/cn'
import type { InkinEdgeData } from '../translate'
import styles from './LabeledEdge.module.css'

/**
 * The only edge renderer in 0.2.0. Renders a smooth-step path (right-angle
 * connectors with rounded corners — clean for architecture and state diagrams)
 * with optional midpoint label and solid/dashed stroke. Arrowhead is set by
 * `translate.ts` via `markerEnd` on the edge object.
 *
 * The label is rendered via xyflow's `EdgeLabelRenderer` portal so it lives in
 * a separate DOM layer above the SVG, positioned via `transform: translate(...)`
 * to the midpoint coordinates xyflow gives us. This avoids the SVG-text problems
 * with selectable text, line-wrapping, and theme-token color application.
 */

export type LabeledEdgeType = Edge<InkinEdgeData, 'labeled'>

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<LabeledEdgeType>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 6,
  })

  const isDashed = data?.style === 'dashed'

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(styles.path, isDashed && styles.dashed)}
        {...(markerEnd !== undefined && { markerEnd })}
      />
      {data?.label !== undefined && data.label.length > 0 && (
        <EdgeLabelRenderer>
          <div
            className={styles.label}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
