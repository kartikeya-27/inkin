import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromMermaid } from '../../src/mermaid/from-mermaid'
import { toMermaid } from '../../src/mermaid/to-mermaid'
import { parse } from '../../src/schema/validate'

/**
 * Phase 7 of 0.6.0 — `toMermaid` emitter tests.
 *
 * Asserts the canonical Mermaid output forms for each node shape, edge
 * style, and cluster, plus the `flows` drop-with-warn and a handful of
 * round-trip smoke checks (the full round-trip suite is Phase 8).
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe('toMermaid — header', () => {
  it('emits a `flowchart TB` header by default', () => {
    const d = parse({ schemaVersion: 1, nodes: [{ id: 'a', label: 'A' }], edges: [] })
    expect(toMermaid(d).split('\n')[0]).toBe('flowchart TB')
  })

  it('honors a direction option', () => {
    const d = parse({ schemaVersion: 1, nodes: [], edges: [] })
    expect(toMermaid(d, { direction: 'LR' }).split('\n')[0]).toBe('flowchart LR')
  })
})

describe('toMermaid — node shapes', () => {
  it('emits a rect node as `id[label]`', () => {
    const d = parse({
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'Start', shape: 'rect' }],
      edges: [],
    })
    expect(toMermaid(d)).toContain('a[Start]')
  })

  it('emits a terminal node as `id((label))`', () => {
    const d = parse({
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'End', shape: 'terminal' }],
      edges: [],
    })
    expect(toMermaid(d)).toContain('a((End))')
  })

  it('emits an empty-label terminal node as `id(())`', () => {
    const d = parse({
      schemaVersion: 1,
      nodes: [{ id: '__start__', label: '', shape: 'terminal' }],
      edges: [],
    })
    expect(toMermaid(d)).toContain('__start__(())')
  })
})

describe('toMermaid — edges', () => {
  it('emits a solid edge as `from --> to`', () => {
    const d = parse({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', style: 'solid' }],
    })
    expect(toMermaid(d)).toContain('a --> b')
  })

  it('emits a dashed edge as `from -.-> to`', () => {
    const d = parse({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', style: 'dashed' }],
    })
    expect(toMermaid(d)).toContain('a -.-> b')
  })

  it('emits an edge label as a pipe label', () => {
    const d = parse({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'go', style: 'solid' }],
    })
    expect(toMermaid(d)).toContain('a -->|go| b')
  })
})

describe('toMermaid — clusters', () => {
  it('emits a cluster as a subgraph with its child nodes inside', () => {
    const d = parse({
      schemaVersion: 1,
      clusters: [{ id: 'g1', label: 'Group One' }],
      nodes: [
        { id: 'a', label: 'A', cluster: 'g1' },
        { id: 'b', label: 'B' },
      ],
      edges: [],
    })
    const out = toMermaid(d)
    expect(out).toContain('subgraph g1[Group One]')
    expect(out).toContain('end')
    // `a` is declared inside the subgraph; `b` at the top level.
    const lines = out.split('\n')
    const sgIdx = lines.indexOf('subgraph g1[Group One]')
    const endIdx = lines.indexOf('end')
    const insideBlock = lines.slice(sgIdx + 1, endIdx).join('\n')
    expect(insideBlock).toContain('a[A]')
    expect(insideBlock).not.toContain('b[B]')
  })

  it('omits the bracket when a cluster label equals its id', () => {
    const d = parse({
      schemaVersion: 1,
      clusters: [{ id: 'notes', label: 'notes' }],
      nodes: [{ id: 'a', label: 'A', cluster: 'notes' }],
      edges: [],
    })
    expect(toMermaid(d)).toContain('subgraph notes\n')
  })
})

describe('toMermaid — flows are dropped with a warn', () => {
  it('warns once and emits no flow syntax', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = parse({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ id: 'a->b', from: 'a', to: 'b' }],
      flows: [{ id: 'f', edges: ['a->b'] }],
    })
    const out = toMermaid(d)
    expect(warn.mock.calls.some((c) => /flows/i.test(String(c[0])))).toBe(true)
    expect(out).not.toMatch(/flow\b(?!chart)/i)
  })

  it('does not warn when there are no flows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = parse({ schemaVersion: 1, nodes: [{ id: 'a', label: 'A' }], edges: [] })
    toMermaid(d)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('toMermaid — round-trip smoke (full suite in Phase 8)', () => {
  it('a simple flowchart round-trips to an equal Diagram', () => {
    const original = fromMermaid('flowchart\nA[Start] --> B[Middle] -.-> C((End))')
    expect(original.ok).toBe(true)
    if (!original.ok) return
    const text = toMermaid(original.diagram)
    const round = fromMermaid(text)
    expect(round.ok).toBe(true)
    if (!round.ok) return
    expect(round.diagram).toEqual(original.diagram)
  })

  it('a clustered flowchart round-trips', () => {
    const original = fromMermaid(`flowchart
subgraph g1[Group One]
A[A] --> B[B]
end
B --> C[C]`)
    expect(original.ok).toBe(true)
    if (!original.ok) return
    const round = fromMermaid(toMermaid(original.diagram))
    expect(round.ok).toBe(true)
    if (!round.ok) return
    expect(round.diagram).toEqual(original.diagram)
  })
})
