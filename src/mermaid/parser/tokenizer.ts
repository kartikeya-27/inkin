/**
 * Tokenizer for `@inkin/core@0.6.0`'s Mermaid bridge.
 *
 * Phase 2 of the 0.6.0 plan. Emits a stream of primitive tokens from
 * Mermaid source text — keywords, brackets, edge operators, identifiers,
 * strings, comments. The parser (Phases 3-5) reads this stream and
 * builds an AST. Label content inside brackets / pipes is consumed by
 * the parser via the {@link Tokenizer.readUntilMarker} helper, which
 * lets the parser drive raw character-level reads when it knows the
 * expected close marker — this collapses Mermaid's ~40 stateful lexer
 * modes into a much smaller, simpler surface.
 *
 * Grammar reference: `notes/mermaid-grammar-snapshot/grammar-snapshot.md`
 * (Phase 1 deliverable). The original JISON grammars at
 * `notes/mermaid-grammar-snapshot/flow.jison` +
 * `notes/mermaid-grammar-snapshot/stateDiagram.jison` are the
 * syntactic spec.
 *
 * Attribution: token kinds + bracket pairs derived from
 * mermaid-js/mermaid HEAD `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`
 * (MIT, © 2015 Knut Sveidqvist and Mermaid contributors). Parser code
 * is original to inkin.
 */

/** All token kinds the tokenizer can produce. */
export type TokenKind =
  // Separators
  | 'NEWLINE'
  | 'SEMI'
  | 'EOF'
  | 'COMMENT'

  // Top-level diagram keywords
  | 'KW_FLOWCHART'
  | 'KW_STATEDIAGRAM'
  | 'KW_SUBGRAPH'
  | 'KW_END'
  | 'KW_STATE'
  | 'KW_NOTE'
  | 'KW_AS'
  | 'KW_DIRECTION'
  | 'KW_HIDE_EMPTY'

  // Out-of-scope keywords — emitted so the parser can produce a precise
  // "unsupported" error pointing at the right token.
  | 'KW_CLICK'
  | 'KW_HREF'
  | 'KW_STYLE'
  | 'KW_LINKSTYLE'
  | 'KW_CLASSDEF'
  | 'KW_CLASS'
  | 'KW_INTERPOLATE'
  | 'KW_DEFAULT'
  | 'KW_ACC_TITLE'
  | 'KW_ACC_DESCR'

  // Direction values (TB, BT, LR, RL, TD)
  | 'DIR_VALUE'

  // Bracket pairs — open and close are distinct so the parser knows
  // which close marker to look for. Sized largest-first so longer
  // sequences win the longest-match tie at the lexer level.
  | 'L_TRIPLE_PAREN' // (((
  | 'R_TRIPLE_PAREN' // )))
  | 'L_DBL_PAREN' //    ((
  | 'R_DBL_PAREN' //    ))
  | 'L_DBL_BRACKET' //  [[
  | 'R_DBL_BRACKET' //  ]]
  | 'L_DBL_BRACE' //    {{
  | 'R_DBL_BRACE' //    }}
  | 'L_STADIUM' //      ([
  | 'R_STADIUM' //      ])
  | 'L_CYLINDER' //     [(
  | 'R_CYLINDER' //     )]
  | 'L_ELLIPSE' //      (-
  | 'R_ELLIPSE' //      -)
  | 'L_TRAP_F' //       [/
  | 'R_TRAP_F' //       \]
  | 'L_TRAP_B' //       [\
  | 'R_TRAP_B' //       /]
  | 'LBRACKET' //       [
  | 'RBRACKET' //       ]
  | 'LPAREN' //         (
  | 'RPAREN' //         )
  | 'LBRACE' //         {
  | 'RBRACE' //         }
  | 'EDGE_STATE' //     [*]  — state-diagram start/end marker

  // Edge operators
  | 'EDGE_ARROW' //         -->
  | 'EDGE_LINE' //          ---
  | 'EDGE_THICK_ARROW' //   ==>
  | 'EDGE_THICK_LINE' //    ===
  | 'EDGE_DOTTED_ARROW' //  -.->
  | 'EDGE_DOTTED_LINE' //   -.-
  | 'EDGE_INVISIBLE' //     ~~~
  // "Started" edges (text follows, then a matching arrow/line closer
  // is expected). e.g. `A -- foo --> B`. The parser uses
  // `readUntilMarker` to consume the label.
  | 'EDGE_START' //         --   (preceded by an identifier, followed by
  //                                non-arrow text)
  | 'EDGE_START_THICK' //   ==
  | 'EDGE_START_DOTTED' //  -.

  // Markers
  | 'PIPE' //               |
  | 'COLON' //              :
  | 'STYLE_SEP' //          :::
  | 'COMMA' //              ,
  | 'AMP' //                &
  | 'FLAG_END' //           >  (asymmetric/flag node shape opener)
  | 'CONCURRENT' //         -- (state-diagram inside `state X { ... }`)

  // Identifiers and literals
  | 'IDENT'
  | 'NUM'
  | 'STRING' //              "quoted"

  // Generic raw text (only emitted by `readUntilMarker`; never by `next`)
  | 'TEXT'
  | 'INVALID'

/** A single token with its source position. */
export interface Token {
  readonly kind: TokenKind
  /** The raw text matched. For STRING tokens, the surrounding quotes
   * are stripped; for COMMENT tokens, the leading `%%` is stripped;
   * for keyword/operator tokens, the lowercased / canonical form. */
  readonly value: string
  /** 1-based line of the first character. */
  readonly line: number
  /** 1-based column of the first character. */
  readonly column: number
}

/** Direction keywords accepted in `flowchart`/`graph` / `stateDiagram` headers. */
const DIR_VALUES = new Set(['TB', 'BT', 'LR', 'RL', 'TD'])

/**
 * Keyword table. The tokenizer looks up identifiers here AFTER reading
 * them as plain identifiers, so identifiers that look like keywords get
 * the right kind. Case-insensitive only for state-diagram-side keys
 * (`stateDiagram`, `state`, etc. — Mermaid's `%options case-insensitive`).
 * Flowchart keywords (`flowchart`, `graph`, `subgraph`) are
 * case-sensitive per the JISON grammar.
 */
const FLOWCHART_KEYWORDS: ReadonlyMap<string, TokenKind> = new Map<string, TokenKind>([
  ['flowchart', 'KW_FLOWCHART'],
  ['graph', 'KW_FLOWCHART'],
  ['subgraph', 'KW_SUBGRAPH'],
  ['end', 'KW_END'],
  ['click', 'KW_CLICK'],
  ['href', 'KW_HREF'],
  ['style', 'KW_STYLE'],
  ['linkStyle', 'KW_LINKSTYLE'],
  ['classDef', 'KW_CLASSDEF'],
  ['class', 'KW_CLASS'],
  ['interpolate', 'KW_INTERPOLATE'],
  ['default', 'KW_DEFAULT'],
  ['direction', 'KW_DIRECTION'],
])

const STATE_KEYWORDS: ReadonlyMap<string, TokenKind> = new Map<string, TokenKind>([
  ['statediagram', 'KW_STATEDIAGRAM'],
  ['statediagram-v2', 'KW_STATEDIAGRAM'],
  ['state', 'KW_STATE'],
  ['note', 'KW_NOTE'],
  ['as', 'KW_AS'],
  ['hide', 'KW_HIDE_EMPTY'], // partial; full match is `hide empty description`
])

/**
 * Token stream over a Mermaid source string.
 *
 * Usage from the parser:
 *
 *   const t = new Tokenizer(input)
 *   while (t.peek().kind !== 'EOF') {
 *     const tok = t.next()
 *     // dispatch based on tok.kind
 *   }
 *
 * For label content the parser calls `readUntilMarker` with the
 * expected close marker(s); the tokenizer character-walks the input
 * and returns the consumed text without consuming the marker itself.
 */
export class Tokenizer {
  private readonly input: string
  private pos = 0
  private line = 1
  private col = 1
  /** Single-token lookahead buffer. */
  private peeked: Token | null = null

  constructor(input: string) {
    this.input = input
  }

  /** Return the next token and advance. */
  next(): Token {
    if (this.peeked !== null) {
      const t = this.peeked
      this.peeked = null
      return t
    }
    return this.readNext()
  }

  /** Peek without consuming. */
  peek(): Token {
    if (this.peeked === null) {
      this.peeked = this.readNext()
    }
    return this.peeked
  }

  /** Current 1-based source position (used by the parser for error
   * messages even when no token has been read at this exact point). */
  position(): { line: number; column: number } {
    return { line: this.line, column: this.col }
  }

  /**
   * Parser-driven raw text reading. Consumes characters from the current
   * position until any one of `closeMarkers` is found AT the current
   * position (longest-match wins). The marker is NOT consumed — the
   * parser is expected to call `next()` afterwards to read it as a
   * token. Returns `null` if EOF is reached before any marker is found.
   *
   * Trims leading and trailing whitespace from the returned text — the
   * tokenizer's lexer mode for labels (`<text>` in Mermaid's JISON)
   * does the same.
   */
  readUntilMarker(
    closeMarkers: readonly string[],
  ): { text: string; marker: string; line: number; column: number } | null {
    // Drop the lookahead — character-level reading happens directly on
    // the input buffer, not on tokenized stream.
    this.peeked = null
    const startLine = this.line
    const startCol = this.col
    const startPos = this.pos
    // Sort markers longest-first so `]]` beats `]`, `-.->` beats `-.`, etc.
    const ordered = [...closeMarkers].sort((a, b) => b.length - a.length)

    while (this.pos < this.input.length) {
      for (const m of ordered) {
        if (this.input.startsWith(m, this.pos)) {
          return {
            text: this.input.slice(startPos, this.pos).trim(),
            marker: m,
            line: startLine,
            column: startCol,
          }
        }
      }
      this.advance(1)
    }
    return null
  }

  /** Internal: read the next primitive token from the input buffer. */
  private readNext(): Token {
    // Skip non-newline whitespace.
    while (this.pos < this.input.length) {
      const c = this.input[this.pos]
      if (c === ' ' || c === '\t' || c === '\r') {
        this.advance(1)
      } else {
        break
      }
    }

    if (this.pos >= this.input.length) {
      return this.make('EOF', '', this.line, this.col)
    }

    const startLine = this.line
    const startCol = this.col
    const c = this.input.charAt(this.pos)

    // Newlines are statement separators.
    if (c === '\n') {
      this.advance(1)
      return this.make('NEWLINE', '\n', startLine, startCol)
    }
    if (c === ';') {
      this.advance(1)
      return this.make('SEMI', ';', startLine, startCol)
    }

    // Comments: `%%` to end of line. Mermaid also accepts `# ...` in
    // state diagrams but that's rare and we'll treat # as an identifier
    // character for v0 to keep the lexer simple.
    if (this.starts('%%')) {
      this.advance(2)
      const textStart = this.pos
      while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
        this.advance(1)
      }
      return this.make('COMMENT', this.input.slice(textStart, this.pos).trim(), startLine, startCol)
    }

    // Strings — Mermaid also has markdown strings (\"`md`\") which we
    // explicitly reject in Phase 1's spec. The tokenizer emits them as
    // STRING with the raw inner text; the parser can detect the
    // backtick prefix and surface an "unsupported" error.
    if (c === '"') {
      this.advance(1)
      const textStart = this.pos
      while (this.pos < this.input.length && this.input[this.pos] !== '"') {
        this.advance(1)
      }
      const text = this.input.slice(textStart, this.pos)
      if (this.pos < this.input.length) this.advance(1) // consume closing "
      return this.make('STRING', text, startLine, startCol)
    }

    // State-diagram start/end marker.
    if (this.starts('[*]')) {
      this.advance(3)
      return this.make('EDGE_STATE', '[*]', startLine, startCol)
    }

    // Multi-character bracket pairs (longest-match-first ordering matters).
    const bracketPairs: ReadonlyArray<readonly [string, TokenKind]> = [
      ['(((', 'L_TRIPLE_PAREN'],
      [')))', 'R_TRIPLE_PAREN'],
      ['((', 'L_DBL_PAREN'],
      ['))', 'R_DBL_PAREN'],
      ['[[', 'L_DBL_BRACKET'],
      [']]', 'R_DBL_BRACKET'],
      ['{{', 'L_DBL_BRACE'],
      ['}}', 'R_DBL_BRACE'],
      ['([', 'L_STADIUM'],
      ['])', 'R_STADIUM'],
      ['[(', 'L_CYLINDER'],
      [')]', 'R_CYLINDER'],
      ['(-', 'L_ELLIPSE'],
      ['-)', 'R_ELLIPSE'],
      ['[/', 'L_TRAP_F'],
      ['\\]', 'R_TRAP_F'],
      ['[\\', 'L_TRAP_B'],
      ['/]', 'R_TRAP_B'],
    ]
    for (const [marker, kind] of bracketPairs) {
      if (this.starts(marker)) {
        this.advance(marker.length)
        return this.make(kind, marker, startLine, startCol)
      }
    }

    // Style separator + colon
    if (this.starts(':::')) {
      this.advance(3)
      return this.make('STYLE_SEP', ':::', startLine, startCol)
    }
    if (c === ':') {
      this.advance(1)
      return this.make('COLON', ':', startLine, startCol)
    }

    // Edge tokens. Mermaid accepts variable-length dashes and equals:
    // -->, --->, ---->, ... all mean "solid arrow". Same for thick (==>,
    // ===>, ...), dotted (-.->, -..->, ...), and lines (---, ----, ...,
    // ===, ====, ...). We canonicalize all of these to the shortest
    // form in the token's value field so the parser doesn't have to
    // care about length.
    //
    // Dotted family. The shape is `-` then 1+ `.` then `-` plus optional
    // `>`. So `-.->`, `-..->`, `-...->`, `-.-`, `-..-`, etc.
    if (c === '-' && this.charAt(1) === '.') {
      // Count the dots after the leading dash.
      let dots = 1
      while (this.charAt(1 + dots) === '.') dots += 1
      // After the dots, optionally a `-` then optionally `>`.
      const afterDots = this.charAt(1 + dots)
      if (afterDots === '-') {
        const hasArrow = this.charAt(2 + dots) === '>'
        const len = 2 + dots + (hasArrow ? 1 : 0)
        this.advance(len)
        return this.make(
          hasArrow ? 'EDGE_DOTTED_ARROW' : 'EDGE_DOTTED_LINE',
          hasArrow ? '-.->' : '-.-',
          startLine,
          startCol,
        )
      }
      if (dots === 1) {
        // `-.` with nothing recognizable after; treat as start-of-edge
        // (the parser then reads a label and expects a closing `-.->`).
        this.advance(2)
        return this.make('EDGE_START_DOTTED', '-.', startLine, startCol)
      }
      // Pathological `-..` with no closing dash; fall through as INVALID.
    }
    // Thick family: 2+ `=` then optional `>`.
    if (c === '=' && this.charAt(1) === '=') {
      let len = 2
      while (this.charAt(len) === '=') len += 1
      const hasArrow = this.charAt(len) === '>'
      if (hasArrow) {
        this.advance(len + 1)
        return this.make('EDGE_THICK_ARROW', '==>', startLine, startCol)
      }
      if (len >= 3) {
        this.advance(len)
        return this.make('EDGE_THICK_LINE', '===', startLine, startCol)
      }
      // exactly 2 `=` with no closing: start of mid-text edge
      this.advance(2)
      return this.make('EDGE_START_THICK', '==', startLine, startCol)
    }
    // Solid family: 2+ `-` then optional `>`.
    if (c === '-' && this.charAt(1) === '-') {
      let len = 2
      while (this.charAt(len) === '-') len += 1
      const hasArrow = this.charAt(len) === '>'
      if (hasArrow) {
        this.advance(len + 1)
        return this.make('EDGE_ARROW', '-->', startLine, startCol)
      }
      if (len >= 3) {
        this.advance(len)
        return this.make('EDGE_LINE', '---', startLine, startCol)
      }
      // exactly 2 `-` with no closing: start of mid-text edge
      this.advance(2)
      return this.make('EDGE_START', '--', startLine, startCol)
    }
    // Invisible: 3+ `~`.
    if (c === '~' && this.charAt(1) === '~' && this.charAt(2) === '~') {
      let len = 3
      while (this.charAt(len) === '~') len += 1
      this.advance(len)
      return this.make('EDGE_INVISIBLE', '~~~', startLine, startCol)
    }

    // Single-char bracket pairs (after the multi-char attempts above)
    const singleBrackets: ReadonlyArray<readonly [string, TokenKind]> = [
      ['[', 'LBRACKET'],
      [']', 'RBRACKET'],
      ['(', 'LPAREN'],
      [')', 'RPAREN'],
      ['{', 'LBRACE'],
      ['}', 'RBRACE'],
    ]
    for (const [marker, kind] of singleBrackets) {
      if (c === marker) {
        this.advance(1)
        return this.make(kind, marker, startLine, startCol)
      }
    }

    // Misc single-char tokens.
    if (c === '|') {
      this.advance(1)
      return this.make('PIPE', '|', startLine, startCol)
    }
    if (c === ',') {
      this.advance(1)
      return this.make('COMMA', ',', startLine, startCol)
    }
    if (c === '&') {
      this.advance(1)
      return this.make('AMP', '&', startLine, startCol)
    }
    if (c === '>') {
      this.advance(1)
      return this.make('FLAG_END', '>', startLine, startCol)
    }

    // Numbers (integer for now; Mermaid doesn't use decimals in graph
    // syntax outside of styling we don't support).
    if (this.isDigit(c)) {
      const numStart = this.pos
      while (this.pos < this.input.length && this.isDigit(this.input.charAt(this.pos))) {
        this.advance(1)
      }
      return this.make('NUM', this.input.slice(numStart, this.pos), startLine, startCol)
    }

    // Identifiers / keywords.
    // Mermaid's NODE_STRING regex is liberal: [A-Za-z0-9!"#$%&'*+.`?\\_/]+
    // plus selective hyphens. We accept a similarly liberal set but
    // exclude characters that conflict with our other tokens (-, ., (, ),
    // [, ], {, }, |, &, ,, :, ;, >, %, ~, =, etc.). Letters / digits /
    // underscore / hyphen-in-the-middle / period-in-the-middle are the
    // common cases; we accept those.
    if (this.isIdentStart(c)) {
      const identStart = this.pos
      while (this.pos < this.input.length && this.isIdentCont(this.input.charAt(this.pos))) {
        this.advance(1)
      }
      const ident = this.input.slice(identStart, this.pos)
      const kind = this.lookupKeyword(ident)
      return this.make(kind, ident, startLine, startCol)
    }

    // Anything else is an invalid token; the parser surfaces a precise
    // error using the position.
    this.advance(1)
    return this.make('INVALID', c, startLine, startCol)
  }

  /** Resolve an identifier to a keyword token if it matches one,
   * else to a DIR_VALUE if it's a direction, else IDENT. */
  private lookupKeyword(ident: string): TokenKind {
    // Flowchart keywords are case-sensitive per the JISON grammar.
    const flowKind = FLOWCHART_KEYWORDS.get(ident)
    if (flowKind !== undefined) return flowKind
    // State-diagram keywords are case-insensitive.
    const stateKind = STATE_KEYWORDS.get(ident.toLowerCase())
    if (stateKind !== undefined) return stateKind
    // Direction values (TB/BT/LR/RL/TD) are case-sensitive.
    if (DIR_VALUES.has(ident)) return 'DIR_VALUE'
    return 'IDENT'
  }

  /** Does the input at the current position start with `s`? */
  private starts(s: string): boolean {
    return this.input.startsWith(s, this.pos)
  }

  /** Character at `this.pos + offset`, or empty string if out of bounds. */
  private charAt(offset: number): string {
    return this.input[this.pos + offset] ?? ''
  }

  private advance(n: number): void {
    for (let i = 0; i < n; i++) {
      const c = this.input[this.pos]
      if (c === '\n') {
        this.line += 1
        this.col = 1
      } else {
        this.col += 1
      }
      this.pos += 1
    }
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9'
  }

  private isIdentStart(c: string): boolean {
    return (
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      c === '_' ||
      // Allow extended unicode letters for Mermaid compatibility.
      c.charCodeAt(0) > 127
    )
  }

  private isIdentCont(c: string): boolean {
    return this.isIdentStart(c) || this.isDigit(c) || c === '-' || c === '.' || c === '#'
  }

  private make(kind: TokenKind, value: string, line: number, column: number): Token {
    return { kind, value, line, column }
  }
}
