import { useId } from 'react'
import type { Cluster, Node } from '../../schema/types'
import type { EditorActions } from '../editing/EditorActionsContext'
import { Field } from '../ui/Field'
import { Select, type SelectOption } from '../ui/Select'
import { TextInput } from '../ui/TextInput'
import styles from './InspectorPanel.module.css'
import { sharedValue } from './shared'

/**
 * Inspector form for node selection (single or multi-select).
 *
 * Renders four fields — label, sublabel, shape, cluster — wired to
 * `dispatchSetField` / `dispatchAssignCluster` via the EditorActions
 * passed in. The Fields use commit-on-blur/Enter semantics (TextInput
 * and native Select), so typing in a label doesn't flood the dispatcher.
 *
 * Multi-select behavior: every field renders with the shared value when
 * all selected nodes agree, or empty with a `multiple values`
 * placeholder when they differ. Commits apply to every selected node
 * (microtask batching collapses N patches into one onChange).
 *
 * Pure props — no store subscription. The InspectorPanel umbrella reads
 * selection and the parsed diagram, filters down to the selected nodes,
 * and passes them in.
 */

export interface NodeFieldsProps {
  /** The selected node(s). Must be non-empty (the umbrella guards this). */
  readonly nodes: readonly Node[]
  /** Every cluster in the diagram — used to populate the cluster dropdown. */
  readonly clusters: readonly Cluster[]
  readonly actions: EditorActions
}

const SHAPE_OPTIONS: readonly SelectOption[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'terminal', label: 'Terminal' },
] as const

const UNASSIGN_OPTION: SelectOption = { value: '', label: '— none —' }
const MIXED_PLACEHOLDER = 'multiple values'

export function NodeFields({ nodes, clusters, actions }: NodeFieldsProps) {
  const labelId = useId()
  const sublabelId = useId()
  const shapeId = useId()
  const clusterId = useId()

  const label = sharedValue(nodes, (n) => n.label)
  const sublabel = sharedValue(nodes, (n) => n.sublabel)
  const shape = sharedValue(nodes, (n) => n.shape)
  const cluster = sharedValue(nodes, (n) => n.cluster)

  // Dropdown for cluster: always include "— none —" so the user can
  // unassign; append every existing cluster (sorted by id for
  // determinism so the order is stable across renders).
  const clusterOptions: SelectOption[] = [
    UNASSIGN_OPTION,
    ...[...clusters]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map<SelectOption>((c) => ({ value: c.id, label: c.label || c.id })),
  ]

  const onCommitLabel = (text: string) => {
    for (const node of nodes) {
      actions.dispatchSetField({ kind: 'node-label', id: node.id }, text)
    }
  }

  const onCommitSublabel = (text: string) => {
    for (const node of nodes) {
      actions.dispatchSetField({ kind: 'node-sublabel', id: node.id }, text)
    }
  }

  const onChangeShape = (value: string) => {
    for (const node of nodes) {
      actions.dispatchSetField({ kind: 'node-shape', id: node.id }, value)
    }
  }

  const onChangeCluster = (value: string) => {
    // Empty value → unassign; non-empty → reassign.
    const clusterIdOrUndefined = value === '' ? undefined : value
    for (const node of nodes) {
      actions.dispatchAssignCluster(node.id, clusterIdOrUndefined)
    }
  }

  // For Select fields with mixed values across selection, we keep the
  // select's `value` as '' which renders no option visibly selected;
  // changing it explicitly applies to all. The shape dropdown uses an
  // empty value as a synthetic placeholder; the cluster dropdown maps
  // '' to the documented "unassign" sentinel — both behaviors are
  // disambiguated by the user picking an option.
  const shapeSelectValue = shape.hasMixed ? '' : shape.value
  const clusterSelectValue = cluster.hasMixed ? '' : cluster.value

  return (
    <>
      {nodes.length > 1 && (
        <div className={styles.bulkBanner} role="status" data-testid="inkin-inspector-bulk-banner">
          Applies to all {nodes.length} selected nodes
        </div>
      )}
      <Field label={nodes.length > 1 ? 'Labels' : 'Label'} htmlFor={labelId}>
        <TextInput
          id={labelId}
          value={label.value}
          onCommit={onCommitLabel}
          {...(label.hasMixed && { placeholder: MIXED_PLACEHOLDER })}
        />
      </Field>
      <Field label="Sublabel" htmlFor={sublabelId}>
        <TextInput
          id={sublabelId}
          value={sublabel.value}
          onCommit={onCommitSublabel}
          {...(sublabel.hasMixed && { placeholder: MIXED_PLACEHOLDER })}
        />
      </Field>
      <Field label="Shape" htmlFor={shapeId}>
        <Select
          id={shapeId}
          value={shapeSelectValue}
          onChange={onChangeShape}
          options={SHAPE_OPTIONS}
          {...(shape.hasMixed && { placeholder: MIXED_PLACEHOLDER })}
        />
      </Field>
      <Field label="Cluster" htmlFor={clusterId}>
        <Select
          id={clusterId}
          value={clusterSelectValue}
          onChange={onChangeCluster}
          options={clusterOptions}
          {...(cluster.hasMixed && { placeholder: MIXED_PLACEHOLDER })}
        />
      </Field>
    </>
  )
}
