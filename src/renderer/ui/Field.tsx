import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import styles from './Field.module.css'

/**
 * Label + input wrapper for Inspector form rows.
 *
 *   <Field label="Shape" htmlFor={id}>
 *     <Select id={id} value={...} onChange={...} options={...} />
 *   </Field>
 *
 * The caller passes the same `id` to both `htmlFor` here and to the child
 * input's `id` prop. Wiring is explicit rather than auto-generated to keep
 * the primitive opinion-free — Inspector field components own the
 * `useId()` call and the wiring.
 *
 * `description` renders below the label as muted helper text (e.g. "must
 * be unique across the diagram" for an id field once renaming lands in
 * 0.5.0). Optional; omitted in 0.4.0 except where a field genuinely needs
 * the hint.
 *
 * `hint` is reserved for an inline trailing affordance (a "?" icon or a
 * keyboard hint chip) — not used in 0.4.0 but the slot exists so future
 * additions don't require a primitive rewrite.
 */

export interface FieldProps {
  /** Visible label text. */
  readonly label: string
  /** Matches the wrapped input's `id` for label/control association. */
  readonly htmlFor: string
  /** The form control element(s). */
  readonly children: ReactNode
  /** Optional muted helper line shown below the label. */
  readonly description?: string
  /** Optional inline trailing slot beside the label. */
  readonly hint?: ReactNode
  readonly className?: string | undefined
}

export function Field({ label, htmlFor, children, description, hint, className }: FieldProps) {
  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.labelRow}>
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
        </label>
        {hint !== undefined && <div className={styles.hint}>{hint}</div>}
      </div>
      {description !== undefined && <div className={styles.description}>{description}</div>}
      <div className={styles.control}>{children}</div>
    </div>
  )
}
