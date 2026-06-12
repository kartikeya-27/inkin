import { describe, expect, it } from 'vitest'
import type {
  EdgeStatement,
  FlowchartAst,
  FlowchartStatement,
  ParseFailure,
  ParseIssue,
  SubgraphStatement,
  VertexStatement,
} from '../../src/mermaid/parser/ast'
import { parseFlowchart } from '../../src/mermaid/parser/flowchart'
import { Tokenizer } from '../../src/mermaid/parser/tokenizer'

/**
 * Phase 3 of 0.6.0 — flowchart parser tests.
 *
 * Verifies the recursive-descent parser produces a correctly-shaped
 * `FlowchartAst` from Mermaid source text. Inputs are drawn from
 * mermaid-js's own `.spec.js` fixtures (attribution lives in
 * `notes/mermaid-grammar-snapshot/`).
 *
 * `parse(s)` is a shorthand that throws on failure (most tests assert
 * happy-path output). `parseExpectingFailure(s)` returns the failure
 * payload so tests can assert on issue kinds + messages without
 * unwrapping.
 */

function parse(input: string): FlowchartAst {
  const result = parseFlowchart(new Tokenizer(input))
  if (!result.ok) {
    throw new Error(
      `parse failed:\n${result.issues
        .map((i) => `  - [${i.kind}] ${i.message} (${i.position.line}:${i.position.column})`)
        .join('\n')}`,
    )
  }
  return result.value
}

function parseExpectingFailure(input: string): ParseFailure {
  const result = parseFlowchart(new Tokenizer(input))
  if (result.ok) {
    throw new Error(`expected parse failure, got success: ${JSON.stringify(result.value)}`)
  }
  return result
}

/**
 * Parse expecting a SUCCESSFUL best-effort import that collected
 * `unsupported` warnings (out-of-scope features degraded / dropped,
 * not a hard failure). Returns the warnings array for assertions.
 */
function parseExpectingWarnings(input: string): readonly ParseIssue[] {
  const result = parseFlowchart(new Tokenizer(input))
  if (!result.ok) {
    throw new Error(
      `expected best-effort success, got failure:\n${result.issues
        .map((i) => `  - [${i.kind}] ${i.message}`)
        .join('\n')}`,
    )
  }
  return result.warnings
}

function vertices(stmts: readonly FlowchartStatement[]): VertexStatement[] {
  return stmts.filter((s): s is VertexStatement => s.kind === 'vertex')
}

function edges(stmts: readonly FlowchartStatement[]): EdgeStatement[] {
  return stmts.filter((s): s is EdgeStatement => s.kind === 'edge')
}

function subgraphs(stmts: readonly FlowchartStatement[]): SubgraphStatement[] {
  return stmts.filter((s): s is SubgraphStatement => s.kind === 'subgraph')
}

describe('flowchart parser — header', () => {
  it('parses bare `flowchart` with default direction TB', () => {
    const ast = parse('flowchart')
    expect(ast.kind).toBe('flowchart')
    expect(ast.direction).toBe('TB')
    expect(ast.statements).toEqual([])
  })

  it('parses `graph` as an alias for `flowchart`', () => {
    const ast = parse('graph')
    expect(ast.kind).toBe('flowchart')
    expect(ast.direction).toBe('TB')
  })

  it('parses every declared direction value', () => {
    for (const dir of ['TB', 'BT', 'LR', 'RL'] as const) {
      const ast = parse(`flowchart ${dir}`)
      expect(ast.direction).toBe(dir)
    }
  })

  it('normalizes `TD` to `TB` (Mermaid treats them as aliases)', () => {
    expect(parse('flowchart TD').direction).toBe('TB')
  })

  it('records the header position for the AST', () => {
    expect(parse('flowchart LR').position).toEqual({ line: 1, column: 1 })
  })

  it("returns a syntax issue if the input doesn't start with a header", () => {
    const failure = parseExpectingFailure('A --> B')
    expect(failure.issues).toHaveLength(1)
    expect(failure.issues[0]?.kind).toBe('syntax')
    expect(failure.issues[0]?.message).toMatch(/flowchart/i)
  })
})

describe('flowchart parser — bare vertex declarations', () => {
  it('parses a single bare vertex `A`', () => {
    const ast = parse('flowchart\nA')
    expect(vertices(ast.statements)).toEqual([
      {
        kind: 'vertex',
        id: 'A',
        shape: 'rect',
        position: { line: 2, column: 1 },
      },
    ])
    expect(edges(ast.statements)).toEqual([])
  })

  it('parses multiple bare vertices on separate lines', () => {
    const ast = parse('flowchart\nA\nB\nC')
    expect(vertices(ast.statements).map((v) => v.id)).toEqual(['A', 'B', 'C'])
  })

  it('tolerates a numeric-only id', () => {
    expect(vertices(parse('flowchart\n1').statements)[0]?.id).toBe('1')
  })
})

describe('flowchart parser — node shape declarations', () => {
  const cases: Array<{
    syntax: string
    shape: VertexStatement['shape']
    label: string
  }> = [
    { syntax: 'A[Start]', shape: 'rect', label: 'Start' },
    { syntax: 'A(Round)', shape: 'round', label: 'Round' },
    { syntax: 'A((Circle))', shape: 'circle', label: 'Circle' },
    { syntax: 'A(((Double)))', shape: 'doublecircle', label: 'Double' },
    { syntax: 'A{Diamond}', shape: 'diamond', label: 'Diamond' },
    { syntax: 'A{{Hex}}', shape: 'hexagon', label: 'Hex' },
    { syntax: 'A([Stadium])', shape: 'stadium', label: 'Stadium' },
    { syntax: 'A[(Cylinder)]', shape: 'cylinder', label: 'Cylinder' },
    { syntax: 'A[[Sub]]', shape: 'subroutine', label: 'Sub' },
    { syntax: 'A>Flag]', shape: 'flag', label: 'Flag' },
  ]

  for (const { syntax, shape, label } of cases) {
    it(`parses ${syntax} as ${shape} with label "${label}"`, () => {
      const ast = parse(`flowchart\n${syntax}`)
      const vs = vertices(ast.statements)
      expect(vs).toHaveLength(1)
      expect(vs[0]).toMatchObject({ id: 'A', shape, label })
    })
  }

  it('handles a label with spaces inside the brackets', () => {
    const v = vertices(parse('flowchart\nA[some label here]').statements)[0]
    expect(v?.label).toBe('some label here')
  })

  it('trims whitespace around the label', () => {
    const v = vertices(parse('flowchart\nA[   padded label   ]').statements)[0]
    expect(v?.label).toBe('padded label')
  })

  it('records the vertex position from the id token', () => {
    const v = vertices(parse('flowchart\n  A[Start]').statements)[0]
    expect(v?.position).toEqual({ line: 2, column: 3 })
  })
})

describe('flowchart parser — edges', () => {
  it('parses every arrow style', () => {
    const cases = [
      { syntax: 'A --> B', style: 'solid', hasArrow: true },
      { syntax: 'A -.-> B', style: 'dotted', hasArrow: true },
      { syntax: 'A ==> B', style: 'thick', hasArrow: true },
    ] as const
    for (const { syntax, style, hasArrow } of cases) {
      const es = edges(parse(`flowchart\n${syntax}`).statements)
      expect(es).toHaveLength(1)
      expect(es[0]).toMatchObject({ from: 'A', to: 'B', style, hasArrow })
    }
  })

  it('parses every line (no-arrow) style', () => {
    const cases = [
      { syntax: 'A --- B', style: 'solid' },
      { syntax: 'A -.- B', style: 'dotted' },
      { syntax: 'A === B', style: 'thick' },
      { syntax: 'A ~~~ B', style: 'invisible' },
    ] as const
    for (const { syntax, style } of cases) {
      const es = edges(parse(`flowchart\n${syntax}`).statements)
      expect(es).toHaveLength(1)
      expect(es[0]).toMatchObject({ from: 'A', to: 'B', style, hasArrow: false })
    }
  })

  it('parses pipe-style edge labels', () => {
    const es = edges(parse('flowchart\nA -->|click| B').statements)
    expect(es).toHaveLength(1)
    expect(es[0]).toMatchObject({ from: 'A', to: 'B', label: 'click', hasArrow: true })
  })

  it('parses mid-edge text labels (`A -- text -->`)', () => {
    const es = edges(parse('flowchart\nA -- click --> B').statements)
    expect(es).toHaveLength(1)
    expect(es[0]).toMatchObject({ from: 'A', to: 'B', label: 'click', hasArrow: true })
  })

  it('parses dotted mid-edge text label (`A -. text .-> B`)', () => {
    const es = edges(parse('flowchart\nA -. click .-> B').statements)
    expect(es).toHaveLength(1)
    expect(es[0]).toMatchObject({ from: 'A', to: 'B', label: 'click', style: 'dotted' })
  })

  it('parses thick mid-edge text label (`A == text ==> B`)', () => {
    const es = edges(parse('flowchart\nA == click ==> B').statements)
    expect(es).toHaveLength(1)
    expect(es[0]).toMatchObject({ from: 'A', to: 'B', label: 'click', style: 'thick' })
  })

  it('parses a mid-edge label that closes with `---` (no arrow)', () => {
    const es = edges(parse('flowchart\nA -- text --- B').statements)
    expect(es).toHaveLength(1)
    expect(es[0]).toMatchObject({ from: 'A', to: 'B', label: 'text', hasArrow: false })
  })
})

describe('flowchart parser — edge chains', () => {
  it('parses `A --> B --> C` as two edges + three vertices', () => {
    const ast = parse('flowchart\nA --> B --> C')
    expect(vertices(ast.statements).map((v) => v.id)).toEqual(['A', 'B', 'C'])
    expect(edges(ast.statements).map((e) => [e.from, e.to])).toEqual([
      ['A', 'B'],
      ['B', 'C'],
    ])
  })

  it('parses `A[label] --> B((label))` preserving shapes', () => {
    const ast = parse('flowchart\nA[Start] --> B((End))')
    const vs = vertices(ast.statements)
    expect(vs).toHaveLength(2)
    expect(vs[0]).toMatchObject({ id: 'A', shape: 'rect', label: 'Start' })
    expect(vs[1]).toMatchObject({ id: 'B', shape: 'circle', label: 'End' })
  })

  it('parses a long chain with mixed shapes and edge styles', () => {
    const ast = parse('flowchart\nA[X] --> B(Y) -.-> C{Z} ==> D')
    const vs = vertices(ast.statements)
    const es = edges(ast.statements)
    expect(vs.map((v) => v.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(es.map((e) => e.style)).toEqual(['solid', 'dotted', 'thick'])
  })
})

describe('flowchart parser — multiple statements', () => {
  it('parses each declaration on its own line', () => {
    const input = 'flowchart\nA[Start]\nB[End]\nA --> B'
    const ast = parse(input)
    expect(vertices(ast.statements).map((v) => v.id)).toEqual(['A', 'B', 'A', 'B'])
    expect(edges(ast.statements)).toHaveLength(1)
  })

  it('tolerates blank lines and comments between statements', () => {
    const input = `flowchart
%% pipeline
A --> B

%% intermission
B --> C`
    const ast = parse(input)
    expect(edges(ast.statements)).toHaveLength(2)
  })

  it('tolerates `;` as a statement separator', () => {
    const ast = parse('flowchart;A --> B;B --> C')
    expect(edges(ast.statements)).toHaveLength(2)
  })
})

describe('flowchart parser — unsupported features warn (best-effort import)', () => {
  // Out-of-scope features are well-formed Mermaid, so the parse SUCCEEDS
  // with the feature dropped/degraded and an `unsupported` warning —
  // not a hard failure. (The `fromMermaid` converter turns these
  // warnings into one console.warn per dropped-feature kind.)
  it('warns on `style` directives', () => {
    const warnings = parseExpectingWarnings('flowchart\nA --> B\nstyle A fill:#f00')
    expect(warnings.some((i) => /style/i.test(i.message))).toBe(true)
  })

  it('warns on `classDef`', () => {
    const warnings = parseExpectingWarnings('flowchart\nclassDef warn fill:#f99')
    expect(warnings.some((i) => /classDef/i.test(i.message))).toBe(true)
  })

  it('warns on `click` interactivity', () => {
    const warnings = parseExpectingWarnings('flowchart\nA --> B\nclick A "https://example.com"')
    expect(warnings.some((i) => /click/i.test(i.message))).toBe(true)
  })

  it('warns on trapezoid `[/...\\]` but still produces the node as a rect', () => {
    const result = parseFlowchart(new Tokenizer('flowchart\nA[/trap\\]'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings.some((i) => /trapezoid/i.test(i.message))).toBe(true)
    expect(vertices(result.value.statements)[0]).toMatchObject({ id: 'A', shape: 'rect' })
  })

  it('warns on ellipse `(-...-)`', () => {
    const warnings = parseExpectingWarnings('flowchart\nA(-ellipse-)')
    expect(warnings.some((i) => /ellipse/i.test(i.message))).toBe(true)
  })

  it('collects all warnings from a single parse (multi-warning reporting)', () => {
    const warnings = parseExpectingWarnings(`flowchart
style A fill:#f00
classDef warn fill:#f99
click A "url"`)
    expect(warnings.length).toBeGreaterThanOrEqual(3)
  })

  it('every warning carries an accurate source position', () => {
    const warnings = parseExpectingWarnings('flowchart\n  style A fill:#f00')
    const issue = warnings.find((i) => /style/i.test(i.message))
    expect(issue?.position).toEqual({ line: 2, column: 3 })
  })
})

describe('flowchart parser — syntax error positions', () => {
  it('reports syntax-error positions accurately', () => {
    const failure = parseExpectingFailure('A --> B')
    expect(failure.issues[0]?.position).toEqual({ line: 1, column: 1 })
  })
})

describe('flowchart parser — smoke from Mermaid fixture corpus', () => {
  it('parses the classic three-tier flowchart sample', () => {
    const input = `flowchart LR
browser[Browser] --> api[API Gateway]
api -.-> web[Web Service]
web --> db[(Database)]`
    const ast = parse(input)
    expect(ast.direction).toBe('LR')
    const vs = vertices(ast.statements)
    expect(vs.map((v) => v.id)).toEqual(['browser', 'api', 'api', 'web', 'web', 'db'])
    expect(vs[0]).toMatchObject({ shape: 'rect', label: 'Browser' })
    expect(vs[5]).toMatchObject({ shape: 'cylinder', label: 'Database' })
    expect(edges(ast.statements).map((e) => e.style)).toEqual(['solid', 'dotted', 'solid'])
  })

  it("parses Mermaid's flow-edges.spec.js style chain", () => {
    const input = 'flowchart\nA --> B --> C --> D --> E'
    const ast = parse(input)
    expect(edges(ast.statements)).toHaveLength(4)
  })
})

describe('flowchart parser — subgraphs (Phase 4)', () => {
  it('parses a simple subgraph with id-only header', () => {
    const ast = parse('flowchart\nsubgraph G1\nA --> B\nend')
    const sgs = subgraphs(ast.statements)
    expect(sgs).toHaveLength(1)
    expect(sgs[0]?.id).toBe('G1')
    expect(sgs[0]?.label).toBeUndefined()
    expect(vertices(sgs[0]!.statements).map((v) => v.id)).toEqual(['A', 'B'])
    expect(edges(sgs[0]!.statements)).toHaveLength(1)
  })

  it('parses a subgraph with `subgraph X[label]` bracketed title', () => {
    const ast = parse('flowchart\nsubgraph G1[Group One]\nA --> B\nend')
    const sgs = subgraphs(ast.statements)
    expect(sgs).toHaveLength(1)
    expect(sgs[0]).toMatchObject({ id: 'G1', label: 'Group One' })
  })

  it('parses a subgraph with a quoted-string header (id == label)', () => {
    const ast = parse('flowchart\nsubgraph "Group with spaces"\nA\nend')
    const sgs = subgraphs(ast.statements)
    expect(sgs).toHaveLength(1)
    expect(sgs[0]).toMatchObject({ id: 'Group with spaces', label: 'Group with spaces' })
  })

  it('parses an empty subgraph body', () => {
    const ast = parse('flowchart\nsubgraph G1\nend')
    const sgs = subgraphs(ast.statements)
    expect(sgs[0]?.statements).toEqual([])
  })

  it('mixes top-level statements with subgraph blocks', () => {
    const ast = parse(`flowchart
A --> B
subgraph cluster1
C --> D
end
E --> F`)
    expect(subgraphs(ast.statements)).toHaveLength(1)
    expect(edges(ast.statements.filter((s) => s.kind !== 'subgraph'))).toHaveLength(2)
    expect(edges(subgraphs(ast.statements)[0]!.statements)).toHaveLength(1)
  })

  it('flattens nested subgraphs with one unsupported warn per nesting level', () => {
    const result = parseFlowchart(
      new Tokenizer(`flowchart
subgraph Outer
A --> B
subgraph Inner
X --> Y
end
end`),
    )
    // Nested subgraph is best-effort flattened — parse SUCCEEDS with a
    // warning, and the inner subgraph's children lift into the outer one.
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const nestedWarn = result.warnings.find((i) => /nested subgraph/i.test(i.message))
    expect(nestedWarn).toBeDefined()
    // Outer cluster now holds both A→B and the flattened X→Y.
    const outer = subgraphs(result.value.statements)[0]
    expect(edges(outer!.statements)).toHaveLength(2)
  })

  it('warns on `direction` inside a subgraph body but still parses the body', () => {
    const result = parseFlowchart(
      new Tokenizer(`flowchart
subgraph G1
direction LR
A --> B
end`),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings.some((i) => /per-subgraph.*direction/i.test(i.message))).toBe(true)
    expect(edges(subgraphs(result.value.statements)[0]!.statements)).toHaveLength(1)
  })

  it('reports a syntax error when a subgraph is never closed by `end`', () => {
    const failure = parseExpectingFailure('flowchart\nsubgraph G1\nA --> B')
    expect(failure.issues.some((i) => i.kind === 'syntax' && /never closed/i.test(i.message))).toBe(
      true,
    )
  })

  it('reports a syntax error for `end` outside a subgraph block', () => {
    const failure = parseExpectingFailure('flowchart\nA --> B\nend')
    expect(
      failure.issues.some((i) => i.kind === 'syntax' && /unexpected.*end/i.test(i.message)),
    ).toBe(true)
  })

  it('auto-generates an id when `subgraph` has no name', () => {
    const ast = parse('flowchart\nsubgraph\nA --> B\nend')
    const sgs = subgraphs(ast.statements)
    expect(sgs[0]?.id).toMatch(/^__sg_\d+__$/)
  })
})
