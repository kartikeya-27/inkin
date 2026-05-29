/**
 * Inkin theme token contract.
 *
 * Lists every CSS custom property that the renderer's component styles consume.
 * Both `dark.css` and `light.css` MUST define every key listed here — if either
 * file omits one, the renderer falls back to the browser default (`inherit` or
 * `initial`) which may produce ugly results.
 *
 * Consumers don't import these names; they're declared here as documentation
 * and as a typed surface for future programmatic-theming APIs (planned for a
 * post-1.0 release where `theme={customTokens}` accepts a partial overrides
 * object). In `0.2.0`, `theme` is only `'dark' | 'light'` — but the token names
 * are stable forever once shipped.
 */

export type InkinThemeTokenName =
  // Canvas
  | '--inkin-bg-canvas'
  // Nodes
  | '--inkin-bg-node'
  | '--inkin-border-node'
  | '--inkin-border-node-strong'
  // Clusters
  | '--inkin-bg-cluster'
  | '--inkin-border-cluster'
  // Edges
  | '--inkin-edge-stroke'
  | '--inkin-edge-label-bg'
  | '--inkin-edge-label-text'
  // Text
  | '--inkin-text-primary'
  | '--inkin-text-secondary'
  | '--inkin-text-cluster-label'
  // Accents
  | '--inkin-accent-primary'
  | '--inkin-accent-primary-soft'
  // Shadow
  | '--inkin-shadow-node'
  // Typography
  | '--inkin-font-sans'
  | '--inkin-font-mono'
  // Sizing
  | '--inkin-node-radius'
  | '--inkin-cluster-radius'
  | '--inkin-border-width'
  | '--inkin-border-width-strong'

/** The two built-in theme names supported by the `theme` prop in `0.2.0`. */
export type InkinThemeName = 'dark' | 'light'
