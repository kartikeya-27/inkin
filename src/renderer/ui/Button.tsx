import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { cn } from '../lib/cn'
import styles from './Button.module.css'

/**
 * Internal `<Button>` — used by Palette tools and Inspector confirm/cancel
 * actions. Not exported from the public surface (`src/index.ts`); consumers
 * needing their own buttons style them themselves.
 *
 * Defaults to `type="button"` so it never accidentally submits a form
 * (the most common React-button footgun). Caller can override via the
 * `type` prop if needed.
 *
 * Aria-pressed support is the toggle-button hook for the Palette (Add Node,
 * Add Cluster buttons reflect their `mode === 'placing-*'` state via
 * `aria-pressed`). Native Enter / Space activation comes from `<button>`
 * itself — no custom keyboard handling needed.
 */

export type ButtonSize = 'sm' | 'md'
export type ButtonVariant = 'default' | 'primary' | 'danger'

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'> {
  /** Visible content; usually `<svg>...</svg>{label}` or just a string. */
  readonly children: ReactNode
  /** sm = compact toolbar buttons; md = standard form actions. Default `md`. */
  readonly size?: ButtonSize
  /** `primary` for the dominant action; `danger` for destructive. Default `default`. */
  readonly variant?: ButtonVariant
  /**
   * Optional override; defaults to `'button'`. The omit on the extends
   * line above narrows the inherited DOM type to keep this default
   * meaningful.
   */
  readonly type?: 'button' | 'submit' | 'reset'
}

export function Button({
  children,
  size = 'md',
  variant = 'default',
  type = 'button',
  className,
  onClick,
  ...rest
}: ButtonProps) {
  // Wrap onClick so callers can omit it (no-op default) and so we can
  // intercept in the future for analytics without forcing a re-bind on
  // every prop change. For now it's a pass-through.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
  }
  return (
    <button
      type={type}
      className={cn(
        styles.root,
        size === 'sm' && styles.sizeSm,
        size === 'md' && styles.sizeMd,
        variant === 'primary' && styles.variantPrimary,
        variant === 'danger' && styles.variantDanger,
        className,
      )}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  )
}
