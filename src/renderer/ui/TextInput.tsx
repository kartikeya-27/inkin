import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import styles from './TextInput.module.css'

/**
 * Controlled text input with commit-on-blur / commit-on-Enter semantics.
 *
 * Mirrors `<EditableLabel>`'s keyboard behavior so the inkin "feel" is
 * uniform across inline-edit (canvas) and form-edit (Inspector) surfaces:
 *
 *   - Typing updates an internal draft; the parent's state does NOT change
 *     per keystroke. This is the critical guard against the Inspector-storm
 *     bug (typing 10 chars firing 10 `onChange` calls into xyflow's
 *     re-translate loop). The committed parent state only changes when the
 *     user signals intent: Enter or blur.
 *   - Enter and blur both call `onCommit(draftText)`; Enter also blurs the
 *     input so the dom-blur side-effect chain is identical (notify-once
 *     guarded by a ref).
 *   - Esc calls `onCancel?.()` and reverts the draft to `value`. The
 *     visible input snaps back; the parent's state is untouched.
 *   - External `value` changes (consumer updated state by some other
 *     route) re-seed the draft, so the input always shows the latest
 *     committed value when it's not actively being edited.
 *
 * NOT coupled to the editor store. Pass `value` / `onCommit` from a
 * controlling component (Inspector field, Palette name field, whatever
 * needs commit-on-blur form semantics).
 */

export interface TextInputProps {
  /** The committed value. The input renders this when not actively edited. */
  readonly value: string
  /**
   * Fired when the user signals commit intent (Enter or blur). Receives
   * the current draft text. The component does NOT update its own
   * internal state on commit — that's the parent's job via the next
   * `value` prop.
   */
  readonly onCommit: (text: string) => void
  /** Optional cancel callback. Esc reverts the draft and calls this if provided. */
  readonly onCancel?: () => void
  /** HTML id for `<label htmlFor>` wiring. See {@link Field}. */
  readonly id?: string
  /** ARIA label override when an external `<label>` isn't present. */
  readonly ariaLabel?: string
  /** Placeholder shown when the draft is empty. */
  readonly placeholder?: string
  /** Disable the input. Receives focus but ignores input. */
  readonly disabled?: boolean
  readonly className?: string | undefined
}

export function TextInput({
  value,
  onCommit,
  onCancel,
  id,
  ariaLabel,
  placeholder,
  disabled,
  className,
}: TextInputProps) {
  const [draft, setDraft] = useState(value)
  // Tracks whether the next blur was triggered by Enter (which already
  // fired onCommit) — guards against double-commit.
  const committedViaEnterRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-seed the draft when the committed value changes from outside (e.g.
  // the consumer's setState ran in response to a different commit). Skip
  // when the user is actively typing — interrupting them mid-edit is
  // disorienting; the next blur or Enter will reconcile.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setDraft(value)
  }, [value])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.currentTarget.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      committedViaEnterRef.current = true
      onCommit(draft)
      inputRef.current?.blur()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setDraft(value)
      onCancel?.()
      inputRef.current?.blur()
      return
    }
    // Stop other keys (Backspace / Delete) from bubbling to xyflow's
    // global keymap, otherwise typing in an Inspector field could
    // delete the selected node.
    event.stopPropagation()
  }

  const handleBlur = () => {
    if (committedViaEnterRef.current) {
      committedViaEnterRef.current = false
      return
    }
    onCommit(draft)
  }

  return (
    <input
      ref={inputRef}
      // `nodrag` and `nopan` are xyflow's documented opt-outs; while
      // Inspector lives off-canvas, defending in depth costs nothing and
      // prevents pointer events from being captured by the pane if a
      // future layout puts the panel over the canvas.
      className={cn(styles.root, 'nodrag', 'nopan', className)}
      type="text"
      value={draft}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={disabled === true}
      {...(id !== undefined && { id })}
      {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
      {...(placeholder !== undefined && { placeholder })}
    />
  )
}
