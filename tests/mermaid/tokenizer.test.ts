import { describe, expect, it } from 'vitest'
import { type Token, Tokenizer, type TokenKind } from '../../src/mermaid/parser/tokenizer'

/**
 * Phase 2 of 0.6.0 — tokenizer golden tests.
 *
 * Each test feeds a hand-picked Mermaid input through the tokenizer
 * and asserts the resulting token stream (kind + value). Inputs are
 * adapted from Mermaid's own JISON spec files
 * (`packages/mermaid/src/diagrams/flowchart/parser/*.spec.js` at HEAD
 * `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`); attribution lives in
 * the file headers shipped under `notes/mermaid-grammar-snapshot/`.
 *
 * `kinds(input)` collects all token kinds up to EOF (excluding EOF
 * itself). `pairs(input)` returns `[kind, value]` tuples — the
 * stronger assertion when value text matters.
 */

function kinds(input: string): TokenKind[] {
  const t = new Tokenizer(input)
  const out: TokenKind[] = []
  while (true) {
    const tok = t.next()
    if (tok.kind === 'EOF') return out
    out.push(tok.kind)
  }
}

function pairs(input: string): Array<[TokenKind, string]> {
  const t = new Tokenizer(input)
  const out: Array<[TokenKind, string]> = []
  while (true) {
    const tok = t.next()
    if (tok.kind === 'EOF') return out
    out.push([tok.kind, tok.value])
  }
}

function allTokens(input: string): Token[] {
  const t = new Tokenizer(input)
  const out: Token[] = []
  while (true) {
    const tok = t.next()
    out.push(tok)
    if (tok.kind === 'EOF') return out
  }
}

describe('tokenizer — header keywords', () => {
  it('lexes `flowchart` keyword as KW_FLOWCHART', () => {
    expect(pairs('flowchart')).toEqual([['KW_FLOWCHART', 'flowchart']])
  })

  it('lexes legacy `graph` alias as KW_FLOWCHART', () => {
    expect(pairs('graph')).toEqual([['KW_FLOWCHART', 'graph']])
  })

  it('lexes `flowchart TD` as keyword + direction', () => {
    expect(pairs('flowchart TD')).toEqual([
      ['KW_FLOWCHART', 'flowchart'],
      ['DIR_VALUE', 'TD'],
    ])
  })

  it('lexes every accepted direction value', () => {
    for (const dir of ['TB', 'BT', 'LR', 'RL', 'TD']) {
      expect(pairs(`flowchart ${dir}`)).toEqual([
        ['KW_FLOWCHART', 'flowchart'],
        ['DIR_VALUE', dir],
      ])
    }
  })

  it('lexes `stateDiagram` and `stateDiagram-v2` identically', () => {
    expect(pairs('stateDiagram')).toEqual([['KW_STATEDIAGRAM', 'stateDiagram']])
    expect(pairs('stateDiagram-v2')).toEqual([['KW_STATEDIAGRAM', 'stateDiagram-v2']])
  })
})

describe('tokenizer — bracket pairs (node shape openers/closers)', () => {
  it('lexes single bracket pairs', () => {
    expect(kinds('[](){}')).toEqual([
      'LBRACKET',
      'RBRACKET',
      'LPAREN',
      'RPAREN',
      'LBRACE',
      'RBRACE',
    ])
  })

  it('lexes double-bracket pairs and triple-paren before single', () => {
    expect(kinds('(((')).toEqual(['L_TRIPLE_PAREN'])
    expect(kinds(')))')).toEqual(['R_TRIPLE_PAREN'])
    expect(kinds('((')).toEqual(['L_DBL_PAREN'])
    expect(kinds('))')).toEqual(['R_DBL_PAREN'])
    expect(kinds('[[')).toEqual(['L_DBL_BRACKET'])
    expect(kinds(']]')).toEqual(['R_DBL_BRACKET'])
    expect(kinds('{{')).toEqual(['L_DBL_BRACE'])
    expect(kinds('}}')).toEqual(['R_DBL_BRACE'])
  })

  it('disambiguates stadium `([` `])` from `(` `[` and `]` `)`', () => {
    expect(kinds('([])')).toEqual(['L_STADIUM', 'R_STADIUM'])
  })

  it('disambiguates cylinder `[(` `)]` from `[` `(` and `)` `]`', () => {
    expect(kinds('[()]')).toEqual(['L_CYLINDER', 'R_CYLINDER'])
  })

  it('lexes trapezoid family openers and closers', () => {
    expect(kinds('[/')).toEqual(['L_TRAP_F'])
    expect(kinds('\\]')).toEqual(['R_TRAP_F'])
    expect(kinds('[\\')).toEqual(['L_TRAP_B'])
    expect(kinds('/]')).toEqual(['R_TRAP_B'])
  })

  it('lexes ellipse `(-` `-)` markers', () => {
    expect(kinds('(-')).toEqual(['L_ELLIPSE'])
    expect(kinds('-)')).toEqual(['R_ELLIPSE'])
  })

  it('lexes the state-diagram `[*]` start/end marker as one token', () => {
    expect(pairs('[*]')).toEqual([['EDGE_STATE', '[*]']])
  })
})

describe('tokenizer — edge operators', () => {
  it('lexes the four primary edge arrow kinds', () => {
    expect(pairs('A --> B')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_ARROW', '-->'],
      ['IDENT', 'B'],
    ])
    expect(pairs('A -.-> B')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_DOTTED_ARROW', '-.->'],
      ['IDENT', 'B'],
    ])
    expect(pairs('A ==> B')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_THICK_ARROW', '==>'],
      ['IDENT', 'B'],
    ])
    expect(pairs('A ~~~ B')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_INVISIBLE', '~~~'],
      ['IDENT', 'B'],
    ])
  })

  it('lexes line-only (no-arrow) edge variants', () => {
    expect(pairs('A --- B')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_LINE', '---'],
      ['IDENT', 'B'],
    ])
    expect(pairs('A -.- B')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_DOTTED_LINE', '-.-'],
      ['IDENT', 'B'],
    ])
    expect(pairs('A === B')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_THICK_LINE', '==='],
      ['IDENT', 'B'],
    ])
  })

  it('lexes mid-edge text starters (--, -., ==) without consuming the label', () => {
    // The parser, on seeing EDGE_START, will call readUntilMarker to
    // consume the label text up to the next edge closer. Here we just
    // assert the START token is emitted.
    expect(pairs('A -- ')).toEqual([
      ['IDENT', 'A'],
      ['EDGE_START', '--'],
    ])
  })

  it('disambiguates -->, ---, --, -. correctly by longest-match', () => {
    expect(kinds('-->')).toEqual(['EDGE_ARROW'])
    expect(kinds('---')).toEqual(['EDGE_LINE'])
    expect(kinds('--')).toEqual(['EDGE_START'])
    expect(kinds('-.->')).toEqual(['EDGE_DOTTED_ARROW'])
    expect(kinds('-.-')).toEqual(['EDGE_DOTTED_LINE'])
    expect(kinds('-.')).toEqual(['EDGE_START_DOTTED'])
  })

  it('accepts variable-length arrows (--->, ---->, ===> etc. all canonicalize)', () => {
    // Mermaid accepts arrows of any "length" — the dash/equals count
    // is purely a visual hint, semantically identical to the shortest
    // form. The tokenizer canonicalizes to `-->`, `---`, `==>`, etc.
    // in the token's value field.
    for (const arrow of ['-->', '--->', '---->', '----->']) {
      expect(pairs(arrow)).toEqual([['EDGE_ARROW', '-->']])
    }
    for (const line of ['---', '----', '-----']) {
      expect(pairs(line)).toEqual([['EDGE_LINE', '---']])
    }
    for (const thick of ['==>', '===>', '====>']) {
      expect(pairs(thick)).toEqual([['EDGE_THICK_ARROW', '==>']])
    }
    for (const thickLine of ['===', '====', '=====']) {
      expect(pairs(thickLine)).toEqual([['EDGE_THICK_LINE', '===']])
    }
    for (const dotted of ['-.->', '-..->', '-...->']) {
      expect(pairs(dotted)).toEqual([['EDGE_DOTTED_ARROW', '-.->']])
    }
    for (const inv of ['~~~', '~~~~', '~~~~~']) {
      expect(pairs(inv)).toEqual([['EDGE_INVISIBLE', '~~~']])
    }
  })
})

describe('tokenizer — strings and labels', () => {
  it('lexes a quoted label with the surrounding quotes stripped', () => {
    expect(pairs('"hello world"')).toEqual([['STRING', 'hello world']])
  })

  it('lexes an empty string', () => {
    expect(pairs('""')).toEqual([['STRING', '']])
  })

  it('lexes a string with brackets inside intact', () => {
    expect(pairs('"A[1] -> B"')).toEqual([['STRING', 'A[1] -> B']])
  })
})

describe('tokenizer — comments and whitespace', () => {
  it('strips inline whitespace (spaces, tabs)', () => {
    expect(kinds('A   --->   B')).toEqual(['IDENT', 'EDGE_ARROW', 'IDENT'])
  })

  it('emits NEWLINE tokens between lines', () => {
    expect(kinds('A\nB')).toEqual(['IDENT', 'NEWLINE', 'IDENT'])
  })

  it('lexes `%% comment` as COMMENT with prefix stripped', () => {
    expect(pairs('%% this is a comment')).toEqual([['COMMENT', 'this is a comment']])
  })

  it('handles a comment terminated by a newline', () => {
    expect(kinds('%% comment\nA --> B')).toEqual([
      'COMMENT',
      'NEWLINE',
      'IDENT',
      'EDGE_ARROW',
      'IDENT',
    ])
  })
})

describe('tokenizer — keywords by surface form', () => {
  it.each([
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
  ] as Array<[string, TokenKind]>)('lexes flowchart keyword %s', (s, kind) => {
    expect(pairs(s)).toEqual([[kind, s]])
  })

  it.each([
    ['state', 'KW_STATE'],
    ['note', 'KW_NOTE'],
    ['as', 'KW_AS'],
  ] as Array<[string, TokenKind]>)('lexes state-diagram keyword %s (lowercased)', (s, kind) => {
    expect(pairs(s)).toEqual([[kind, s]])
  })

  it('case-insensitive matching on state-diagram keywords', () => {
    expect(pairs('State')).toEqual([['KW_STATE', 'State']])
    expect(pairs('NOTE')).toEqual([['KW_NOTE', 'NOTE']])
  })

  it('flowchart keywords stay case-sensitive — `Flowchart` is IDENT', () => {
    expect(pairs('Flowchart')).toEqual([['IDENT', 'Flowchart']])
  })
})

describe('tokenizer — out-of-scope keywords surface so parser can reject precisely', () => {
  // The parser turns these into structured `unsupported` errors (per
  // Phase 1's spec). The tokenizer's job is to flag them, not skip them.
  it('lexes accessibility / styling / interactivity keywords', () => {
    expect(pairs('click A href "url"')).toEqual([
      ['KW_CLICK', 'click'],
      ['IDENT', 'A'],
      ['KW_HREF', 'href'],
      ['STRING', 'url'],
    ])
    expect(kinds('classDef warn fill:#f99')).toContain('KW_CLASSDEF')
  })
})

describe('tokenizer — position tracking', () => {
  it('reports 1-based line and column of each token', () => {
    const toks = allTokens('A\n  B --> C')
    expect(toks[0]).toMatchObject({ kind: 'IDENT', value: 'A', line: 1, column: 1 })
    expect(toks[1]).toMatchObject({ kind: 'NEWLINE', line: 1, column: 2 })
    expect(toks[2]).toMatchObject({ kind: 'IDENT', value: 'B', line: 2, column: 3 })
    expect(toks[3]).toMatchObject({ kind: 'EDGE_ARROW', value: '-->', line: 2, column: 5 })
    expect(toks[4]).toMatchObject({ kind: 'IDENT', value: 'C', line: 2, column: 9 })
  })

  it('reports position via `position()` independently of `next()`', () => {
    const t = new Tokenizer('A')
    expect(t.position()).toEqual({ line: 1, column: 1 })
    t.next()
    expect(t.position()).toEqual({ line: 1, column: 2 })
  })
})

describe('tokenizer — `readUntilMarker` for parser-driven label reading', () => {
  it('reads everything between brackets when the parser knows the close marker', () => {
    const t = new Tokenizer('A[hello world]')
    t.next() // consume IDENT A
    t.next() // consume LBRACKET
    const result = t.readUntilMarker([']'])
    expect(result?.text).toBe('hello world')
    expect(result?.marker).toBe(']')
    expect(t.next().kind).toBe('RBRACKET') // marker was NOT consumed
  })

  it('honors longest-match per-position (NOT greedy across positions)', () => {
    // With both markers, the lexer stops at the FIRST `]` it finds —
    // not at `]]` further along. Inside an actual `[[...]]` block the
    // parser passes only `[']]']` so the single `]` doesn't terminate
    // the label early. The intermediate single-bracket case here is
    // the contract: per-position longest-match wins, but you can't ask
    // the lexer to skip a shorter match in favor of a longer one
    // further into the input.
    const t = new Tokenizer('A[[nested ]]')
    t.next() // IDENT
    t.next() // L_DBL_BRACKET
    const result = t.readUntilMarker([']]'])
    expect(result?.marker).toBe(']]')
    expect(result?.text).toBe('nested')
  })

  it('trims leading and trailing whitespace from the label text', () => {
    const t = new Tokenizer('A[   hello   ]')
    t.next()
    t.next()
    const result = t.readUntilMarker([']'])
    expect(result?.text).toBe('hello')
  })

  it('returns null on EOF without finding any marker', () => {
    const t = new Tokenizer('A[unclosed')
    t.next()
    t.next()
    const result = t.readUntilMarker([']'])
    expect(result).toBeNull()
  })

  it('handles edge-text style markers (-->, ---) for mid-edge labels', () => {
    // A -- label --> B → after EDGE_START, parser calls readUntilMarker
    // with edge closers to grab "label" before the closing arrow.
    const t = new Tokenizer('A -- label --> B')
    t.next() // IDENT A
    t.next() // EDGE_START --
    const result = t.readUntilMarker(['-->', '---'])
    expect(result?.text).toBe('label')
    expect(result?.marker).toBe('-->')
  })
})

describe('tokenizer — flowchart fixture lines (smoke from real Mermaid syntax)', () => {
  it('three-node pipeline', () => {
    expect(kinds('A[Start] --> B(Middle) --> C((End))')).toEqual([
      'IDENT',
      'LBRACKET',
      'IDENT',
      'RBRACKET',
      'EDGE_ARROW',
      'IDENT',
      'LPAREN',
      'IDENT',
      'RPAREN',
      'EDGE_ARROW',
      'IDENT',
      'L_DBL_PAREN',
      'IDENT',
      'R_DBL_PAREN',
    ])
  })

  it('edge with pipe-style label', () => {
    // The label `go` is a plain identifier. If the label happens to be
    // a keyword (e.g. `click`), the lexer correctly emits the keyword
    // token — the parser knows it's inside `|...|` and treats the
    // contents as raw text via `readUntilMarker(['|'])`. The lexer
    // itself is context-free.
    expect(kinds('A -->|go| B')).toEqual(['IDENT', 'EDGE_ARROW', 'PIPE', 'IDENT', 'PIPE', 'IDENT'])
  })

  it('keyword inside `|...|` lexes as a keyword (parser uses readUntilMarker instead)', () => {
    // Documenting the deliberate contract: tokens stream is
    // context-free; if a label happens to be a keyword, the parser
    // bypasses the token stream via `readUntilMarker` once it sees the
    // opening PIPE. The lexer doesn't track "currently inside label".
    expect(kinds('A -->|click| B')).toEqual([
      'IDENT',
      'EDGE_ARROW',
      'PIPE',
      'KW_CLICK',
      'PIPE',
      'IDENT',
    ])
  })

  it('subgraph with body', () => {
    const input = 'subgraph sg1\n  A --> B\nend'
    expect(kinds(input)).toEqual([
      'KW_SUBGRAPH',
      'IDENT',
      'NEWLINE',
      'IDENT',
      'EDGE_ARROW',
      'IDENT',
      'NEWLINE',
      'KW_END',
    ])
  })

  it('multi-line flowchart with comment + direction', () => {
    const input = 'flowchart LR\n%% pipeline\nA --> B'
    expect(kinds(input)).toEqual([
      'KW_FLOWCHART',
      'DIR_VALUE',
      'NEWLINE',
      'COMMENT',
      'NEWLINE',
      'IDENT',
      'EDGE_ARROW',
      'IDENT',
    ])
  })
})

describe('tokenizer — state-diagram fixture lines', () => {
  it('lexes the basic state-diagram header + transition', () => {
    const input = 'stateDiagram-v2\n[*] --> Active\nActive --> [*]'
    expect(kinds(input)).toEqual([
      'KW_STATEDIAGRAM',
      'NEWLINE',
      'EDGE_STATE',
      'EDGE_ARROW',
      'IDENT',
      'NEWLINE',
      'IDENT',
      'EDGE_ARROW',
      'EDGE_STATE',
    ])
  })

  it('lexes a state declaration with `state X as Y`', () => {
    expect(pairs('state "Active state" as Active')).toEqual([
      ['KW_STATE', 'state'],
      ['STRING', 'Active state'],
      ['KW_AS', 'as'],
      ['IDENT', 'Active'],
    ])
  })

  it('lexes a transition with a colon-delimited event label', () => {
    expect(kinds('A --> B : on_click')).toEqual(['IDENT', 'EDGE_ARROW', 'IDENT', 'COLON', 'IDENT'])
  })
})

describe('tokenizer — invalid / edge cases', () => {
  it('emits INVALID for an unrecognized standalone character', () => {
    expect(pairs('?')).toEqual([['INVALID', '?']])
  })

  it('handles an empty input', () => {
    expect(kinds('')).toEqual([])
  })

  it('handles trailing newlines without crashing', () => {
    expect(kinds('A\n\n\n')).toEqual(['IDENT', 'NEWLINE', 'NEWLINE', 'NEWLINE'])
  })

  it('handles a label with internal brackets (raw-read mode)', () => {
    // Stress test for readUntilMarker — the inner `(` and `)` aren't
    // interpreted as bracket pairs in raw-read mode.
    const t = new Tokenizer('X[(label with (parens))]')
    t.next() // IDENT X
    t.next() // L_CYLINDER [(
    const result = t.readUntilMarker([')]'])
    expect(result?.text).toBe('label with (parens)')
    expect(result?.marker).toBe(')]')
  })
})
