import type { Diagram } from '../../schema/types'
import { effectiveEdgeId } from '../editing/apply-patch'
import { useEditorActions } from '../editing/EditorActionsContext'
import { cn } from '../lib/cn'
import { useEditorStore, useEditorStoreApi } from '../store'
import { ClusterFields } from './ClusterFields'
import { EdgeFields } from './EdgeFields'
import { EmptyState } from './EmptyState'
import styles from './InspectorPanel.module.css'
import { NodeFields } from './NodeFields'

/**
 * Selection-driven contextual editor panel. Mounted by `DiagramStudio`
 * when in editable mode and the `inspector` prop is not `'off'`.
 *
 * Routes between the four content states based on store selection,
 * with priority **nodes > edges > clusters > nothing**:
 *
 *   1. Any node selected → `<NodeFields>` (label, sublabel, shape,
 *      cluster). Multi-select handled inside NodeFields.
 *   2. Else, any edge selected → `<EdgeFields>` (label, style).
 *   3. Else, any cluster selected → `<ClusterFields>` (label).
 *   4. Else → `<EmptyState>` ("nothing selected" hint).
 *
 * Routing priority (rather than mixed-kind intersection) keeps the UX
 * narrow: in practice xyflow's selection is per-kind because click and
 * marquee-select operate on one kind at a time. The Inspector commits
 * to whichever kind is currently active and ignores the others.
 *
 * The header shows the current kind + count so multi-select is
 * obvious ("2 nodes" vs "Node"). Clicking nothing visible empties
 * the panel.
 *
 * Read-only / no-actions safety: when `useEditorActions()` is null
 * (read-only mode), the panel renders nothing — DiagramStudio's
 * default `inspector` prop is `'off'` outside editable mode anyway,
 * so this is the secondary guard.
 */

export type InspectorPosition = 'right' | 'left'

export interface InspectorPanelProps {
  /**
   * Schema-authoritative parsed diagram. DiagramStudioInner passes
   * `sync.parsedDiagram` down; the panel reads field values from it
   * by id. Required even when nothing is selected (for cluster
   * options when a node selection happens).
   */
  readonly diagram: Diagram
  /** Which side of the canvas the panel docks to. Default `'right'`. */
  readonly position?: InspectorPosition
  /** Additional CSS class for the panel wrapper. */
  readonly className?: string | undefined
  /**
   * 0.4.0 Phase 28 — invoked when the user clicks the "x" on a chip in
   * the multi-select rail. DiagramStudioInner wires this to
   * `sync.onNodesChange([{ type: 'select', id, selected: false }])`
   * so the deselect propagates to both xyflow's internal state (the
   * canvas selection ring disappears) and our SelectionSlice mirror
   * (the chip rail re-renders). Optional — when omitted the rail
   * still renders but the chip remove button no-ops, which is the
   * safe fallback for read-only embeds that mount InspectorPanel
   * directly.
   */
  readonly onDeselectNode?: (nodeId: string) => void
}

export function InspectorPanel({
  diagram,
  position = 'right',
  className,
  onDeselectNode,
}: InspectorPanelProps) {
  const actions = useEditorActions()
  const storeApi = useEditorStoreApi()
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useEditorStore((s) => s.selectedEdgeIds)
  const selectedClusterIds = useEditorStore((s) => s.selectedClusterIds)

  if (actions === null) return null

  const selectedNodes = diagram.nodes.filter((node) => selectedNodeIds.has(node.id))
  const selectedEdges = diagram.edges.filter((edge) => selectedEdgeIds.has(effectiveEdgeId(edge)))
  const selectedClusters = (diagram.clusters ?? []).filter((cluster) =>
    selectedClusterIds.has(cluster.id),
  )

  const { kind, count, content } = routeContent({
    diagram,
    actions,
    selectedNodes,
    selectedEdges,
    selectedClusters,
    ...(onDeselectNode !== undefined && { onRemoveFromSelection: onDeselectNode }),
  })

  // Phase 20 clarity: visible clear-selection button next to the title
  // whenever anything is selected. Lets the user back out of a multi-
  // select state explicitly rather than clicking on a random pane spot
  // hoping to deselect.
  const hasSelection = kind !== 'empty'

  return (
    <aside
      className={cn(
        styles.root,
        position === 'right' ? styles.positionRight : styles.positionLeft,
        className,
      )}
      aria-label="Inspector"
      data-testid="inkin-inspector"
    >
      <header className={styles.header}>
        <div className={styles.title}>{titleFor(kind, count)}</div>
        {hasSelection && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => storeApi.getState().clearSelection()}
            aria-label="Clear selection"
            data-testid="inkin-inspector-clear"
          >
            Clear
          </button>
        )}
      </header>
      <div className={styles.body}>{content}</div>
    </aside>
  )
}

type RouteKind = 'node' | 'edge' | 'cluster' | 'empty'

interface RouteResult {
  readonly kind: RouteKind
  readonly count: number
  readonly content: React.ReactNode
}

function routeContent({
  diagram,
  actions,
  selectedNodes,
  selectedEdges,
  selectedClusters,
  onRemoveFromSelection,
}: {
  readonly diagram: Diagram
  readonly actions: import('../editing/EditorActionsContext').EditorActions
  readonly selectedNodes: ReturnType<typeof Array.prototype.filter>
  readonly selectedEdges: ReturnType<typeof Array.prototype.filter>
  readonly selectedClusters: ReturnType<typeof Array.prototype.filter>
  readonly onRemoveFromSelection?: (nodeId: string) => void
}): RouteResult {
  if (selectedNodes.length > 0) {
    return {
      kind: 'node',
      count: selectedNodes.length,
      content: (
        <NodeFields
          nodes={selectedNodes}
          clusters={diagram.clusters ?? []}
          actions={actions}
          {...(onRemoveFromSelection !== undefined && { onRemoveFromSelection })}
        />
      ),
    }
  }
  if (selectedEdges.length > 0) {
    return {
      kind: 'edge',
      count: selectedEdges.length,
      content: <EdgeFields edges={selectedEdges} actions={actions} />,
    }
  }
  if (selectedClusters.length > 0) {
    return {
      kind: 'cluster',
      count: selectedClusters.length,
      content: <ClusterFields clusters={selectedClusters} actions={actions} />,
    }
  }
  return { kind: 'empty', count: 0, content: <EmptyState /> }
}

function titleFor(kind: RouteKind, count: number): string {
  if (kind === 'empty') return 'Inspector'
  const noun = kind === 'node' ? 'node' : kind === 'edge' ? 'edge' : 'cluster'
  return count > 1 ? `${count} ${noun}s` : noun.charAt(0).toUpperCase() + noun.slice(1)
}
