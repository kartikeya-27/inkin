import {
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { cn } from '../lib/cn'
import styles from './EditableLabel.module.css'

/**
 * `<EditableLabel>` — the shared inline-edit primitive used by `BaseNode`
 * (label + sublabel) and `LabeledEdge` (edge label). Renders a static
 * `<div>{value}</div>` in the resting state and swaps to an `<input>` when
 * `isEditing` is true.
 *
 * Why `<input>` instead of `contenteditable`:
 *   - Width-controlled (xyflow nodes are 180 px) — input fits the box
 *     without producing layout jump.
 *   - Native Enter / Esc / blur semantics; no custom keyboard handling
 *     for the basics.
 *   - Dodges contenteditable's well-known IME, paste-formatting (HTML
 *     gets pasted by default and has to be sanitized), and undo-stack
 *     bugs. React's `onChange` story is also clean.
 *
 * Why the `nodrag` and `nopan` classes on the input: xyflow captures
 * pointer events on the pane to drive its drag/select interactions. Without
 * these explicit opt-outs, clicking into the input would start an xyflow
 * drag instead of focusing the input. `nodrag` and `nopan` are xyflow's
 * documented escape hatches; the input also stops propagation on its
 * pointerdown so even surrounding wrappers can't intercept.
 *
 * Why a single component used by both nodes and edges: the keyboard / focus
 * / commit-on-blur behavior is identical across surfaces — owning it in one
 * place means a future a11y tweak (e.g., Esc twice to clear selection) lands
 * once. The component is stateless about *which* schema field it edits;
 * the parent decides what to do with `onCommit(text)`.
 *
 * Commit semantics:
 *   - Enter → `onCommit(value)`, then `onCommit` is expected to clear the
 *     editing state (via EditSlice.commitEdit).
 *   - Esc → `onCancel()`. Does NOT fire `onCommit`.
 *   - Blur → `onCommit(value)`. The keyboard-driven Enter path also calls
 *     blur, so the input has explicit `blurredViaEnter` ref-tracking to
 *     avoid double-firing onCommit. Blur-without-Enter still commits per
 *     the plan ("commit on Enter / blur, cancel on Esc").
 *
 * Empty string is a valid committed value (intentionally blank labels are
 * supported by the schema). The parent decides whether to surface the
 * empty-string case differently.
 */

export interface EditableLabelProps {
  /** The committed text shown when not editing. */
  readonly value: string
  /** Draft text bound to the `<input>` when editing. */
  readonly draftText: string
  /** True when this label is the active inline-edit target. */
  readonly isEditing: boolean
  /** Double-click handler — typically dispatches `startEdit` on the EditSlice. */
  readonly onStartEdit: () => void
  /** Keystroke handler — typically dispatches `updateDraft` on the EditSlice. */
  readonly onDraftChange: (text: string) => void
  /** Fired on Enter or blur with the current draft text. */
  readonly onCommit: (text: string) => void
  /** Fired on Esc. */
  readonly onCancel: () => void
  /** Placeholder shown in the input when draft is empty. */
  readonly placeholder?: string
  /** Extra class for the outer span (caller controls typography / layout). */
  readonly className?: string | undefined
  /**
   * Accessible label for the input element (e.g., 'node label', 'edge label').
   * Read by screen readers when focused.
   */
  readonly ariaLabel: string
}

export function EditableLabel({
  value,
  draftText,
  isEditing,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
  placeholder,
  className,
  ariaLabel,
}: EditableLabelProps) {
  // Tracks whether the most recent blur was triggered by Enter (which already
  // fired onCommit). Prevents the synthetic blur-after-Enter from firing
  // onCommit a second time with the same value.
  const committedViaEnterRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus + select-all on edit start so the user can type-to-replace
  // (the most common intent when double-clicking a label).
  useEffect(() => {
    if (isEditing && inputRef.current !== null) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        committedViaEnterRef.current = true
        onCommit(draftText)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      // Stop other keys from bubbling to xyflow's keymap (Delete/Backspace
      // inside the input must edit text, not delete the node).
      event.stopPropagation()
    },
    [draftText, onCommit, onCancel],
  )

  const handleBlur = useCallback(() => {
    // Enter already fired onCommit; consume the flag and don't double-fire.
    if (committedViaEnterRef.current) {
      committedViaEnterRef.current = false
      return
    }
    onCommit(draftText)
  }, [draftText, onCommit])

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onDraftChange(event.currentTarget.value)
    },
    [onDraftChange],
  )

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.stopPropagation()
      onStartEdit()
    },
    [onStartEdit],
  )

  // Stop pointer events at the input boundary so xyflow's pane handler
  // doesn't start a drag / pan when the user clicks into the input.
  const stopPointer = useCallback((event: MouseEvent) => {
    event.stopPropagation()
  }, [])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        // `nodrag` and `nopan` are xyflow's documented opt-outs; without
        // them, pointer events here start a node-drag instead of focusing
        // the input. The CSS Module's own class governs visual style.
        className={cn(styles.input, 'nodrag', 'nopan', className)}
        value={draftText}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPointerDown={stopPointer}
        onMouseDown={stopPointer}
        onClick={stopPointer}
        aria-label={ariaLabel}
        {...(placeholder !== undefined && { placeholder })}
      />
    )
  }

  return (
    <div
      className={cn(styles.staticLabel, className)}
      onDoubleClick={handleDoubleClick}
      // Make the static label keyboard-discoverable; Phase 11's keymap will
      // wire Enter on a focused node to dispatch startEdit. tabIndex=-1
      // makes it focusable programmatically without joining the Tab order
      // (xyflow handles Tab navigation between nodes).
      tabIndex={-1}
    >
      {value}
    </div>
  )
}
