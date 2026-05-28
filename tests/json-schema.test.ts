import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { diagramJsonSchema, parse } from '../src/schema'

/**
 * Two-way verification for the AI-ready surface (DX commitment #8):
 *
 *   1. `diagramJsonSchema` is itself a valid JSON Schema Draft 2020-12 document.
 *   2. Every fixture that passes the runtime `parse()` ALSO passes static
 *      `ajv` validation against `diagramJsonSchema`. Runtime and static schema
 *      MUST agree, or AI agents and runtime code will disagree about what's valid.
 */

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)

const validateAgainstStatic = ajv.compile(diagramJsonSchema)

const validFixtures: Array<{ name: string; input: unknown }> = [
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
    name: 'with clusters',
    input: {
      schemaVersion: 1,
      clusters: [{ id: 'g', label: 'Group' }],
      nodes: [
        { id: 'a', label: 'A', cluster: 'g' },
        { id: 'b', label: 'B', cluster: 'g' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    },
  },
  {
    name: 'with explicit shapes, styles, sublabels',
    input: {
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'Start', sublabel: 'entry', shape: 'rect' },
        { id: 'b', label: 'Done', sublabel: 'exit', shape: 'terminal' },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b', label: 'go', style: 'dashed' }],
    },
  },
  {
    name: 'with flows',
    input: {
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'b', to: 'c' },
      ],
      flows: [{ id: 'main', edges: ['e1', 'e2'], duration: 5000 }],
    },
  },
]

describe('diagramJsonSchema', () => {
  it('exists and is a non-empty object', () => {
    expect(diagramJsonSchema).toBeDefined()
    expect(typeof diagramJsonSchema).toBe('object')
    expect(Object.keys(diagramJsonSchema).length).toBeGreaterThan(0)
  })

  it('declares Draft 2020-12 as $schema', () => {
    // z.toJSONSchema with target: 'draft-2020-12' sets this
    const schema = diagramJsonSchema as { $schema?: string }
    expect(schema.$schema).toContain('2020-12')
  })

  it('compiles cleanly with ajv (no schema-internal errors)', () => {
    expect(validateAgainstStatic).toBeTypeOf('function')
  })
})

describe('runtime ↔ static schema parity', () => {
  for (const { name, input } of validFixtures) {
    it(`runtime parse() and ajv agree: ${name}`, () => {
      // 1. runtime parse must succeed
      expect(() => parse(input)).not.toThrow()
      // 2. static schema must also accept it
      const ok = validateAgainstStatic(input)
      if (!ok) {
        console.error('ajv errors for', name, validateAgainstStatic.errors)
      }
      expect(ok).toBe(true)
    })
  }

  it('static schema rejects missing required fields (alignment check)', () => {
    const bad = { schemaVersion: 1, nodes: [{ label: 'no-id' }], edges: [] }
    const ok = validateAgainstStatic(bad)
    expect(ok).toBe(false)
  })

  it('static schema rejects wrong types (alignment check)', () => {
    const bad = { schemaVersion: 1, nodes: 'wat', edges: [] }
    const ok = validateAgainstStatic(bad)
    expect(ok).toBe(false)
  })

  it('static schema rejects unknown schemaVersion', () => {
    const bad = { schemaVersion: 99, nodes: [], edges: [] }
    const ok = validateAgainstStatic(bad)
    expect(ok).toBe(false)
  })
})
