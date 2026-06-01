import styles from './EmptyState.module.css'

/**
 * Rendered by InspectorPanel when nothing is selected. Two-line hint that
 * tells the user the panel is selection-driven and the kinds of things
 * they can click on.
 */
export function EmptyState() {
  return (
    <div className={styles.root}>
      <div className={styles.title}>No selection</div>
      <div className={styles.hint}>Select a node, edge, or cluster to edit its fields.</div>
    </div>
  )
}
