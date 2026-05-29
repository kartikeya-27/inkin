/**
 * Type declaration for CSS Modules.
 *
 * Lets TypeScript resolve `import styles from './X.module.css'` as a
 * Record-like object with string class-name values. The actual hashed
 * class names are produced at build time by Rolldown's CSS Modules
 * processor — at type-check time we just treat them as opaque strings.
 *
 * Strictly-typed per-file `.d.ts` (where each known class name is its
 * own key) can be generated via `vite-plugin-css-modules-dts` if we
 * want IDE autocomplete on class names. Deferred to a future minor —
 * Record<string, string> is adequate for 0.2.0.
 */

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
