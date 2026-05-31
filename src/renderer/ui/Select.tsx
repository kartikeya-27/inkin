import type { ChangeEvent } from 'react'
import { cn } from '../lib/cn'
import styles from './Select.module.css'

/**
 * Native `<select>` wrapped with inkin's visual chrome. Used by the
 * Inspector for shape / style / cluster pickers.
 *
 * Why native (not a custom popover):
 *   - Keyboard nav (ArrowUp/Down/Home/End/typeahead) comes for free.
 *   - Mobile devices render the OS's native picker (much better UX than
 *     any web implementation).
 *   - Accessibility surface is browser-managed and battle-tested.
 *   - Zero size cost beyond a few CSS rules.
 *
 * The visual override is `appearance: none` plus a custom chevron drawn
 * with a background-image SVG (via CSS) so the select still looks like
 * an inkin form control. The native dropdown popup retains the OS look.
 */

export interface SelectOption {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

export interface SelectProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly options: readonly SelectOption[]
  /** For `<label htmlFor>` wiring. See {@link Field}. */
  readonly id?: string
  /** ARIA label override when an external `<label>` isn't present. */
  readonly ariaLabel?: string
  readonly disabled?: boolean
  /**
   * Optional placeholder rendered as a disabled `<option>` shown when
   * `value === ''`. Doesn't itself become selectable — the user must
   * pick a real option to dismiss it.
   */
  readonly placeholder?: string
  readonly className?: string | undefined
}

export function Select({
  value,
  onChange,
  options,
  id,
  ariaLabel,
  disabled,
  placeholder,
  className,
}: SelectProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.currentTarget.value)
  }
  return (
    <select
      className={cn(styles.root, 'nodrag', 'nopan', className)}
      value={value}
      onChange={handleChange}
      disabled={disabled === true}
      {...(id !== undefined && { id })}
      {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
    >
      {placeholder !== undefined && (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled === true}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
