/**
 * Inspector-internal helpers shared by NodeFields / EdgeFields / ClusterFields.
 * Not exported from `src/renderer/inspector/index.ts`.
 */

/**
 * For multi-select forms, compute whether every selected entity has the
 * same value for a field. When they match, return that value. When they
 * differ, return an empty string with `hasMixed: true` — the caller renders
 * the input empty with a `multiple values` placeholder.
 *
 * `undefined` and missing fields are normalised to `''` so a node with no
 * `sublabel` and a node with `sublabel: ''` are treated as "the same".
 */
export interface SharedValue {
  readonly value: string
  readonly hasMixed: boolean
}

export function sharedValue<T>(
  items: readonly T[],
  getter: (item: T) => string | undefined,
): SharedValue {
  if (items.length === 0) return { value: '', hasMixed: false }
  const first = getter(items[0] as T) ?? ''
  for (let i = 1; i < items.length; i += 1) {
    const current = getter(items[i] as T) ?? ''
    if (current !== first) return { value: '', hasMixed: true }
  }
  return { value: first, hasMixed: false }
}
