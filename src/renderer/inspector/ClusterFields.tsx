import { useId } from 'react'
import type { Cluster } from '../../schema/types'
import type { EditorActions } from '../editing/EditorActionsContext'
import { Field } from '../ui/Field'
import { TextInput } from '../ui/TextInput'
import { sharedValue } from './shared'

/**
 * Inspector form for cluster selection. Only `label` is editable in 0.4.0.
 * Cluster id rename + parent-cluster reassignment land in 0.5.0+.
 */

const MIXED_PLACEHOLDER = 'multiple values'

export interface ClusterFieldsProps {
  readonly clusters: readonly Cluster[]
  readonly actions: EditorActions
}

export function ClusterFields({ clusters, actions }: ClusterFieldsProps) {
  const labelId = useId()
  const label = sharedValue(clusters, (c) => c.label)

  const onCommitLabel = (text: string) => {
    for (const cluster of clusters) {
      actions.dispatchSetField({ kind: 'cluster-label', id: cluster.id }, text)
    }
  }

  return (
    <Field label={clusters.length > 1 ? 'Labels' : 'Label'} htmlFor={labelId}>
      <TextInput
        id={labelId}
        value={label.value}
        onCommit={onCommitLabel}
        {...(label.hasMixed && { placeholder: MIXED_PLACEHOLDER })}
      />
    </Field>
  )
}
