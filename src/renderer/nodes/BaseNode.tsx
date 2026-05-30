import { Handle, Position } from '@xyflow/react'
import type { MouseEvent } from 'react'
import { EditableLabel, useEditingActions } from '../editing'
import { cn } from '../lib/cn'
import { useEditorStore } from '../store'
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
 * 0.3.0 inline editing: when the editor is in editable mode (an `onChange`
 * was supplied to DiagramStudio), the EditingContext is mounted and the
 * label + sublabel render as `<EditableLabel>`s instead of static `<div>`s.
 * Double-click on a label dispatches `startEdit` on the EditSlice; the
 * input swaps in, the user types, Enter / blur commits via the
 * EditingContext (which dispatches a `SetField` patch + clears the slot),
 * Esc cancels.
 *
 * In read-only mode, `useEditingActions()` returns `null`, no EditableLabel
 * is rendered — just plain divs with no editing affordance whatsoever.
 *
 * Handles in 0.3.0:
 *   - Two handles per node: source on the right, target on the left.
 *   - LR layout is assumed (matches dagre's default direction). TB/RL layouts
 *     render edges that visually curve around — multi-direction handle support
 *     lands in a future minor when the editor surface justifies the complexity.
 *   - `isConnectable` is intentionally NOT set per-handle. xyflow's top-level
 *     `nodesConnectable` (flipped from GraphRenderer based on `editable`)
 *     controls whether drag-to-connect is allowed; per-handle overrides
 *     would clobber that.
 */

export interface BaseNodeProps {
  /**
   * Node id — required so the inline-edit path knows which schema node a
   * label commit targets. Propagated from the variant component
   * (RectNode / TerminalNode) which reads it from xyflow's NodeProps.
   */
  readonly id: string
  readonly data: InkinNodeData
  /**
   * xyflow's selection flag for this node. Drives the `.selected` modifier
   * class which renders the accent-color selection ring. Plumbed from the
   * variant component (RectNode / TerminalNode → NodeProps.selected) so
   * the ring tracks xyflow's visual selection state directly (matches the
   * `Mirror both` decision from the plan).
   */
  readonly selected?: boolean
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

export function BaseNode({ id, data, selected, className }: BaseNodeProps) {
  const editing = useEditingActions()
  // Narrow selectors so this BaseNode only re-renders when ITS own edit state
  // changes — selecting an unrelated node doesn't ripple here.
  const isEditingLabel = useEditorStore(
    (s) => s.editTarget?.kind === 'node-label' && s.editTarget.id === id,
  )
  const isEditingSublabel = useEditorStore(
    (s) => s.editTarget?.kind === 'node-sublabel' && s.editTarget.id === id,
  )
  // Pull draftText only when this node has an active edit; otherwise we
  // subscribe to an unused value just to avoid a conditional hook call.
  const draftText = useEditorStore((s) => (isEditingLabel || isEditingSublabel ? s.draftText : ''))

  // Whole-body double-click → edit label. EditableLabel itself stops
  // propagation on its own dblclick, so dblclicking directly on the
  // sublabel still routes through the sublabel handler (no race). The
  // root handler covers the padding around the labels — without it, a
  // dblclick a few pixels off the text falls through to xyflow's pane
  // and triggers its default zoom-on-doubleclick.
  const handleRootDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (editing === null) return
    event.stopPropagation()
    editing.startEdit({ kind: 'node-label', id }, data.label)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: double-click is the documented affordance for inline rename, mirroring EditableLabel; keyboard equivalent is Enter on a focused node, handled by useKeymap
    <div
      className={cn(styles.root, selected && styles.selected, className)}
      onDoubleClick={handleRootDoubleClick}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />

      {editing === null ? (
        <div className={styles.label}>{data.label}</div>
      ) : (
        <EditableLabel
          value={data.label}
          draftText={draftText}
          isEditing={isEditingLabel}
          onStartEdit={() => editing.startEdit({ kind: 'node-label', id }, data.label)}
          onDraftChange={(text) => editing.updateDraft(text)}
          onCommit={(text) => editing.commit(text)}
          onCancel={() => editing.cancel()}
          ariaLabel={`label for node ${id}`}
          className={styles.label}
        />
      )}

      {data.sublabel !== undefined &&
        (editing === null ? (
          <div className={styles.sublabel}>{data.sublabel}</div>
        ) : (
          <EditableLabel
            value={data.sublabel}
            draftText={draftText}
            isEditing={isEditingSublabel}
            onStartEdit={() =>
              editing.startEdit({ kind: 'node-sublabel', id }, data.sublabel ?? '')
            }
            onDraftChange={(text) => editing.updateDraft(text)}
            onCommit={(text) => editing.commit(text)}
            onCancel={() => editing.cancel()}
            ariaLabel={`sublabel for node ${id}`}
            className={styles.sublabel}
          />
        ))}
    </div>
  )
}
