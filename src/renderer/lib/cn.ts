/**
 * Compose class names, filtering out falsy values (undefined, null, false, '').
 *
 * Why this exists: with `noUncheckedIndexedAccess: true` in tsconfig.json,
 * CSS Module class accesses (`styles.root`) are typed as `string | undefined`.
 * Inlining the falsy-filter in every JSX expression (`${styles.root ?? ''}`)
 * is noisy; this helper makes the call sites read cleanly:
 *
 *   <div className={cn(styles.root, className, isActive && styles.active)} />
 *
 * Equivalent to a minimal subset of the `clsx` package (~5 LOC). If we ever
 * need object-form or array-form composition, swap to `clsx` then.
 */
export function cn(...classes: readonly (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
