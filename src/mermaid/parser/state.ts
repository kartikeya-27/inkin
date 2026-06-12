/**
 * Recursive-descent parser for the Mermaid `stateDiagram` /
 * `stateDiagram-v2` grammar. Phase 5 of the 0.6.0 plan.
 *
 * Builds a {@link StateDiagramAst} from a {@link Tokenizer} positioned
 * at the start of the source. Reuses the tokenizer + AST helpers from
 * Phases 2-4. The in-scope surface (per the Phase 1 snapshot):
 *
 *   stateDiagram / stateDiagram-v2 header
 *   [*]                                 start / end sentinel
 *   state X                             simple state
 *   state "Friendly name" as X          labeled state
 *   state X { ... }                     compound state (→ cluster)
 *   state X <<choice>>|<<fork>>|<<join>>  pseudostate (rect + warn)
 *   X : description                      state description (sets label)
 *   A --> B                             transition
 *   A --> B : event                     transition with event label
 *   [*] --> A   /   A --> [*]            entry / exit transition
 *   direction LR|RL|TB|BT               layout direction
 *
 * Out of scope, emitted as `unsupported` issues (per Phase 1):
 *   note left of X : ... / note right of X : ...
 *   -- (concurrency divider inside a compound body)
 *   nested compound states (flattened, one warn per level)
 *   classDef / class / style / click / href
 *
 * Attribution: parser logic derived from the syntactic spec in
 * `notes/mermaid-grammar-snapshot/stateDiagram.jison`
 * (mermaid-js/mermaid HEAD `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`,
 * MIT). All code is original to inkin.
 */

import type {
  FlowchartDirection,
  ParseIssue,
  ParseResult,
  Position,
  StateCompound,
  StateDecl,
  StateDiagramAst,
  StateStatement,
  StateTransition,
  StateType,
} from './ast'
import type { Token, Tokenizer, TokenKind } from './tokenizer'

const VALID_DIRECTIONS: ReadonlySet<string> = new Set(['TB', 'BT', 'LR', 'RL', 'TD'])

/** Reserved sentinel ids for Mermaid's `[*]` start/end markers. inkin
 * prefixes them so a user-defined state can never collide. */
const START_SENTINEL = '__start__'
const END_SENTINEL = '__end__'

/** `<<...>>` pseudostate keyword → {@link StateType}. Anything else
 * inside `<<>>` is treated as `normal` with a warn. */
const PSEUDO_TYPES: ReadonlyMap<string, StateType> = new Map<string, StateType>([
  ['choice', 'choice'],
  ['fork', 'fork'],
  ['join', 'join'],
])

/** Out-of-scope keyword token kinds → user-facing feature name. */
const UNSUPPORTED_KEYWORDS: ReadonlyMap<TokenKind, string> = new Map<TokenKind, string>([
  ['KW_CLASSDEF', 'classDef declarations'],
  ['KW_CLASS', 'class assignments'],
  ['KW_STYLE', 'inline style directives'],
  ['KW_CLICK', 'click handlers'],
  ['KW_HREF', 'href interactivity'],
])

/**
 * Parse a Mermaid state-diagram source into a {@link StateDiagramAst}.
 * The tokenizer should be positioned at the start of the source (the
 * parser consumes the `stateDiagram` header keyword itself).
 *
 * Collects all issues from a single parse (multi-error reporting). On
 * success returns `{ ok: true, value: ast }`.
 */
export function parseStateDiagram(tokenizer: Tokenizer): ParseResult<StateDiagramAst> {
  return new StateParser(tokenizer).parse()
}

class StateParser {
  private readonly t: Tokenizer
  private readonly issues: ParseIssue[] = []
  private headerPosition: Position = { line: 1, column: 1 }
  private direction: FlowchartDirection = 'TB'

  constructor(tokenizer: Tokenizer) {
    this.t = tokenizer
  }

  parse(): ParseResult<StateDiagramAst> {
    this.skipBlanks()
    const header = this.t.next()
    if (header.kind !== 'KW_STATEDIAGRAM') {
      this.recordSyntax(
        `Expected \`stateDiagram\` or \`stateDiagram-v2\` header at the start of the diagram, got \`${header.value}\``,
        header,
      )
      return { ok: false, issues: this.issues }
    }
    this.headerPosition = { line: header.line, column: header.column }
    this.parseOptionalDirection()
    this.expectStatementSeparator()

    const statements = this.parseStatementsUntil('EOF')

    if (this.issues.length > 0) {
      return { ok: false, issues: this.issues }
    }
    return {
      ok: true,
      value: {
        kind: 'stateDiagram',
        direction: this.direction,
        statements,
        position: this.headerPosition,
      },
    }
  }

  /**
   * Parse statements until the given stop token (`'EOF'` for the
   * top-level document, `'KW_END'` for a compound-state body). On
   * `'KW_END'` the stop token is consumed; on `'EOF'` it isn't.
   */
  private parseStatementsUntil(stop: 'EOF' | 'KW_END'): StateStatement[] {
    const statements: StateStatement[] = []
    while (true) {
      this.skipBlanks()
      const peek = this.t.peek()

      if (peek.kind === 'EOF') {
        if (stop === 'KW_END') {
          this.recordSyntax('Compound state was never closed by `}`', peek)
        }
        break
      }
      if (stop === 'KW_END' && peek.kind === 'RBRACE') {
        this.t.next()
        break
      }

      const parsed = this.parseStatement()
      if (parsed === null) {
        if (this.t.peek().kind !== 'EOF') this.t.next()
      } else {
        for (const stmt of parsed) statements.push(stmt)
      }
    }
    return statements
  }

  private parseStatement(): StateStatement[] | null {
    const tok = this.t.peek()

    const unsupportedReason = UNSUPPORTED_KEYWORDS.get(tok.kind)
    if (unsupportedReason !== undefined) {
      this.recordUnsupported(
        `\`${tok.value}\` (${unsupportedReason}) isn't supported by the inkin Mermaid bridge. See the README's "Supported Mermaid syntax" section.`,
        tok,
      )
      this.skipToEndOfStatement()
      return []
    }

    if (tok.kind === 'KW_NOTE') {
      this.recordUnsupported(
        "State-diagram notes (`note left of` / `note right of`) aren't supported by the inkin Mermaid bridge — inkin has no note primitive.",
        tok,
      )
      this.skipToEndOfStatement()
      return []
    }

    if (tok.kind === 'KW_HIDE_EMPTY') {
      // `hide empty description` is a pure rendering hint — silently
      // skip the rest of the line (no warn; it doesn't affect topology).
      this.skipToEndOfStatement()
      return []
    }

    if (tok.kind === 'KW_DIRECTION') {
      // Top-level direction is handled by parseOptionalDirection at the
      // header; a `direction` statement appearing later overrides it.
      this.t.next()
      const dir = this.t.peek()
      if (dir.kind === 'DIR_VALUE' && VALID_DIRECTIONS.has(dir.value)) {
        this.t.next()
        this.direction = dir.value === 'TD' ? 'TB' : (dir.value as FlowchartDirection)
      }
      return []
    }

    if (tok.kind === 'KW_STATE') {
      return this.parseStateDecl()
    }

    // `--` concurrency divider inside a compound body.
    if (tok.kind === 'EDGE_START' || tok.kind === 'EDGE_LINE') {
      this.recordUnsupported(
        "The `--` concurrency divider (parallel regions inside a compound state) isn't supported by the inkin Mermaid bridge.",
        tok,
      )
      this.skipToEndOfStatement()
      return []
    }

    // A reference (state id or `[*]`) starts either a transition or a
    // standalone state declaration / description.
    if (
      tok.kind === 'IDENT' ||
      tok.kind === 'NUM' ||
      tok.kind === 'DIR_VALUE' ||
      tok.kind === 'EDGE_STATE'
    ) {
      return this.parseTransitionOrStateRef()
    }

    this.recordSyntax(`Unexpected token \`${tok.value}\` at start of statement`, tok)
    return null
  }

  /**
   * Handle a statement that begins with a state reference. Three shapes:
   *
   *   A --> B [: event]      transition
   *   A : description        state with a description (label)
   *   A                      bare state declaration
   */
  private parseTransitionOrStateRef(): StateStatement[] {
    const left = this.parseStateRef('left')
    const peek = this.t.peek()

    // Transition.
    if (peek.kind === 'EDGE_ARROW' || peek.kind === 'EDGE_LINE') {
      const arrowTok = this.t.next()
      const right = this.parseStateRef('right')
      const description = this.parseOptionalDescription()
      const transition: StateTransition = {
        kind: 'transition',
        from: left.id,
        to: right.id,
        ...(description !== undefined && { description }),
        position: { line: arrowTok.line, column: arrowTok.column },
      }
      // Emit implicit state decls for both endpoints (skip sentinels —
      // the converter materializes those itself). The converter
      // de-dups by id, so emitting here is harmless and keeps every
      // referenced id discoverable from the statement list.
      const out: StateStatement[] = []
      if (!left.isSentinel) out.push(this.implicitState(left.id, left.position))
      if (!right.isSentinel) out.push(this.implicitState(right.id, right.position))
      out.push(transition)
      return out
    }

    // Description: `A : some text`.
    if (peek.kind === 'COLON') {
      this.t.next() // consume COLON
      const descRead = this.t.readToEndOfLine()
      const decl: StateDecl = {
        kind: 'state',
        id: left.id,
        ...(descRead.text.length > 0 && { label: descRead.text }),
        type: 'normal',
        position: left.position,
      }
      return [decl]
    }

    // Bare reference → implicit state declaration.
    return [this.implicitState(left.id, left.position)]
  }

  /**
   * Parse `state ...` declarations:
   *
   *   state X
   *   state "Friendly name" as X
   *   state X <<choice>> | <<fork>> | <<join>>
   *   state X { ... }
   */
  private parseStateDecl(): StateStatement[] {
    const stateTok = this.t.next() // consume KW_STATE
    const peek = this.t.peek()

    // `state "Friendly name" as X`
    if (peek.kind === 'STRING') {
      const labelTok = this.t.next()
      const asTok = this.t.peek()
      if (asTok.kind !== 'KW_AS') {
        this.recordSyntax('Expected `as <id>` after `state "..."`', asTok)
        this.skipToEndOfStatement()
        return []
      }
      this.t.next() // consume KW_AS
      const idTok = this.t.next()
      if (idTok.kind !== 'IDENT' && idTok.kind !== 'NUM' && idTok.kind !== 'DIR_VALUE') {
        this.recordSyntax(`Expected state id after \`as\`, got \`${idTok.value}\``, idTok)
        return []
      }
      return [
        {
          kind: 'state',
          id: idTok.value,
          label: labelTok.value,
          type: 'normal',
          position: { line: stateTok.line, column: stateTok.column },
        },
      ]
    }

    // `state X ...`
    if (peek.kind !== 'IDENT' && peek.kind !== 'NUM' && peek.kind !== 'DIR_VALUE') {
      this.recordSyntax(`Expected state id after \`state\`, got \`${peek.value}\``, peek)
      this.skipToEndOfStatement()
      return []
    }
    const idTok = this.t.next()
    const id = idTok.value
    const after = this.t.peek()

    // `state X <<choice>>`
    if (after.kind === 'L_PSEUDO') {
      this.t.next() // consume <<
      const kindTok = this.t.next()
      const closeTok = this.t.peek()
      if (closeTok.kind === 'R_PSEUDO') this.t.next()
      const type = PSEUDO_TYPES.get(kindTok.value.toLowerCase())
      if (type === undefined) {
        this.recordUnsupported(
          `Unknown pseudostate \`<<${kindTok.value}>>\` — only <<choice>>, <<fork>>, <<join>> are recognized. Rendered as a plain state.`,
          kindTok,
        )
      }
      return [
        {
          kind: 'state',
          id,
          type: type ?? 'normal',
          position: { line: stateTok.line, column: stateTok.column },
        },
      ]
    }

    // `state X { ... }`  — compound state.
    if (after.kind === 'LBRACE') {
      this.t.next() // consume {
      this.expectStatementSeparator()
      const children = this.parseCompoundBody(id)
      const compound: StateCompound = {
        kind: 'compound',
        id,
        statements: children,
        position: { line: stateTok.line, column: stateTok.column },
      }
      return [compound]
    }

    // Plain `state X`.
    return [
      {
        kind: 'state',
        id,
        type: 'normal',
        position: { line: stateTok.line, column: stateTok.column },
      },
    ]
  }

  /**
   * Parse the body of a compound state up to the closing `}`. Nested
   * compound states are flattened — their children lift into this
   * body and one `unsupported` warn is recorded per nesting level
   * (consistent with subgraph flattening in Phase 4).
   */
  private parseCompoundBody(_compoundId: string): StateStatement[] {
    const collected: StateStatement[] = []
    const inner = this.parseStatementsUntil('KW_END')
    for (const stmt of inner) {
      if (stmt.kind === 'compound') {
        this.recordUnsupported(
          "Nested compound states aren't supported by the inkin Mermaid bridge — the inner state's children are flattened into the parent (master plan reserves nested rendering for 1.2.0).",
          stmt.position,
        )
        for (const child of stmt.statements) collected.push(child)
      } else {
        collected.push(stmt)
      }
    }
    return collected
  }

  /**
   * Parse a single state reference: an id (IDENT / NUM / DIR_VALUE) or
   * the `[*]` start/end sentinel. `side` resolves `[*]` — on the left
   * of an arrow it's the start sentinel, on the right it's the end.
   */
  private parseStateRef(side: 'left' | 'right'): {
    id: string
    isSentinel: boolean
    position: Position
  } {
    const tok = this.t.next()
    if (tok.kind === 'EDGE_STATE') {
      return {
        id: side === 'left' ? START_SENTINEL : END_SENTINEL,
        isSentinel: true,
        position: { line: tok.line, column: tok.column },
      }
    }
    if (tok.kind === 'IDENT' || tok.kind === 'NUM' || tok.kind === 'DIR_VALUE') {
      return {
        id: tok.value,
        isSentinel: false,
        position: { line: tok.line, column: tok.column },
      }
    }
    this.recordSyntax(`Expected a state id or \`[*]\`, got \`${tok.value}\``, tok)
    return {
      id: tok.value || '__error__',
      isSentinel: false,
      position: { line: tok.line, column: tok.column },
    }
  }

  /** If the next token is a COLON, consume it and read the rest of the
   * line as the transition / state description. Returns `undefined`
   * when there's no description. */
  private parseOptionalDescription(): string | undefined {
    if (this.t.peek().kind !== 'COLON') return undefined
    this.t.next() // consume COLON
    const r = this.t.readToEndOfLine()
    return r.text.length > 0 ? r.text : undefined
  }

  private implicitState(id: string, position: Position): StateDecl {
    return { kind: 'state', id, type: 'normal', position }
  }

  private parseOptionalDirection(): void {
    const peek = this.t.peek()
    if (peek.kind === 'DIR_VALUE' && VALID_DIRECTIONS.has(peek.value)) {
      this.t.next()
      this.direction = peek.value === 'TD' ? 'TB' : (peek.value as FlowchartDirection)
    }
  }

  private expectStatementSeparator(): void {
    const next = this.t.peek()
    if (next.kind === 'NEWLINE' || next.kind === 'SEMI') {
      this.t.next()
      return
    }
    if (next.kind === 'EOF') return
    // Tolerant — a separator is expected but not strictly required for
    // the parser to make progress (statements are self-delimiting).
  }

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

  private skipToEndOfStatement(): void {
    while (true) {
      const k = this.t.peek().kind
      if (k === 'NEWLINE' || k === 'SEMI' || k === 'EOF') return
      this.t.next()
    }
  }

  private recordSyntax(message: string, at: Token | Position): void {
    this.issues.push({ kind: 'syntax', message, position: toPosition(at) })
  }

  private recordUnsupported(message: string, at: Token | Position): void {
    this.issues.push({ kind: 'unsupported', message, position: toPosition(at) })
  }
}

function toPosition(at: Token | Position): Position {
  return { line: at.line, column: at.column }
}
