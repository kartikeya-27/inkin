'use client'

// Side-effect CSS import — pulls the consolidated stylesheet (xyflow + theme
// tokens) into the JS dependency graph. Lightning CSS (via `@tsdown/css`)
// inlines the `@import` chain, and Rolldown emits the result as
// `dist/styles.css` together with every `*.module.css` reached through the
// renderer tree. Consumers load it explicitly via `import '@inkin/core/styles.css'`;
// bundlers that auto-extract CSS from JS dep graphs (Vite, Next.js App Router)
// also get it transitively.
//
// Why the import lives here instead of a CSS entry point: Rolldown 1.0
// dropped CSS-as-entry support (rolldown#4271). Routing all CSS through the
// JS graph is the only path that yields a single bundled stylesheet.
import './renderer/styles.css'

/**
 * `@inkin/core` main entry — the React surface.
 *
 * Direct from this module:
 *   - `DiagramStudio` — the drop-in React component
 *   - `DiagramStudioProps`, `DiagramStudioRef` — its prop and ref types
 *   - `toSvg`, `ToSvgOptions` — imperative SVG export helper
 *   - `InkinThemeName` — `'dark' | 'light'`
 *
 * Convenience re-exports from the schema kernel (so consumers don't need a
 * second import for the common case of "render a Diagram"):
 *   - `Diagram` (zod schema + inferred type)
 *   - `parse`, `safeParse`, `InkinValidationError`, `ValidationIssue`
 *
 * Less-common schema exports (layout engine, JSON Schema, individual
 * Node/Edge/Cluster/Flow zod schemas) remain available via the dedicated
 * `@inkin/core/schema` subpath — keeping this entry's surface focused on
 * the React-component use case.
 *
 * `'use client'` directive at the top: required so Next.js App Router and
 * other React Server Components compilers treat imports from this module
 * as client-side. The directive also lives on DiagramStudio.tsx itself
 * (belt and braces — bundlers should propagate it through re-exports, but
 * declaring it on the entry too is the safest contract).
 */

export type {
  DiagramStudioProps,
  DiagramStudioRef,
} from './renderer/DiagramStudio'
export { DiagramStudio } from './renderer/DiagramStudio'
export type { ToSvgOptions } from './renderer/export'
export { toSvg } from './renderer/export'

export type { InkinThemeName } from './renderer/themes'
export type { Diagram as DiagramType, DiagramInput } from './schema/types'
// Convenience re-exports from the schema kernel.
export { Diagram } from './schema/types'
export type { ValidationIssue } from './schema/validate'
export { InkinValidationError, parse, safeParse } from './schema/validate'
