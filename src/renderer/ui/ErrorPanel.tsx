import { cn } from '../lib/cn'
import { Button } from './Button'
import styles from './ErrorPanel.module.css'

/**
 * Inline error banner with `role="alert"`. Used by the Inspector when a
 * dispatched SetField patch fails `safeParse` (e.g. an unknown cluster
 * reference) — the panel surfaces the validation issue without a global
 * toast or a console-only failure.
 *
 * The `role="alert"` makes assistive tech read the message immediately
 * when it appears. `aria-live="polite"` (implied by `role="alert"` in
 * modern screen readers) avoids interrupting the user's current speech
 * stream.
 *
 * `onDismiss` is optional — when provided, a small ✕ button renders that
 * lets the user clear the panel manually. When absent, the panel is
 * caller-controlled (just unmount when the error condition clears).
 */

export interface ErrorPanelProps {
  /** Plain-text error message. Keep short; details belong in the message body. */
  readonly message: string
  /** Optional callback to dismiss the panel via the rendered ✕ button. */
  readonly onDismiss?: () => void
  readonly className?: string | undefined
}

export function ErrorPanel({ message, onDismiss, className }: ErrorPanelProps) {
  return (
    <div role="alert" className={cn(styles.root, className)}>
      <div className={styles.message}>{message}</div>
      {onDismiss !== undefined && (
        <Button
          size="sm"
          variant="danger"
          aria-label="dismiss error"
          onClick={onDismiss}
          className={styles.dismiss}
        >
          ×
        </Button>
      )}
    </div>
  )
}
