import { useId } from 'react'
import type { Edge } from '../../schema/types'
import { effectiveEdgeId } from '../editing/apply-patch'
import type { EditorActions } from '../editing/EditorActionsContext'
import { Field } from '../ui/Field'
import { Select, type SelectOption } from '../ui/Select'
import { TextInput } from '../ui/TextInput'
import { sharedValue } from './shared'

/**
 * Inspector form for edge selection. Renders label + style.
 *
 * Edge identity in patches uses the effective id (`Edge.id` if set,
 * else `${from}->${to}`). The SetField target.kind is `edge-label` /
 * `edge-style`; both use that effective id, matching how the existing
 * inline edit and drag-to-connect flows address edges.
 */

const STYLE_OPTIONS: readonly SelectOption[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
] as const

const MIXED_PLACEHOLDER = 'multiple values'

export interface EdgeFieldsProps {
  /** The selected edge(s). Must be non-empty. */
  readonly edges: readonly Edge[]
  readonly actions: EditorActions
}

export function EdgeFields({ edges, actions }: EdgeFieldsProps) {
  const labelId = useId()
  const styleId = useId()

  const label = sharedValue(edges, (e) => e.label)
  const style = sharedValue(edges, (e) => e.style)

  const onCommitLabel = (text: string) => {
    for (const edge of edges) {
      actions.dispatchSetField({ kind: 'edge-label', id: effectiveEdgeId(edge) }, text)
    }
  }

  const onChangeStyle = (value: string) => {
    for (const edge of edges) {
      actions.dispatchSetField({ kind: 'edge-style', id: effectiveEdgeId(edge) }, value)
    }
  }

  const styleSelectValue = style.hasMixed ? '' : style.value

  return (
    <>
      <Field label={edges.length > 1 ? 'Labels' : 'Label'} htmlFor={labelId}>
        <TextInput
          id={labelId}
          value={label.value}
          onCommit={onCommitLabel}
          {...(label.hasMixed && { placeholder: MIXED_PLACEHOLDER })}
        />
      </Field>
      <Field label="Style" htmlFor={styleId}>
        <Select
          id={styleId}
          value={styleSelectValue}
          onChange={onChangeStyle}
          options={STYLE_OPTIONS}
          {...(style.hasMixed && { placeholder: MIXED_PLACEHOLDER })}
        />
      </Field>
    </>
  )
}
