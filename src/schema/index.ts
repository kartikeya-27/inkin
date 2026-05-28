/**
 * `inkin/schema` — the framework-agnostic kernel.
 *
 * Exports:
 *   - `Diagram`, `Node`, `Edge`, `Cluster`, `Flow`, `Position` — zod schemas
 *     (with `infer`-derived types of the same names)
 *   - `NodeShape`, `EdgeStyle` — enum schemas
 *   - `parse(input)` — validate + return typed Diagram; throws `InkinValidationError`
 *   - `safeParse(input)` — non-throwing variant returning a Result-style object
 *   - `layout(diagram, engine?)` — auto-position nodes via `@dagrejs/dagre` (or a custom engine)
 *   - `createDagreLayout(options)` — build a custom dagre engine with non-default options
 *   - `dagreLayout` — the default LayoutEngine instance
 *   - `LayoutEngine`, `LayoutOptions` — types for custom layout implementations
 *   - `diagramJsonSchema` — JSON Schema Draft 2020-12 export for AI tool-use
 *
 * Zero React, zero DOM, zero CSS. Safe in Node, edge runtimes, Bun, Deno, the browser.
 */

export type { DiagramJsonSchema } from './json-schema'
export { diagramJsonSchema } from './json-schema'
export type { LayoutEngine, LayoutOptions } from './layout'

export { createDagreLayout, dagreLayout, layout } from './layout'
export {
  Cluster,
  Diagram,
  Edge,
  EdgeStyle,
  Flow,
  Node,
  NodeShape,
  Position,
} from './types'
export type { ValidationIssue } from './validate'
export { InkinValidationError, parse, safeParse } from './validate'
