/**
 * `@inkin/core/mermaid` — the Mermaid bidirectional bridge. New in
 * 0.6.0.
 *
 * Two pure functions convert between Mermaid `flowchart` / `graph` /
 * `stateDiagram[-v2]` source and inkin's `Diagram`:
 *
 *   import { fromMermaid, toMermaid } from '@inkin/core/mermaid'
 *
 *   const result = fromMermaid('flowchart\nA[Start] --> B((End))')
 *   if (result.ok) {
 *     // result.diagram is a validated inkin Diagram
 *     const text = toMermaid(result.diagram) // back to Mermaid source
 *   }
 *
 * `fromMermaid` is a BEST-EFFORT import: well-formed Mermaid that uses a
 * feature outside inkin's documented subset (styling, click handlers,
 * notes, exotic shapes, nested clusters) is dropped or degraded with a
 * `console.warn` rather than failing — only malformed input returns
 * `{ ok: false, issues }`. See the README's "Supported Mermaid syntax"
 * section for the full subset.
 *
 * This subpath is framework-agnostic — it imports `safeParse` from the
 * schema kernel but no React / xyflow / DOM / CSS. Safe in Node, edge
 * runtimes, Bun, Deno, and the browser. Consumers who don't import
 * `@inkin/core/mermaid` pay zero bytes for it.
 *
 * ---------------------------------------------------------------------------
 * Attribution: the Mermaid grammar (`flowchart` + `stateDiagram`) is
 * used as the syntactic spec for the hand-rolled parser, and the
 * round-trip test corpus is adapted from Mermaid's own parser test
 * fixtures. Source: mermaid-js/mermaid HEAD
 * `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`, MIT-licensed (© 2015
 * Knut Sveidqvist and Mermaid contributors). The parser, converter, and
 * emitter implementations are original to inkin.
 * ---------------------------------------------------------------------------
 */

export { type FromMermaidResult, fromMermaid } from './from-mermaid'
export type { ParseIssue } from './parser/ast'
export { type ToMermaidOptions, toMermaid } from './to-mermaid'
