import { describe, expect, it } from 'vitest'
import type {
  ParseFailure,
  StateCompound,
  StateDecl,
  StateDiagramAst,
  StateStatement,
  StateTransition,
} from '../../src/mermaid/parser/ast'
import { parseStateDiagram } from '../../src/mermaid/parser/state'
import { Tokenizer } from '../../src/mermaid/parser/tokenizer'

/**
 * Phase 5 of 0.6.0 — state-diagram parser tests.
 *
 * Inputs adapted from mermaid-js's own `state-parser.spec.js`
 * fixtures (attribution under `notes/mermaid-grammar-snapshot/`).
 */

function parse(input: string): StateDiagramAst {
  const result = parseStateDiagram(new Tokenizer(input))
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
  const result = parseStateDiagram(new Tokenizer(input))
  if (result.ok) {
    throw new Error(`expected parse failure, got success: ${JSON.stringify(result.value)}`)
  }
  return result
}

function states(stmts: readonly StateStatement[]): StateDecl[] {
  return stmts.filter((s): s is StateDecl => s.kind === 'state')
}

function transitions(stmts: readonly StateStatement[]): StateTransition[] {
  return stmts.filter((s): s is StateTransition => s.kind === 'transition')
}

function compounds(stmts: readonly StateStatement[]): StateCompound[] {
  return stmts.filter((s): s is StateCompound => s.kind === 'compound')
}

describe('state-diagram parser — header', () => {
  it('parses `stateDiagram`', () => {
    const ast = parse('stateDiagram')
    expect(ast.kind).toBe('stateDiagram')
    expect(ast.direction).toBe('TB')
    expect(ast.statements).toEqual([])
  })

  it('parses `stateDiagram-v2` identically', () => {
    expect(parse('stateDiagram-v2').kind).toBe('stateDiagram')
  })

  it('parses a direction header', () => {
    expect(parse('stateDiagram-v2\ndirection LR').direction).toBe('LR')
  })

  it('returns a syntax issue without the header', () => {
    const failure = parseExpectingFailure('A --> B')
    expect(failure.issues[0]?.kind).toBe('syntax')
    expect(failure.issues[0]?.message).toMatch(/stateDiagram/i)
  })
})

describe('state-diagram parser — transitions', () => {
  it('parses a basic transition', () => {
    const ast = parse('stateDiagram-v2\nA --> B')
    const ts = transitions(ast.statements)
    expect(ts).toHaveLength(1)
    expect(ts[0]).toMatchObject({ from: 'A', to: 'B' })
  })

  it('parses a transition with a colon-delimited event label', () => {
    const ast = parse('stateDiagram-v2\nA --> B : on_click')
    const ts = transitions(ast.statements)
    expect(ts[0]).toMatchObject({ from: 'A', to: 'B', description: 'on_click' })
  })

  it('parses an event label with spaces', () => {
    const ast = parse('stateDiagram-v2\nIdle --> Running : start the job')
    expect(transitions(ast.statements)[0]?.description).toBe('start the job')
  })

  it('maps `[*] --> A` to a start-sentinel transition', () => {
    const ts = transitions(parse('stateDiagram-v2\n[*] --> Active').statements)
    expect(ts[0]).toMatchObject({ from: '__start__', to: 'Active' })
  })

  it('maps `A --> [*]` to an end-sentinel transition', () => {
    const ts = transitions(parse('stateDiagram-v2\nActive --> [*]').statements)
    expect(ts[0]).toMatchObject({ from: 'Active', to: '__end__' })
  })

  it('emits implicit state declarations for both transition endpoints', () => {
    const ast = parse('stateDiagram-v2\nA --> B')
    expect(states(ast.statements).map((s) => s.id)).toEqual(['A', 'B'])
  })

  it('does not emit an implicit state for the `[*]` sentinel', () => {
    const ast = parse('stateDiagram-v2\n[*] --> A')
    // Only `A` should get an implicit state, not the start sentinel.
    expect(states(ast.statements).map((s) => s.id)).toEqual(['A'])
  })
})

describe('state-diagram parser — state declarations', () => {
  it('parses a plain `state X` declaration', () => {
    const ss = states(parse('stateDiagram-v2\nstate Active').statements)
    expect(ss).toHaveLength(1)
    expect(ss[0]).toMatchObject({ id: 'Active', type: 'normal' })
  })

  it('parses `state "Friendly name" as X`', () => {
    const ss = states(parse('stateDiagram-v2\nstate "Active state" as Active').statements)
    expect(ss[0]).toMatchObject({ id: 'Active', label: 'Active state', type: 'normal' })
  })

  it('parses a bare reference `X` as an implicit state', () => {
    const ss = states(parse('stateDiagram-v2\nActive').statements)
    expect(ss[0]).toMatchObject({ id: 'Active', type: 'normal' })
  })

  it('parses `X : description` as a state with a label', () => {
    const ss = states(parse('stateDiagram-v2\nActive : currently running').statements)
    expect(ss[0]).toMatchObject({ id: 'Active', label: 'currently running' })
  })

  it.each([
    ['choice', 'choice'],
    ['fork', 'fork'],
    ['join', 'join'],
  ] as Array<[string, StateDecl['type']]>)('parses pseudostate <<%s>>', (keyword, type) => {
    const ss = states(parse(`stateDiagram-v2\nstate s1 <<${keyword}>>`).statements)
    expect(ss[0]).toMatchObject({ id: 's1', type })
  })

  it('warns on an unknown pseudostate but still produces a state', () => {
    const result = parseStateDiagram(new Tokenizer('stateDiagram-v2\nstate s1 <<bogus>>'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(
      result.issues.some((i) => i.kind === 'unsupported' && /pseudostate/i.test(i.message)),
    ).toBe(true)
  })
})

describe('state-diagram parser — compound states', () => {
  it('parses `state X { ... }` as a compound with children', () => {
    const ast = parse(`stateDiagram-v2
state Active {
  [*] --> Running
  Running --> Idle
}`)
    const cs = compounds(ast.statements)
    expect(cs).toHaveLength(1)
    expect(cs[0]?.id).toBe('Active')
    expect(transitions(cs[0]!.statements)).toHaveLength(2)
  })

  it('parses an empty compound body', () => {
    const ast = parse('stateDiagram-v2\nstate Empty {\n}')
    expect(compounds(ast.statements)[0]?.statements).toEqual([])
  })

  it('flattens nested compound states with one warn per level', () => {
    const result = parseStateDiagram(
      new Tokenizer(`stateDiagram-v2
state Outer {
  A --> B
  state Inner {
    X --> Y
  }
}`),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(
      result.issues.some((i) => i.kind === 'unsupported' && /nested compound/i.test(i.message)),
    ).toBe(true)
  })

  it('reports a syntax error when a compound is never closed', () => {
    const failure = parseExpectingFailure('stateDiagram-v2\nstate Active {\nA --> B')
    expect(failure.issues.some((i) => i.kind === 'syntax' && /never closed/i.test(i.message))).toBe(
      true,
    )
  })
})

describe('state-diagram parser — unsupported features', () => {
  it('records an unsupported issue for `note left of`', () => {
    const failure = parseExpectingFailure('stateDiagram-v2\nA --> B\nnote left of A : a note')
    expect(failure.issues.some((i) => i.kind === 'unsupported' && /note/i.test(i.message))).toBe(
      true,
    )
  })

  it('records an unsupported issue for the `--` concurrency divider', () => {
    const failure = parseExpectingFailure(`stateDiagram-v2
state Fork {
  A --> B
  --
  C --> D
}`)
    expect(
      failure.issues.some((i) => i.kind === 'unsupported' && /concurrency/i.test(i.message)),
    ).toBe(true)
  })

  it('silently skips `hide empty description` (rendering hint, no warn)', () => {
    const ast = parse('stateDiagram-v2\nhide empty description\nA --> B')
    expect(transitions(ast.statements)).toHaveLength(1)
  })

  it('records an unsupported issue for classDef', () => {
    const failure = parseExpectingFailure('stateDiagram-v2\nclassDef foo fill:#f00')
    expect(
      failure.issues.some((i) => i.kind === 'unsupported' && /classDef/i.test(i.message)),
    ).toBe(true)
  })
})

describe('state-diagram parser — comments + blank lines', () => {
  it('tolerates `%%` comments and blank lines', () => {
    const ast = parse(`stateDiagram-v2
%% the lifecycle
[*] --> Idle

%% work happens here
Idle --> Running : start
Running --> [*] : done`)
    expect(transitions(ast.statements)).toHaveLength(3)
  })
})

describe('state-diagram parser — fixture smoke (the lifecycle sample)', () => {
  it('parses a complete small state machine', () => {
    const ast = parse(`stateDiagram-v2
[*] --> Pending
Pending --> Running : dequeue
Running --> Complete : success
Running --> Failed : error
Complete --> [*]
Failed --> [*]`)
    const ts = transitions(ast.statements)
    expect(ts).toHaveLength(6)
    expect(ts[0]).toMatchObject({ from: '__start__', to: 'Pending' })
    expect(ts[1]).toMatchObject({ from: 'Pending', to: 'Running', description: 'dequeue' })
    // Every non-sentinel state should appear as an implicit declaration.
    const ids = new Set(states(ast.statements).map((s) => s.id))
    expect(ids).toContain('Pending')
    expect(ids).toContain('Running')
    expect(ids).toContain('Complete')
    expect(ids).toContain('Failed')
  })
})
