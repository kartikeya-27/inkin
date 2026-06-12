/**
 * Mermaid → inkin mapping tables for the 0.6.0 bridge. Phase 6.
 *
 * The single source of truth for how each Mermaid vertex shape and edge
 * style maps onto inkin's two-shape / two-style schema, and which
 * mappings are "lossy" (representable but not faithfully — the
 * `fromMermaid` converter emits one `console.warn` per lossy kind per
 * call). Mirrors the table documented in
 * `notes/mermaid-grammar-snapshot/grammar-snapshot.md` (Phase 1).
 *
 * Attribution: shape/style vocabulary from mermaid-js/mermaid HEAD
 * `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5` (MIT). Mapping decisions
 * are inkin's own.
 */

import type { EdgeStyle as InkinEdgeStyle, NodeShape as InkinNodeShape } from '../schema/types'
import type { EdgeStyle as MermaidEdgeStyle, StateType, VertexShape } from './parser/ast'

/** How a Mermaid vertex shape resolves to an inkin node shape. */
export interface ShapeMapping {
  readonly shape: InkinNodeShape
  /** `true` when the inkin shape is an approximation — the converter
   * warns once per distinct Mermaid shape that degraded this way. */
  readonly lossy: boolean
  /** Human-readable Mermaid shape name, used in the warning message. */
  readonly mermaidName: string
}

/**
 * Flowchart vertex shape → inkin node shape.
 *
 *   rect / round / diamond / hexagon / cylinder / subroutine / flag → rect
 *   circle / doublecircle / stadium                                 → terminal
 *
 * Only `rect`, `circle`, and `doublecircle` are faithful; everything
 * else degrades with a warn. (`round` and `diamond` are extremely
 * common in real Mermaid, so the warn-once-per-kind dedup matters —
 * a 40-node flowchart with 30 diamonds produces ONE warning.)
 */
export const SHAPE_MAP: Readonly<Record<VertexShape, ShapeMapping>> = {
  rect: { shape: 'rect', lossy: false, mermaidName: 'rectangle' },
  round: { shape: 'rect', lossy: true, mermaidName: 'round-rectangle `(…)`' },
  circle: { shape: 'terminal', lossy: false, mermaidName: 'circle' },
  doublecircle: { shape: 'terminal', lossy: false, mermaidName: 'double-circle' },
  diamond: { shape: 'rect', lossy: true, mermaidName: 'diamond `{…}`' },
  hexagon: { shape: 'rect', lossy: true, mermaidName: 'hexagon `{{…}}`' },
  stadium: { shape: 'terminal', lossy: true, mermaidName: 'stadium `([…])`' },
  cylinder: { shape: 'rect', lossy: true, mermaidName: 'cylinder `[(…)]`' },
  subroutine: { shape: 'rect', lossy: true, mermaidName: 'subroutine `[[…]]`' },
  flag: { shape: 'rect', lossy: true, mermaidName: 'flag `>…]`' },
}

/** How a Mermaid edge style resolves to an inkin edge style. */
export interface EdgeStyleMapping {
  readonly style: InkinEdgeStyle
  readonly lossy: boolean
  readonly mermaidName: string
}

/**
 * Flowchart edge style → inkin edge style.
 *
 *   solid   → solid   (faithful)
 *   dotted  → dashed  (faithful — inkin's `dashed` IS Mermaid's dotted)
 *   thick   → solid   (lossy — inkin has no thick-edge style)
 *   invisible → solid (lossy — inkin always renders edges)
 */
export const EDGE_STYLE_MAP: Readonly<Record<MermaidEdgeStyle, EdgeStyleMapping>> = {
  solid: { style: 'solid', lossy: false, mermaidName: 'solid' },
  dotted: { style: 'dashed', lossy: false, mermaidName: 'dotted' },
  thick: { style: 'solid', lossy: true, mermaidName: 'thick `==>`' },
  invisible: { style: 'solid', lossy: true, mermaidName: 'invisible `~~~`' },
}

/** How a state-diagram state type resolves to an inkin node shape. */
export const STATE_TYPE_MAP: Readonly<Record<StateType, ShapeMapping>> = {
  normal: { shape: 'rect', lossy: false, mermaidName: 'state' },
  // Start/end sentinels (`[*]`) render as filled circles in Mermaid;
  // inkin's terminal is the closest match and is NOT considered lossy
  // (it's the canonical mapping for state-machine endpoints).
  start: { shape: 'terminal', lossy: false, mermaidName: 'start state `[*]`' },
  end: { shape: 'terminal', lossy: false, mermaidName: 'end state `[*]`' },
  // Pseudostates render as a diamond / bar in Mermaid; inkin has no
  // dedicated shape, so they degrade to rect with a warn.
  choice: { shape: 'rect', lossy: true, mermaidName: 'choice pseudostate `<<choice>>`' },
  fork: { shape: 'rect', lossy: true, mermaidName: 'fork pseudostate `<<fork>>`' },
  join: { shape: 'rect', lossy: true, mermaidName: 'join pseudostate `<<join>>`' },
}
