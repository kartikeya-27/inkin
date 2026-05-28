import { describe, expect, it } from 'vitest'
import { type Diagram, parse } from '../src/schema'

/**
 * Round-trip = parse → JSON.stringify → parse → deep-equal.
 *
 * We assert *post-defaults* equality (not byte-identical input), because the
 * schema fills in defaults (shape: 'rect', style: 'solid', duration: 7000,
 * delay: 0). A consumer storing the parsed Diagram in their DB and re-loading
 * it later MUST get back something semantically identical.
 */

const samples: Array<{ name: string; input: unknown }> = [
  {
    name: 'minimal',
    input: {
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    },
  },
  {
    name: 'lifecycle (state machine with terminal states)',
    input: {
      schemaVersion: 1,
      nodes: [
        { id: 'pending', label: 'Pending' },
        { id: 'running', label: 'Running' },
        { id: 'complete', label: 'Complete', shape: 'terminal' },
        { id: 'failed', label: 'Failed', shape: 'terminal' },
      ],
      edges: [
        { id: 'dequeue', from: 'pending', to: 'running', label: 'dequeue' },
        { id: 'success', from: 'running', to: 'complete', label: 'success' },
        { id: 'fail', from: 'running', to: 'failed', label: 'error', style: 'dashed' },
      ],
    },
  },
  {
    name: 'architecture (clustered, with flows)',
    input: {
      schemaVersion: 1,
      clusters: [
        { id: 'edge', label: 'edge' },
        { id: 'app', label: 'application' },
        { id: 'data', label: 'data' },
      ],
      nodes: [
        { id: 'browser', label: 'Browser', sublabel: 'client', cluster: 'edge' },
        { id: 'api', label: 'API Gateway', sublabel: 'edge', cluster: 'app' },
        { id: 'db', label: 'Database', sublabel: 'Postgres', cluster: 'data' },
      ],
      edges: [
        { id: 'req-in', from: 'browser', to: 'api', label: 'HTTPS' },
        { id: 'svc-db', from: 'api', to: 'db' },
      ],
      flows: [{ id: 'request', edges: ['req-in', 'svc-db'], duration: 6500 }],
    },
  },
]

describe('round-trip parse → JSON.stringify → parse', () => {
  for (const { name, input } of samples) {
    it(`is stable for: ${name}`, () => {
      const first: Diagram = parse(input)
      const serialized = JSON.stringify(first)
      const second: Diagram = parse(JSON.parse(serialized))
      expect(second).toEqual(first)
    })

    it(`is idempotent on second round for: ${name}`, () => {
      const first = parse(input)
      const second = parse(JSON.parse(JSON.stringify(first)))
      const third = parse(JSON.parse(JSON.stringify(second)))
      expect(third).toEqual(second)
    })
  }

  it('preserves schemaVersion through round-trip', () => {
    const result = parse(samples[0]!.input)
    const round = parse(JSON.parse(JSON.stringify(result)))
    expect(round.schemaVersion).toBe(1)
  })
})
