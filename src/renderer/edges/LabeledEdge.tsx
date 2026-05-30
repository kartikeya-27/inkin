import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react'
import { EditableLabel, useEditingActions } from '../editing'
import { cn } from '../lib/cn'
import { useEditorStore } from '../store'
import type { InkinEdgeData } from '../translate'
import styles from './LabeledEdge.module.css'

/**
 * The only edge renderer in 0.3.0. Renders a smooth-step path (right-angle
 * connectors with rounded corners — clean for architecture and state diagrams)
 * with optional midpoint label and solid/dashed stroke. Arrowhead is set by
 * `translate.ts` via `markerEnd` on the edge object.
 *
 * The label is rendered via xyflow's `EdgeLabelRenderer` portal so it lives in
 * a separate DOM layer above the SVG, positioned via `transform: translate(...)`
 * to the midpoint coordinates xyflow gives us. This avoids the SVG-text problems
 * with selectable text, line-wrapping, and theme-token color application.
 *
 * 0.3.0 inline editing: when the editor is in editable mode (an `onChange`
 * was supplied to DiagramStudio) AND the edge already has a label, the
 * label is rendered as an `<EditableLabel>`. Double-click swaps the
 * `<div>` for an `<input>`; Enter / blur commits via a `SetField` patch
 * (edge-label kind), Esc cancels.
 *
 * Edges WITHOUT a label cannot be made editable in 0.3.0 — there's no
 * empty slot to double-click on. Creating a label from scratch on an
 * existing edge lands with the Inspector in 0.4.0; for now consumers
 * who want a labeled edge can pre-set `Edge.label = ''` in the schema,
 * which yields an empty editable slot here.
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
  selected,
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

  const editing = useEditingActions()
  const isEditingLabel = useEditorStore(
    (s) => s.editTarget?.kind === 'edge-label' && s.editTarget.id === id,
  )
  const draftText = useEditorStore((s) => (isEditingLabel ? s.draftText : ''))

  const isDashed = data?.style === 'dashed'
  const labelText = data?.label
  // Render the label slot whenever a label exists (including the empty
  // string case — that's how a consumer signals "I want an editable
  // empty slot"). In read-only mode this collapses to the original 0.2.0
  // behavior (label only shown when non-empty).
  const shouldRenderLabel =
    labelText !== undefined && (editing !== null ? true : labelText.length > 0)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(styles.path, isDashed && styles.dashed, selected && styles.selected)}
        {...(markerEnd !== undefined && { markerEnd })}
      />
      {shouldRenderLabel && (
        <EdgeLabelRenderer>
          <div
            className={cn(styles.label, selected && styles.labelSelected)}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {editing === null || labelText === undefined ? (
              labelText
            ) : (
              <EditableLabel
                value={labelText}
                draftText={draftText}
                isEditing={isEditingLabel}
                onStartEdit={() => editing.startEdit({ kind: 'edge-label', id }, labelText)}
                onDraftChange={(text) => editing.updateDraft(text)}
                onCommit={(text) => editing.commit(text)}
                onCancel={() => editing.cancel()}
                ariaLabel={`label for edge ${id}`}
              />
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
