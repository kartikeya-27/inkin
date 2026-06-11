import { describe, expect, it } from 'vitest'
import type {
  EdgeStatement,
  FlowchartAst,
  FlowchartStatement,
  ParseFailure,
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

function vertices(stmts: readonly FlowchartStatement[]): VertexStatement[] {
  return stmts.filter((s): s is VertexStatement => s.kind === 'vertex')
}

function edges(stmts: readonly FlowchartStatement[]): EdgeStatement[] {
  return stmts.filter((s): s is EdgeStatement => s.kind === 'edge')
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

describe('flowchart parser — unsupported features (per Phase 1 spec)', () => {
  it('returns an unsupported issue for `style` directives', () => {
    const failure = parseExpectingFailure('flowchart\nA --> B\nstyle A fill:#f00')
    expect(failure.issues.some((i) => i.kind === 'unsupported' && /style/i.test(i.message))).toBe(
      true,
    )
  })

  it('returns an unsupported issue for `classDef`', () => {
    const failure = parseExpectingFailure('flowchart\nclassDef warn fill:#f99')
    expect(
      failure.issues.some((i) => i.kind === 'unsupported' && /classDef/i.test(i.message)),
    ).toBe(true)
  })

  it('returns an unsupported issue for `click` interactivity', () => {
    const failure = parseExpectingFailure('flowchart\nA --> B\nclick A "https://example.com"')
    expect(failure.issues.some((i) => i.kind === 'unsupported' && /click/i.test(i.message))).toBe(
      true,
    )
  })

  it('returns an unsupported issue for trapezoid `[/...\\]`', () => {
    const failure = parseExpectingFailure('flowchart\nA[/trap\\]')
    expect(
      failure.issues.some((i) => i.kind === 'unsupported' && /trapezoid/i.test(i.message)),
    ).toBe(true)
  })

  it('returns an unsupported issue for ellipse `(-...-)`', () => {
    const failure = parseExpectingFailure('flowchart\nA(-ellipse-)')
    expect(failure.issues.some((i) => i.kind === 'unsupported' && /ellipse/i.test(i.message))).toBe(
      true,
    )
  })

  it('returns an unsupported issue for subgraphs (Phase 4 placeholder)', () => {
    const failure = parseExpectingFailure('flowchart\nsubgraph X\nA --> B\nend')
    expect(
      failure.issues.some((i) => i.kind === 'unsupported' && /subgraph/i.test(i.message)),
    ).toBe(true)
  })

  it('collects all issues from a single parse (multi-error reporting)', () => {
    const failure = parseExpectingFailure(`flowchart
style A fill:#f00
classDef warn fill:#f99
click A "url"`)
    expect(failure.issues.length).toBeGreaterThanOrEqual(3)
  })
})

describe('flowchart parser — error positions', () => {
  it('reports the column of the offending token for unsupported features', () => {
    const failure = parseExpectingFailure('flowchart\n  style A fill:#f00')
    const issue = failure.issues.find((i) => i.kind === 'unsupported')
    expect(issue?.position.line).toBe(2)
    expect(issue?.position.column).toBe(3)
  })

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
