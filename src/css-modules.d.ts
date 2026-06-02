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

/**
 * Plain `*.css` side-effect imports — no exports, just inclusion in the
 * dependency graph (e.g. `import './renderer/styles.css'` in `src/index.ts`
 * which pulls the consolidated stylesheet into Rolldown's CSS extraction
 * pass).
 *
 * TypeScript 5.x tolerates this without an ambient declaration; TS 6
 * tightened TS2882 ("Cannot find module or type declarations for
 * side-effect import") and requires the declaration even though nothing
 * is imported. Declaring it preemptively so the TypeScript 6 upgrade
 * (currently ignored in `.github/dependabot.yml`) lands without a
 * library-side patch.
 */
declare module '*.css'
