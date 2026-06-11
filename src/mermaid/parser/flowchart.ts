/**
 * Recursive-descent parser for the Mermaid `flowchart` (and legacy
 * `graph`) grammar. Phase 3 of the 0.6.0 plan.
 *
 * Builds a {@link FlowchartAst} from a {@link Tokenizer} positioned at
 * the start of the source. Subgraphs are recognized but currently emit
 * an `unsupported` issue with the position of the `subgraph` keyword —
 * Phase 4 replaces the stub. Out-of-scope statements (`classDef`,
 * `class`, `style`, `linkStyle`, `interpolate`, `click`, `href`,
 * accessibility annotations) emit `unsupported` issues per Phase 1's
 * documented subset.
 *
 * Edge chaining (`A --> B --> C`) is supported: each link in the chain
 * produces an `EdgeStatement` and each unique vertex form produces a
 * `VertexStatement`. Bare vertex references inside a chain (`A` with
 * no shape) still produce a `VertexStatement` so the converter
 * (Phase 6) can build a node-id index without having to re-resolve.
 *
 * Attribution: parser logic derived from the syntactic spec in
 * `notes/mermaid-grammar-snapshot/flow.jison` (mermaid-js/mermaid HEAD
 * `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`, MIT). All code is
 * original to inkin.
 */

import type {
  EdgeStatement,
  EdgeStyle,
  FlowchartAst,
  FlowchartDirection,
  FlowchartStatement,
  ParseIssue,
  ParseResult,
  Position,
  VertexShape,
  VertexStatement,
} from './ast'
import type { Token, Tokenizer, TokenKind } from './tokenizer'

const VALID_DIRECTIONS: ReadonlySet<string> = new Set(['TB', 'BT', 'LR', 'RL', 'TD'])

/** Mermaid opening-bracket token kinds → the close marker the parser
 * passes to `readUntilMarker` to consume the label text, plus the
 * inferred {@link VertexShape}. */
const SHAPE_BRACKETS: ReadonlyMap<TokenKind, { close: string; shape: VertexShape }> = new Map([
  ['LBRACKET', { close: ']', shape: 'rect' }],
  ['LPAREN', { close: ')', shape: 'round' }],
  ['LBRACE', { close: '}', shape: 'diamond' }],
  ['L_DBL_PAREN', { close: '))', shape: 'circle' }],
  ['L_TRIPLE_PAREN', { close: ')))', shape: 'doublecircle' }],
  ['L_DBL_BRACE', { close: '}}', shape: 'hexagon' }],
  ['L_DBL_BRACKET', { close: ']]', shape: 'subroutine' }],
  ['L_STADIUM', { close: '])', shape: 'stadium' }],
  ['L_CYLINDER', { close: ')]', shape: 'cylinder' }],
] as Array<[TokenKind, { close: string; shape: VertexShape }]>)

/** The matching close-bracket token kind for each opening kind. The
 * parser uses this to validate that the label was actually terminated
 * by the right close marker (defensive against malformed input). */
const CLOSE_KINDS: ReadonlyMap<TokenKind, TokenKind> = new Map([
  ['LBRACKET', 'RBRACKET'],
  ['LPAREN', 'RPAREN'],
  ['LBRACE', 'RBRACE'],
  ['L_DBL_PAREN', 'R_DBL_PAREN'],
  ['L_TRIPLE_PAREN', 'R_TRIPLE_PAREN'],
  ['L_DBL_BRACE', 'R_DBL_BRACE'],
  ['L_DBL_BRACKET', 'R_DBL_BRACKET'],
  ['L_STADIUM', 'R_STADIUM'],
  ['L_CYLINDER', 'R_CYLINDER'],
] as Array<[TokenKind, TokenKind]>)

/** Token kinds the parser recognizes as edge operators with a direction
 * (arrow present). */
const ARROW_EDGES: ReadonlyMap<TokenKind, EdgeStyle> = new Map([
  ['EDGE_ARROW', 'solid'],
  ['EDGE_DOTTED_ARROW', 'dotted'],
  ['EDGE_THICK_ARROW', 'thick'],
] as Array<[TokenKind, EdgeStyle]>)

/** Token kinds the parser recognizes as edge operators WITHOUT a
 * direction (no arrow). Inkin always renders arrows, so the converter
 * (Phase 6) emits a `console.warn` when it sees `hasArrow: false`. */
const LINE_EDGES: ReadonlyMap<TokenKind, EdgeStyle> = new Map([
  ['EDGE_LINE', 'solid'],
  ['EDGE_DOTTED_LINE', 'dotted'],
  ['EDGE_THICK_LINE', 'thick'],
  ['EDGE_INVISIBLE', 'invisible'],
] as Array<[TokenKind, EdgeStyle]>)

/** Token kinds the parser recognizes as the start of a mid-edge
 * label (e.g. `A -- foo --> B`). The value is the set of closing-edge
 * markers the parser passes to `readUntilMarker` to consume the label,
 * paired with the resolved {@link EdgeStyle} for each closer.
 *
 * Mermaid accepts multiple closer forms for the dotted family
 * (`-. text .-> B` AND `-. text -.-> B` are both valid), so the
 * closers list includes both the "short" form (without leading dash)
 * and the "long" form (with leading dash). */
const EDGE_STARTS: ReadonlyMap<TokenKind, { closers: readonly string[]; style: EdgeStyle }> =
  new Map([
    ['EDGE_START', { closers: ['-->', '---'], style: 'solid' }],
    ['EDGE_START_DOTTED', { closers: ['-.->', '-.-', '.->', '.-'], style: 'dotted' }],
    ['EDGE_START_THICK', { closers: ['==>', '==='], style: 'thick' }],
  ] as Array<[TokenKind, { closers: readonly string[]; style: EdgeStyle }]>)

/** Out-of-scope keyword token kinds that map to a user-facing message
 * naming the feature. The parser turns each into an `unsupported`
 * issue. Mirrors the Phase 1 snapshot's "rejected as unsupported" list. */
const UNSUPPORTED_KEYWORDS: ReadonlyMap<TokenKind, string> = new Map<TokenKind, string>([
  ['KW_CLICK', 'click handlers'],
  ['KW_HREF', 'href interactivity'],
  ['KW_STYLE', 'inline style directives'],
  ['KW_LINKSTYLE', 'linkStyle directives'],
  ['KW_CLASSDEF', 'classDef declarations'],
  ['KW_CLASS', 'class assignments'],
  ['KW_INTERPOLATE', 'interpolate directives'],
  ['KW_ACC_TITLE', 'accessibility annotations'],
  ['KW_ACC_DESCR', 'accessibility annotations'],
])

/**
 * Parse a Mermaid flowchart source into a {@link FlowchartAst}. The
 * tokenizer should be positioned at the start of the source (the
 * parser consumes the `flowchart` / `graph` header keyword itself).
 *
 * On success returns `{ ok: true, value: ast }`. On failure returns
 * `{ ok: false, issues: [...] }` — `issues` is non-empty and contains
 * every problem the parser collected, not just the first one (so AI
 * agents can self-correct multiple errors per round).
 */
export function parseFlowchart(tokenizer: Tokenizer): ParseResult<FlowchartAst> {
  const parser = new FlowchartParser(tokenizer)
  return parser.parse()
}

class FlowchartParser {
  private readonly t: Tokenizer
  private readonly issues: ParseIssue[] = []
  /** Cached so we can emit a meaningful AST position even after the
   * header has been consumed. */
  private headerPosition: Position = { line: 1, column: 1 }
  private direction: FlowchartDirection = 'TB'

  constructor(tokenizer: Tokenizer) {
    this.t = tokenizer
  }

  parse(): ParseResult<FlowchartAst> {
    this.skipBlanks()
    const header = this.t.next()
    if (header.kind !== 'KW_FLOWCHART') {
      this.recordSyntax(
        `Expected \`flowchart\` or \`graph\` header at the start of the diagram, got \`${header.value}\``,
        header,
      )
      return { ok: false, issues: this.issues }
    }
    this.headerPosition = { line: header.line, column: header.column }
    this.parseOptionalDirection()
    this.expectStatementSeparator()

    const statements: FlowchartStatement[] = []
    while (this.t.peek().kind !== 'EOF') {
      this.skipBlanks()
      if (this.t.peek().kind === 'EOF') break
      const parsed = this.parseStatement()
      if (parsed === null) {
        // Issue already recorded — advance one token to avoid an
        // infinite loop on malformed input.
        if (this.t.peek().kind !== 'EOF') this.t.next()
      } else {
        for (const stmt of parsed) statements.push(stmt)
      }
    }

    if (this.issues.length > 0) {
      return { ok: false, issues: this.issues }
    }
    return {
      ok: true,
      value: {
        kind: 'flowchart',
        direction: this.direction,
        statements,
        position: this.headerPosition,
      },
    }
  }

  /** Parse the direction value after the `flowchart` / `graph`
   * keyword. If the next token isn't a recognized direction the parser
   * leaves it for `expectStatementSeparator` / statement parsing —
   * Mermaid grammar allows `flowchart\nA --> B` (no direction). */
  private parseOptionalDirection(): void {
    const peek = this.t.peek()
    if (peek.kind === 'DIR_VALUE' && VALID_DIRECTIONS.has(peek.value)) {
      this.t.next()
      // Normalize TD → TB (same semantic; Mermaid treats them as aliases).
      const value = peek.value === 'TD' ? 'TB' : (peek.value as FlowchartDirection)
      this.direction = value
    }
  }

  /** Consume a statement separator (NEWLINE or SEMI). Tolerates EOF
   * silently — the header may be the last thing in the input. */
  private expectStatementSeparator(): void {
    const next = this.t.peek()
    if (next.kind === 'NEWLINE' || next.kind === 'SEMI') {
      this.t.next()
      return
    }
    if (next.kind === 'EOF') return
    this.recordSyntax(
      `Expected newline or \`;\` after the diagram header, got \`${next.value}\``,
      next,
    )
  }

  /** Skip any combination of blank-equivalent tokens (NEWLINE, SEMI,
   * COMMENT) at the current position. */
  private skipBlanks(): void {
    while (true) {
      const k = this.t.peek().kind
      if (k === 'NEWLINE' || k === 'SEMI' || k === 'COMMENT') {
        this.t.next()
      } else {
        return
      }
    }
  }

  /**
   * Parse a single statement starting at the current token. Returns
   * `null` if the parser couldn't make progress (an `unsupported` /
   * `syntax` issue was already recorded). Returns an array because a
   * chained edge (`A --> B --> C`) produces multiple statements from
   * one "syntactic statement" in the grammar.
   */
  private parseStatement(): FlowchartStatement[] | null {
    const tok = this.t.peek()

    // Out-of-scope keywords — record + skip the rest of the line.
    const unsupportedReason = UNSUPPORTED_KEYWORDS.get(tok.kind)
    if (unsupportedReason !== undefined) {
      this.recordUnsupported(
        `\`${tok.value}\` (${unsupportedReason}) isn't supported by the inkin Mermaid bridge. See the README's "Supported Mermaid syntax" section.`,
        tok,
      )
      this.skipToEndOfStatement()
      return []
    }

    // Subgraph placeholder — Phase 4 replaces this.
    if (tok.kind === 'KW_SUBGRAPH') {
      this.recordUnsupported(
        "subgraphs (`subgraph` / `end`) aren't supported by the inkin Mermaid bridge yet — Phase 4 of the 0.6.0 implementation. Track via the `SubgraphStatement` AST node.",
        tok,
      )
      this.skipToEndOfStatement()
      return []
    }

    // Statements start with a vertex id (IDENT or NUM-as-id).
    if (tok.kind === 'IDENT' || tok.kind === 'NUM' || tok.kind === 'DIR_VALUE') {
      return this.parseVertexOrChain()
    }

    // `direction X` at top-level (not inside a subgraph) is invalid;
    // grammar reserves it for subgraph bodies.
    if (tok.kind === 'KW_DIRECTION') {
      this.recordSyntax('`direction` is only valid inside a `subgraph ... end` block', tok)
      this.skipToEndOfStatement()
      return []
    }

    this.recordSyntax(`Unexpected token \`${tok.value}\` at start of statement`, tok)
    return null
  }

  /**
   * Parse a single vertex declaration, OR a chain like `A --> B[label]
   * --> C`. Returns the vertex statements followed by the edge
   * statements, in declaration order — the converter preserves order
   * when populating the inkin `Diagram` so the resulting layout matches
   * what the user wrote.
   */
  private parseVertexOrChain(): FlowchartStatement[] {
    const out: FlowchartStatement[] = []
    let prev = this.parseSingleVertex()
    out.push(prev)

    while (true) {
      const peek = this.t.peek()
      const arrowStyle = ARROW_EDGES.get(peek.kind)
      const lineStyle = LINE_EDGES.get(peek.kind)
      const edgeStart = EDGE_STARTS.get(peek.kind)

      if (arrowStyle !== undefined) {
        // Plain arrow edge, optionally followed by `|label|`.
        const tok = this.t.next()
        const pipeLabel = this.parseOptionalPipeLabel()
        const next = this.parseSingleVertex()
        out.push(next)
        const edge: EdgeStatement = {
          kind: 'edge',
          from: prev.id,
          to: next.id,
          style: arrowStyle,
          hasArrow: true,
          ...(pipeLabel !== undefined && { label: pipeLabel }),
          position: { line: tok.line, column: tok.column },
        }
        out.push(edge)
        prev = next
        continue
      }

      if (lineStyle !== undefined) {
        const tok = this.t.next()
        const pipeLabel = this.parseOptionalPipeLabel()
        const next = this.parseSingleVertex()
        out.push(next)
        const edge: EdgeStatement = {
          kind: 'edge',
          from: prev.id,
          to: next.id,
          style: lineStyle,
          hasArrow: false,
          ...(pipeLabel !== undefined && { label: pipeLabel }),
          position: { line: tok.line, column: tok.column },
        }
        out.push(edge)
        prev = next
        continue
      }

      if (edgeStart !== undefined) {
        // Mid-edge label form: A -- text --> B. The parser consumes
        // the START token, then asks the tokenizer to read raw text
        // until one of the closers; the closer is then re-tokenized
        // for the parser to consume normally.
        const startTok = this.t.next()
        const labelRead = this.t.readUntilMarker(edgeStart.closers)
        if (labelRead === null) {
          this.recordSyntax(
            `Mid-edge label opened with \`${startTok.value}\` was never closed`,
            startTok,
          )
          return out
        }
        const closer = this.t.next()
        const hasArrow = closer.value.endsWith('>')
        const next = this.parseSingleVertex()
        out.push(next)
        const edge: EdgeStatement = {
          kind: 'edge',
          from: prev.id,
          to: next.id,
          style: edgeStart.style,
          hasArrow,
          ...(labelRead.text.length > 0 && { label: labelRead.text }),
          position: { line: startTok.line, column: startTok.column },
        }
        out.push(edge)
        prev = next
        continue
      }

      // Anything else terminates the chain.
      return out
    }
  }

  /**
   * If the current position is a `|`, consume `|...|` and return the
   * inner label text. Returns `undefined` if there's no pipe label
   * here (the chain continues with the next vertex). Used after
   * consuming an edge operator to attach the optional Mermaid
   * `A -->|text| B` form to the edge.
   */
  private parseOptionalPipeLabel(): string | undefined {
    if (this.t.peek().kind !== 'PIPE') return undefined
    const openTok = this.t.next() // consume opening PIPE
    const r = this.t.readUntilMarker(['|'])
    if (r === null) {
      this.recordSyntax('Pipe-style edge label was never closed', openTok)
      return undefined
    }
    this.t.next() // consume closing PIPE
    return r.text.length > 0 ? r.text : undefined
  }

  /**
   * Parse one vertex: `A`, `A[label]`, `A(label)`, `A((label))`, etc.
   * Returns a {@link VertexStatement}. On `>label]` (asymmetric/flag),
   * this method consumes the leading `>` from the previous IDENT's
   * adjacency check — handled separately because `>` isn't an
   * opening-bracket token.
   */
  private parseSingleVertex(): VertexStatement {
    this.skipBlanks()
    const idTok = this.t.next()
    if (idTok.kind !== 'IDENT' && idTok.kind !== 'NUM' && idTok.kind !== 'DIR_VALUE') {
      this.recordSyntax(`Expected vertex id, got \`${idTok.value}\``, idTok)
      // Best-effort recovery — produce a synthetic vertex so the
      // surrounding chain logic can continue.
      return {
        kind: 'vertex',
        id: idTok.value || '__error__',
        shape: 'rect',
        position: { line: idTok.line, column: idTok.column },
      }
    }
    const id = idTok.value
    const peek = this.t.peek()
    const bracket = SHAPE_BRACKETS.get(peek.kind)
    if (bracket !== undefined) {
      this.t.next() // consume open bracket
      const labelRead = this.t.readUntilMarker([bracket.close])
      if (labelRead === null) {
        this.recordSyntax(
          `Vertex label opened with \`${peek.value}\` was never closed by \`${bracket.close}\``,
          peek,
        )
        return {
          kind: 'vertex',
          id,
          shape: bracket.shape,
          position: { line: idTok.line, column: idTok.column },
        }
      }
      const closeTok = this.t.next()
      const expectedKind = CLOSE_KINDS.get(peek.kind)
      if (expectedKind !== undefined && closeTok.kind !== expectedKind) {
        this.recordSyntax(
          `Mismatched bracket — expected \`${bracket.close}\` to close \`${peek.value}\`, got \`${closeTok.value}\``,
          closeTok,
        )
      }
      return {
        kind: 'vertex',
        id,
        shape: bracket.shape,
        ...(labelRead.text.length > 0 && { label: labelRead.text }),
        position: { line: idTok.line, column: idTok.column },
      }
    }

    // Trapezoid family (`[/text\]`, `[\text/]`, etc.) and ellipse
    // (`(-text-)`) are out of scope per Phase 1's surgical scope cap.
    // The opener tokens are emitted by the lexer; we record an
    // `unsupported` issue and skip.
    if (peek.kind === 'L_TRAP_F' || peek.kind === 'L_TRAP_B' || peek.kind === 'L_ELLIPSE') {
      const shapeName =
        peek.kind === 'L_ELLIPSE' ? 'ellipse `(-...-)`' : `trapezoid \`${peek.value}...\``
      this.recordUnsupported(
        `${shapeName} isn't supported by the inkin Mermaid bridge. See the README's "Supported Mermaid syntax" section for the full list.`,
        peek,
      )
      this.skipToEndOfStatement()
      return {
        kind: 'vertex',
        id,
        shape: 'rect',
        position: { line: idTok.line, column: idTok.column },
      }
    }

    // Asymmetric/flag shape: `>label]`.
    if (peek.kind === 'FLAG_END') {
      this.t.next() // consume `>`
      const labelRead = this.t.readUntilMarker([']'])
      if (labelRead === null) {
        this.recordSyntax('Flag-shape vertex `>...]` was never closed by `]`', peek)
        return {
          kind: 'vertex',
          id,
          shape: 'flag',
          position: { line: idTok.line, column: idTok.column },
        }
      }
      this.t.next() // consume RBRACKET
      return {
        kind: 'vertex',
        id,
        shape: 'flag',
        ...(labelRead.text.length > 0 && { label: labelRead.text }),
        position: { line: idTok.line, column: idTok.column },
      }
    }

    // No shape brackets — bare vertex reference.
    return {
      kind: 'vertex',
      id,
      shape: 'rect',
      position: { line: idTok.line, column: idTok.column },
    }
  }

  /** Advance until the next statement separator or EOF. Used after an
   * `unsupported` / `syntax` issue to keep parsing the rest of the
   * input productively. */
  private skipToEndOfStatement(): void {
    while (true) {
      const k = this.t.peek().kind
      if (k === 'NEWLINE' || k === 'SEMI' || k === 'EOF') return
      this.t.next()
    }
  }

  private recordSyntax(message: string, atToken: Token): void {
    this.issues.push({
      kind: 'syntax',
      message,
      position: { line: atToken.line, column: atToken.column },
    })
  }

  private recordUnsupported(message: string, atToken: Token): void {
    this.issues.push({
      kind: 'unsupported',
      message,
      position: { line: atToken.line, column: atToken.column },
    })
  }
}
