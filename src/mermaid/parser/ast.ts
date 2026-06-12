/**
 * AST type definitions for `@inkin/core@0.6.0`'s Mermaid bridge.
 *
 * Phase 3 of the 0.6.0 plan introduces the flowchart parser, which
 * populates `FlowchartAst`. Phase 5 adds the state-diagram parser,
 * which populates `StateDiagramAst`. Phase 4 fills in `SubgraphStatement`
 * (declared here as a forward type so Phase 3 can emit
 * `kind: 'unsupported'` issues that name it accurately).
 *
 * Position tracking flows through every node so error messages in
 * `fromMermaid` can be field-path-precise. `Position.line` and
 * `Position.column` are 1-based (same convention as the tokenizer).
 *
 * Attribution: AST shape inspired by Mermaid's own
 * `packages/mermaid/src/diagrams/flowchart/flowDb.ts` data model
 * (mermaid-js/mermaid HEAD `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`,
 * MIT). Names and structure are original to inkin.
 */

/** 1-based source position. */
export interface Position {
  readonly line: number
  readonly column: number
}

/** Top-level AST union — one of two diagram kinds the bridge supports. */
export type MermaidAst = FlowchartAst | StateDiagramAst

// ============================================================================
// Flowchart AST
// ============================================================================

export interface FlowchartAst {
  readonly kind: 'flowchart'
  /** Direction header value. Defaults to `'TB'` if the header omits
   * one. Mermaid's `TD` is normalized to `TB` (same semantic). */
  readonly direction: FlowchartDirection
  readonly statements: readonly FlowchartStatement[]
  /** Position of the `flowchart` / `graph` keyword. */
  readonly position: Position
}

export type FlowchartDirection = 'TB' | 'BT' | 'LR' | 'RL'

export type FlowchartStatement = VertexStatement | EdgeStatement | SubgraphStatement

/** A vertex (node) declaration. Mermaid syntax `A`, `A[label]`,
 * `A(label)`, `A{label}`, etc. each produce one of these. */
export interface VertexStatement {
  readonly kind: 'vertex'
  /** Mermaid node id (a/b/c/browser/api/...). */
  readonly id: string
  /** Visual shape inferred from the bracket pair. */
  readonly shape: VertexShape
  /** Explicit label text inside the brackets. `undefined` means the
   * Mermaid source had no bracketed shape — the vertex is a bare `A`,
   * and the consumer should use the id as the display label. */
  readonly label?: string
  readonly position: Position
}

/**
 * Visual shape recognized in the Mermaid source. The `fromMermaid`
 * converter maps each of these to an inkin `Node.shape` value (`rect`
 * or `terminal`), emitting a one-time `console.warn` for the lossy
 * mappings per the Phase 1 spec.
 */
export type VertexShape =
  | 'rect' //          [label]              — inkin rect
  | 'round' //         (label)              — inkin rect (lossy + warn)
  | 'circle' //        ((label))            — inkin terminal
  | 'doublecircle' //  (((label)))          — inkin terminal
  | 'diamond' //       {label}              — inkin rect (lossy + warn)
  | 'hexagon' //       {{label}}            — inkin rect (lossy + warn)
  | 'stadium' //       ([label])            — inkin terminal (lossy + warn)
  | 'cylinder' //      [(label)]            — inkin rect (lossy + warn)
  | 'subroutine' //    [[label]]            — inkin rect (lossy + warn)
  | 'flag' //          >label]              — inkin rect (lossy + warn)

/** An edge between two vertices. `from` and `to` reference vertex ids;
 * the converter resolves them at `fromMermaid` time. */
export interface EdgeStatement {
  readonly kind: 'edge'
  readonly from: string
  readonly to: string
  readonly style: EdgeStyle
  /**
   * `true` for Mermaid's arrow variants (`-->`, `==>`, `-.->`).
   * `false` for line variants (`---`, `===`, `-.-`, `~~~`).
   * `false` is "lossy" in inkin since inkin always renders arrows —
   * the converter emits a one-time warn per `fromMermaid` call.
   */
  readonly hasArrow: boolean
  readonly label?: string
  readonly position: Position
}

/** Edge visual style. Inkin's two-style schema (`solid`/`dashed`) is a
 * proper subset; the converter maps `thick` → `solid` and `invisible`
 * → `solid` with warns per Phase 1. */
export type EdgeStyle = 'solid' | 'dotted' | 'thick' | 'invisible'

/**
 * Subgraph (cluster) declaration. Placeholder in Phase 3 — the
 * flowchart parser emits a `kind: 'unsupported'` issue when it sees
 * `KW_SUBGRAPH`, naming this AST node type in the error message so the
 * Phase 4 implementation has a stable contract to fill in. The fields
 * shown here are what Phase 4 will populate.
 */
export interface SubgraphStatement {
  readonly kind: 'subgraph'
  readonly id: string
  readonly label?: string
  /** Subgraph-local direction override. `undefined` inherits the
   * parent flowchart's direction. */
  readonly direction?: FlowchartDirection
  readonly statements: readonly FlowchartStatement[]
  readonly position: Position
}

// ============================================================================
// State-diagram AST (Phase 5 — declared as a stub here for the
// FromMermaid union to type-check correctly)
// ============================================================================

export interface StateDiagramAst {
  readonly kind: 'stateDiagram'
  readonly direction: FlowchartDirection
  readonly statements: readonly StateStatement[]
  readonly position: Position
}

/** State-diagram statement union (Phase 5). */
export type StateStatement = StateDecl | StateTransition | StateCompound

/** A pseudostate marker recognized in the source. `'normal'` is a plain
 * state; the rest are Mermaid pseudostate forms the converter maps to
 * `rect` with a warn (`choice`/`fork`/`join`) or to a reserved
 * terminal sentinel (`start`/`end`, from `[*]`). */
export type StateType = 'normal' | 'choice' | 'fork' | 'join' | 'start' | 'end'

export interface StateDecl {
  readonly kind: 'state'
  readonly id: string
  readonly label?: string
  readonly type: StateType
  readonly position: Position
}

export interface StateTransition {
  readonly kind: 'transition'
  /** Either a state id or the literal `'__start__'` / `'__end__'`
   * sentinel (Mermaid's `[*]`). */
  readonly from: string
  readonly to: string
  readonly description?: string
  readonly position: Position
}

/**
 * A compound state: `state X { ... }`. Maps to an inkin cluster with
 * the inner statements as its children. Mermaid allows nesting; like
 * subgraphs (Phase 4), the parser flattens nested compound states into
 * the outermost cluster with one `unsupported` warn per nesting level.
 * The `--` concurrency divider inside a compound body emits an
 * `unsupported` warn and is treated as a plain separator.
 */
export interface StateCompound {
  readonly kind: 'compound'
  readonly id: string
  readonly label?: string
  readonly statements: readonly StateStatement[]
  readonly position: Position
}

// ============================================================================
// Parse result types — shared by all parsers and by `fromMermaid`
// ============================================================================

export type ParseResult<T> = ParseSuccess<T> | ParseFailure

/**
 * A successful parse. `value` is the built AST. `warnings` carries every
 * `unsupported` issue the parser collected — features that are
 * well-formed Mermaid but outside inkin's documented subset, which the
 * parser dropped or degraded rather than failed on (the "best-effort
 * import" contract). `warnings` is empty for a fully-in-scope source.
 */
export interface ParseSuccess<T> {
  readonly ok: true
  readonly value: T
  readonly warnings: readonly ParseIssue[]
}

/**
 * A failed parse. At least one `syntax` issue occurred — the input is
 * malformed (missing header, unmatched bracket, stray `end`, etc.) and
 * the parser couldn't trust the structure it built. `issues` carries
 * every collected issue (both `syntax` and any `unsupported`) so a
 * consumer sees the complete picture.
 */
export interface ParseFailure {
  readonly ok: false
  readonly issues: readonly ParseIssue[]
}

export interface ParseIssue {
  readonly message: string
  /**
   * `'syntax'`: malformed Mermaid input (unmatched brackets, missing
   * tokens, etc.) — causes the parse to fail.
   * `'unsupported'`: well-formed Mermaid input that uses a feature
   * outside the inkin bridge's documented subset (per Phase 1's spec)
   * — dropped or degraded with a warning; the parse still succeeds.
   * This split is what powers the best-effort import path:
   * `unsupported` becomes a `console.warn` in `fromMermaid` while
   * `syntax` halts with `{ ok: false }`.
   */
  readonly kind: 'syntax' | 'unsupported'
  readonly position: Position
}
