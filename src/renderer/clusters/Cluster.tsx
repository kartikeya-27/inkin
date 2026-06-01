import type { Node, NodeProps } from '@xyflow/react'
import { EditableLabel, useEditingActions } from '../editing'
import { useEditorStore } from '../store'
import type { InkinClusterData } from '../translate'
import styles from './Cluster.module.css'

/**
 * The cluster (subgraph) renderer — a dashed-border container with a small
 * monospace label at the top.
 *
 * 0.4.0 — first-class container (Phase 18):
 *   - Header strip carries the global `inkin-cluster-drag-handle` class so
 *     xyflow's `dragHandle` selector restricts drag-init to the header.
 *     The body stays click-through for the child nodes that visually sit
 *     inside the cluster bounds.
 *   - Label is an `<EditableLabel>` in editable mode — double-click renames.
 *     In read-only mode (no `EditingContext`), it falls back to a static
 *     `<div>` matching the 0.2.0 appearance.
 *
 * Composition with xyflow:
 *   - This component renders ONLY the outer frame + header. Children are
 *     NOT rendered here.
 *   - xyflow renders cluster-child nodes (any Node with `parentId === cluster.id`)
 *     as siblings of this cluster in the DOM, but visually inside the cluster's
 *     bounding box (because their positions are relative to the parent).
 *   - translate.ts assigns `style: { width, height }` to the cluster node
 *     based on the bounding box of its children. xyflow applies that to the
 *     wrapper element, and our `.root` class fills 100% of that wrapper.
 *
 * The cluster header is positioned absolutely inside the top of the
 * frame. The 28px label-area reservation in translate.ts (CLUSTER_LABEL_HEIGHT)
 * ensures children don't overlap the header.
 */

export type ClusterNodeType = Node<InkinClusterData, 'cluster'>

const DRAG_HANDLE_CLASS = 'inkin-cluster-drag-handle'

export function Cluster({ id, data }: NodeProps<ClusterNodeType>) {
  const editing = useEditingActions()
  const isEditingLabel = useEditorStore(
    (s) => s.editTarget?.kind === 'cluster-label' && s.editTarget.id === id,
  )
  const draftText = useEditorStore((s) => (isEditingLabel ? s.draftText : ''))

  return (
    <div className={styles.root}>
      <div className={`${styles.header} ${DRAG_HANDLE_CLASS}`}>
        {editing === null ? (
          <div className={styles.label}>{data.label}</div>
        ) : (
          <EditableLabel
            value={data.label}
            draftText={draftText}
            isEditing={isEditingLabel}
            onStartEdit={() => editing.startEdit({ kind: 'cluster-label', id }, data.label)}
            onDraftChange={(text) => editing.updateDraft(text)}
            onCommit={(text) => editing.commit(text)}
            onCancel={() => editing.cancel()}
            className={styles.label}
            ariaLabel={`label for cluster ${id}`}
          />
        )}
      </div>
    </div>
  )
}
