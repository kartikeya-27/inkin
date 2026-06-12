import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromMermaid } from '../../src/mermaid/from-mermaid'
import type { Diagram } from '../../src/schema/types'

/**
 * Phase 6 of 0.6.0 — `fromMermaid` converter tests.
 *
 * Asserts the AST → inkin `Diagram` conversion: shape/edge mappings,
 * lossy `console.warn` behavior (one per kind per call), cluster /
 * compound flattening, parallel-edge id disambiguation, `[*]` sentinel
 * materialization, and the final `safeParse` gate.
 *
 * `convert(s)` unwraps the success diagram (throws on failure).
 */

function convert(input: string): Diagram {
  const result = fromMermaid(input)
  if (!result.ok) {
    throw new Error(
      `fromMermaid failed:\n${result.issues.map((i) => `  - [${i.kind}] ${i.message}`).join('\n')}`,
    )
  }
  return result.diagram
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fromMermaid — diagram-kind detection', () => {
  it('parses a flowchart header', () => {
    expect(convert('flowchart\nA --> B').schemaVersion).toBe(1)
  })

  it('parses a `graph` header', () => {
    expect(convert('graph LR\nA --> B').schemaVersion).toBe(1)
  })

  it('parses a stateDiagram header', () => {
    expect(convert('stateDiagram-v2\nA --> B').schemaVersion).toBe(1)
  })

  it('tolerates leading comments and blank lines before the header', () => {
    expect(convert('%% a comment\n\nflowchart\nA --> B').schemaVersion).toBe(1)
  })

  it('fails with a syntax issue on an unrecognized header', () => {
    const result = fromMermaid('sequenceDiagram\nAlice->>Bob: hi')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.kind).toBe('syntax')
    expect(result.issues[0]?.message).toMatch(/header/i)
  })

  it('fails on malformed input (unclosed bracket)', () => {
    const result = fromMermaid('flowchart\nA[unclosed')
    expect(result.ok).toBe(false)
  })
})

describe('fromMermaid — flowchart nodes', () => {
  it('converts a simple two-node edge', () => {
    const d = convert('flowchart\nA[Start] --> B[End]')
    expect(d.nodes).toHaveLength(2)
    expect(d.nodes[0]).toMatchObject({ id: 'A', label: 'Start', shape: 'rect' })
    expect(d.nodes[1]).toMatchObject({ id: 'B', label: 'End', shape: 'rect' })
    expect(d.edges).toHaveLength(1)
    expect(d.edges[0]).toMatchObject({ from: 'A', to: 'B', style: 'solid' })
  })

  it('uses the node id as the label when no bracket label is given', () => {
    const d = convert('flowchart\nA --> B')
    expect(d.nodes[0]).toMatchObject({ id: 'A', label: 'A' })
  })

  it('maps circle and double-circle to terminal (faithful, no warn)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = convert('flowchart\nA((c)) --> B(((d)))')
    expect(d.nodes[0]).toMatchObject({ id: 'A', shape: 'terminal' })
    expect(d.nodes[1]).toMatchObject({ id: 'B', shape: 'terminal' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('de-dups a node that appears both shaped and bare, preferring the explicit form', () => {
    // `A` is bare in the first edge, then explicitly `A[Real Label]`.
    const d = convert('flowchart\nA --> B\nA[Real Label]')
    const a = d.nodes.find((n) => n.id === 'A')
    expect(a?.label).toBe('Real Label')
    // Only one A node total.
    expect(d.nodes.filter((n) => n.id === 'A')).toHaveLength(1)
  })
})

describe('fromMermaid — lossy shape mappings warn once per kind', () => {
  it('warns once for round-rectangle, mapping to rect', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = convert('flowchart\nA(one) --> B(two) --> C(three)')
    expect(d.nodes.every((n) => n.shape === 'rect')).toBe(true)
    const roundWarns = warn.mock.calls.filter((c) => /round-rectangle/i.test(String(c[0])))
    // Three round nodes → exactly one warning.
    expect(roundWarns).toHaveLength(1)
  })

  it('warns for diamond, hexagon, cylinder, subroutine, stadium, flag', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    convert(`flowchart
A{diamond}
B{{hex}}
C[(cyl)]
D[[sub]]
E([stad])
F>flag]`)
    const joined = warn.mock.calls.map((c) => String(c[0])).join('\n')
    expect(joined).toMatch(/diamond/i)
    expect(joined).toMatch(/hexagon/i)
    expect(joined).toMatch(/cylinder/i)
    expect(joined).toMatch(/subroutine/i)
    expect(joined).toMatch(/stadium/i)
    expect(joined).toMatch(/flag/i)
  })
})

describe('fromMermaid — edge styles', () => {
  it('maps dotted to dashed (faithful)', () => {
    const d = convert('flowchart\nA -.-> B')
    expect(d.edges[0]?.style).toBe('dashed')
  })

  it('maps thick to solid with a warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = convert('flowchart\nA ==> B')
    expect(d.edges[0]?.style).toBe('solid')
    expect(warn.mock.calls.some((c) => /thick/i.test(String(c[0])))).toBe(true)
  })

  it('warns about lost no-arrow semantics for `---`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    convert('flowchart\nA --- B')
    expect(warn.mock.calls.some((c) => /no-arrow/i.test(String(c[0])))).toBe(true)
  })

  it('carries edge labels through', () => {
    const d = convert('flowchart\nA -->|click| B')
    expect(d.edges[0]?.label).toBe('click')
  })
})

describe('fromMermaid — subgraphs become clusters', () => {
  it('creates a cluster and assigns its children', () => {
    const d = convert(`flowchart
subgraph G1[Group One]
A --> B
end
C --> A`)
    expect(d.clusters).toHaveLength(1)
    expect(d.clusters?.[0]).toMatchObject({ id: 'G1', label: 'Group One' })
    const a = d.nodes.find((n) => n.id === 'A')
    const b = d.nodes.find((n) => n.id === 'B')
    expect(a?.cluster).toBe('G1')
    expect(b?.cluster).toBe('G1')
    // C is outside the subgraph.
    expect(d.nodes.find((n) => n.id === 'C')?.cluster).toBeUndefined()
  })

  it('emits no clusters field when there are no subgraphs', () => {
    const d = convert('flowchart\nA --> B')
    expect(d.clusters).toBeUndefined()
  })
})

describe('fromMermaid — parallel edges get disambiguating ids', () => {
  it('assigns explicit ids to two edges between the same pair', () => {
    const d = convert('flowchart\nA --> B\nA --> B')
    expect(d.edges).toHaveLength(2)
    expect(d.edges[0]?.id).toBe('A->B')
    expect(d.edges[1]?.id).toBe('A->B#2')
  })

  it('leaves a single edge without an explicit id (auto-derived)', () => {
    const d = convert('flowchart\nA --> B')
    expect(d.edges[0]?.id).toBeUndefined()
  })
})

describe('fromMermaid — state diagrams', () => {
  it('converts transitions to edges and states to nodes', () => {
    const d = convert(`stateDiagram-v2
[*] --> Pending
Pending --> Running : dequeue
Running --> [*]`)
    // Sentinels materialize as terminal nodes.
    const start = d.nodes.find((n) => n.id === '__start__')
    const end = d.nodes.find((n) => n.id === '__end__')
    expect(start).toMatchObject({ shape: 'terminal' })
    expect(end).toMatchObject({ shape: 'terminal' })
    expect(d.nodes.find((n) => n.id === 'Pending')).toBeDefined()
    expect(d.edges.find((e) => e.from === 'Pending' && e.to === 'Running')?.label).toBe('dequeue')
  })

  it('converts `state "Name" as X` to a labeled node', () => {
    const d = convert('stateDiagram-v2\nstate "Active state" as Active\nActive --> Idle')
    expect(d.nodes.find((n) => n.id === 'Active')?.label).toBe('Active state')
  })

  it('converts a compound state to a cluster with children', () => {
    const d = convert(`stateDiagram-v2
state Active {
  Running --> Idle
}`)
    expect(d.clusters?.[0]?.id).toBe('Active')
    expect(d.nodes.find((n) => n.id === 'Running')?.cluster).toBe('Active')
  })

  it('warns on pseudostates mapping to rect', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = convert('stateDiagram-v2\nstate ch <<choice>>\nch --> A')
    expect(d.nodes.find((n) => n.id === 'ch')?.shape).toBe('rect')
    expect(warn.mock.calls.some((c) => /choice/i.test(String(c[0])))).toBe(true)
  })
})

describe('fromMermaid — output validates against the schema', () => {
  it('produces a Diagram that round-trips through the converter cleanly', () => {
    // If safeParse rejected the converted output, fromMermaid would
    // return ok:false. Asserting ok:true is asserting schema validity.
    const result = fromMermaid(`flowchart LR
subgraph edge[Edge]
browser[Browser] --> cdn[CDN]
end
browser --> api[API]
api -.-> db[(Database)]`)
    expect(result.ok).toBe(true)
  })

  it('direction other than TB triggers a warn (not stored on the Diagram)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    convert('flowchart LR\nA --> B')
    expect(warn.mock.calls.some((c) => /direction/i.test(String(c[0])))).toBe(true)
  })
})
