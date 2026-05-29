/**
 * `src/renderer/themes` — theme tokens and CSS bundles.
 *
 * Public exports from this barrel are TS types only; the actual CSS is loaded
 * via `import '@inkin/core/styles.css'` (consumer-side) — the published bundle
 * concatenates `themes/dark.css` + `themes/light.css` along with xyflow's CSS.
 *
 * Adding a new theme token: declare it in `tokens.ts`, then assign a value in
 * both `dark.css` and `light.css` (every consumer-overridable token MUST have
 * defaults in both themes).
 */

export type { InkinThemeName, InkinThemeTokenName } from './tokens'
