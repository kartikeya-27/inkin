import { describe, expect, it } from 'vitest'
import { type Diagram, InkinValidationError, parse, safeParse } from '../src/schema'

const minimal: Diagram = {
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'A', shape: 'rect' },
    { id: 'b', label: 'B', shape: 'rect' },
  ],
  edges: [{ from: 'a', to: 'b', style: 'solid' }],
}

const taskitoStyleArchitecture: Diagram = {
  schemaVersion: 1,
  clusters: [
    { id: 'edge', label: 'edge' },
    { id: 'app', label: 'application' },
    { id: 'data', label: 'data' },
  ],
  nodes: [
    { id: 'browser', label: 'Browser', sublabel: 'client', cluster: 'edge', shape: 'rect' },
    { id: 'cdn', label: 'CDN', sublabel: 'static assets', cluster: 'edge', shape: 'rect' },
    { id: 'api', label: 'API Gateway', sublabel: 'edge', cluster: 'app', shape: 'rect' },
    { id: 'web', label: 'Web Service', sublabel: 'Node · 24 LTS', cluster: 'app', shape: 'rect' },
    { id: 'worker', label: 'Worker', sublabel: 'background', cluster: 'app', shape: 'rect' },
    { id: 'cache', label: 'Cache', sublabel: 'Redis', cluster: 'data', shape: 'rect' },
    { id: 'db', label: 'Database', sublabel: 'Postgres', cluster: 'data', shape: 'rect' },
  ],
  edges: [
    { id: 'req-in', from: 'browser', to: 'api', label: 'HTTPS', style: 'solid' },
    { id: 'req-svc', from: 'api', to: 'web', style: 'dashed' },
    { id: 'svc-db', from: 'web', to: 'db', style: 'solid' },
    { id: 'svc-cache', from: 'web', to: 'cache', style: 'dashed' },
    { id: 'wkr-db', from: 'worker', to: 'db', label: 'consume queue', style: 'solid' },
    { from: 'browser', to: 'cdn', style: 'solid' },
  ],
  flows: [
    { id: 'request', edges: ['req-in', 'req-svc', 'svc-db'], duration: 6500, delay: 0 },
    { id: 'queue-drain', edges: ['wkr-db'], duration: 6500, delay: 3250 },
  ],
}

describe('parse()', () => {
  it('accepts a minimal valid Diagram', () => {
    expect(() => parse(minimal)).not.toThrow()
  })

  it('accepts a full clustered + flowed Diagram', () => {
    expect(() => parse(taskitoStyleArchitecture)).not.toThrow()
  })

  it('applies enum defaults (shape, style, duration, delay)', () => {
    const result = parse({
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    })
    expect(result.nodes[0]?.shape).toBe('rect')
    expect(result.edges[0]?.style).toBe('solid')
  })

  it('throws InkinValidationError with field-path on missing id', () => {
    const bad = {
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'A' }, { label: 'B' }],
      edges: [],
    }
    expect(() => parse(bad)).toThrow(InkinValidationError)
    try {
      parse(bad)
    } catch (err) {
      expect(err).toBeInstanceOf(InkinValidationError)
      const e = err as InkinValidationError
      expect(e.issues.some((i) => i.path === 'diagram.nodes[1].id')).toBe(true)
    }
  })

  it('throws on unknown schemaVersion', () => {
    expect(() => parse({ schemaVersion: 99, nodes: [], edges: [] })).toThrow(InkinValidationError)
  })

  it('throws on edge.from referencing unknown node', () => {
    const bad: unknown = {
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ from: 'nope', to: 'a' }],
    }
    try {
      parse(bad)
      expect.fail('expected parse to throw')
    } catch (err) {
      const e = err as InkinValidationError
      expect(e.issues.some((i) => i.path === 'diagram.edges[0].from')).toBe(true)
      expect(e.issues.some((i) => i.message.includes('"nope"'))).toBe(true)
    }
  })

  it('throws on edge.to referencing unknown node', () => {
    const bad: unknown = {
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'A' }],
      edges: [{ from: 'a', to: 'nope' }],
    }
    try {
      parse(bad)
      expect.fail('expected parse to throw')
    } catch (err) {
      const e = err as InkinValidationError
      expect(e.issues.some((i) => i.path === 'diagram.edges[0].to')).toBe(true)
    }
  })

  it('throws on duplicate node ids', () => {
    const bad: unknown = {
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'A again' },
      ],
      edges: [],
    }
    try {
      parse(bad)
      expect.fail('expected parse to throw')
    } catch (err) {
      const e = err as InkinValidationError
      expect(e.issues.some((i) => i.message.includes('duplicate node id'))).toBe(true)
    }
  })

  it('throws on node referencing unknown cluster', () => {
    const bad: unknown = {
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'A', cluster: 'ghost' }],
      edges: [],
    }
    try {
      parse(bad)
      expect.fail('expected parse to throw')
    } catch (err) {
      const e = err as InkinValidationError
      expect(e.issues.some((i) => i.path === 'diagram.nodes[0].cluster')).toBe(true)
    }
  })

  it('throws on flow referencing unknown edge id', () => {
    const bad: unknown = {
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      flows: [{ id: 'f', edges: ['ghost-edge'] }],
    }
    try {
      parse(bad)
      expect.fail('expected parse to throw')
    } catch (err) {
      const e = err as InkinValidationError
      expect(e.issues.some((i) => i.path === 'diagram.flows[0].edges[0]')).toBe(true)
      expect(e.issues.some((i) => i.message.includes('ghost-edge'))).toBe(true)
    }
  })

  it('accepts flow referencing the auto-derived "from->to" edge id', () => {
    expect(() =>
      parse({
        schemaVersion: 1,
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        edges: [{ from: 'a', to: 'b' }], // auto-id = "a->b"
        flows: [{ id: 'f', edges: ['a->b'] }],
      }),
    ).not.toThrow()
  })

  it('throws on a cluster being its own parent', () => {
    const bad: unknown = {
      schemaVersion: 1,
      nodes: [],
      edges: [],
      clusters: [{ id: 'c', label: 'C', parent: 'c' }],
    }
    try {
      parse(bad)
      expect.fail('expected parse to throw')
    } catch (err) {
      const e = err as InkinValidationError
      expect(e.issues.some((i) => i.message.includes('cannot be its own parent'))).toBe(true)
    }
  })
})

describe('safeParse()', () => {
  it('returns { success: true, data } on valid input', () => {
    const result = safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.nodes).toHaveLength(2)
  })

  it('returns { success: false, error } on invalid input', () => {
    const result = safeParse({ schemaVersion: 1, nodes: 'wat', edges: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InkinValidationError)
      expect(result.error.issues.length).toBeGreaterThan(0)
    }
  })
})

describe('error message format (DX commitment)', () => {
  it('multi-line message lists every issue with diagram.<path> prefix', () => {
    try {
      parse({
        schemaVersion: 1,
        nodes: [{ id: '', label: 'empty-id' }, { label: 'no-id' }],
        edges: [{ from: 'a', to: 'b' }],
      })
      expect.fail('expected throw')
    } catch (err) {
      const e = err as InkinValidationError
      expect(e.message).toMatch(/^inkin: invalid Diagram\n/)
      expect(e.message).toMatch(/diagram\.nodes\[\d+\]/)
    }
  })
})
