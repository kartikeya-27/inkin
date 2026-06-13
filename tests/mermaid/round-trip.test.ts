import { describe, expect, it, vi } from 'vitest'
import { fromMermaid } from '../../src/mermaid/from-mermaid'
import { toMermaid } from '../../src/mermaid/to-mermaid'
import type { Diagram } from '../../src/schema/types'
import { FLOWCHART_FIXTURES, STATE_FIXTURES } from './fixtures/corpus'

/**
 * Phase 8 of 0.6.0 — bidirectional round-trip suite.
 *
 * For every fixture in the supported-subset corpus, assert:
 *
 *   normalize(fromMermaid(src).diagram)
 *     == normalize(fromMermaid(toMermaid(fromMermaid(src).diagram)).diagram)
 *
 * i.e. parse → re-emit → re-parse yields a SEMANTICALLY equal Diagram.
 * Per decision #7 the contract is semantic equivalence, not
 * byte-identical Mermaid text — `toMermaid` regroups nodes by cluster,
 * so node/edge declaration order can shift. The `normalize` helper sorts
 * nodes / edges / clusters by a stable key before comparison so order
 * differences don't produce false negatives, while still catching any
 * real divergence (lost label, changed shape, dropped edge, etc.).
 *
 * Mermaid is muted during the run — best-effort imports legitimately
 * emit `console.warn`s (lossy shape/edge mappings, dropped direction)
 * which would otherwise spam the test output.
 */

/** A Diagram with its arrays sorted by stable keys, for order-
 * insensitive comparison. */
function normalize(d: Diagram): unknown {
  const nodes = [...d.nodes].map((n) => ({ ...n })).sort((a, b) => a.id.localeCompare(b.id))
  const edges = [...d.edges]
    .map((e) => ({ ...e }))
    .sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)))
  const clusters = (d.clusters ?? [])
    .map((c) => ({ ...c }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return { schemaVersion: d.schemaVersion, nodes, edges, clusters }
}

function edgeKey(e: Diagram['edges'][number]): string {
  return `${e.id ?? `${e.from}->${e.to}`}`
}

function roundTrip(src: string): { first: Diagram; second: Diagram } {
  const r1 = fromMermaid(src)
  if (!r1.ok) {
    throw new Error(`fromMermaid(src) failed: ${r1.issues.map((i) => i.message).join('; ')}`)
  }
  const text = toMermaid(r1.diagram)
  const r2 = fromMermaid(text)
  if (!r2.ok) {
    throw new Error(
      `fromMermaid(toMermaid(...)) failed for re-emitted text:\n${text}\n` +
        r2.issues.map((i) => i.message).join('; '),
    )
  }
  return { first: r1.diagram, second: r2.diagram }
}

describe('round-trip — flowchart corpus', () => {
  for (const fixture of FLOWCHART_FIXTURES) {
    it(`round-trips: ${fixture.name}`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { first, second } = roundTrip(fixture.mermaid)
      expect(normalize(second)).toEqual(normalize(first))
      warn.mockRestore()
    })
  }
})

describe('round-trip — state-diagram corpus', () => {
  for (const fixture of STATE_FIXTURES) {
    it(`round-trips: ${fixture.name}`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { first, second } = roundTrip(fixture.mermaid)
      expect(normalize(second)).toEqual(normalize(first))
      warn.mockRestore()
    })
  }
})

describe('round-trip — stability (third pass is a fixpoint)', () => {
  // A second emit/parse cycle from an already-round-tripped Diagram must
  // reach a fixpoint: toMermaid is deterministic, and once nodes are in
  // canonical (cluster-grouped) order the text stops changing.
  it('toMermaid(secondParse) equals toMermaid(thirdParse) byte-for-byte', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const fixture of [...FLOWCHART_FIXTURES, ...STATE_FIXTURES]) {
      const r1 = fromMermaid(fixture.mermaid)
      if (!r1.ok) throw new Error(`parse failed: ${fixture.name}`)
      const text2 = toMermaid(r1.diagram)
      const r2 = fromMermaid(text2)
      if (!r2.ok) throw new Error(`reparse failed: ${fixture.name}`)
      const text3 = toMermaid(r2.diagram)
      // The text emitted from the second parse must equal the text from
      // the third — a stable fixpoint, no drift across cycles.
      expect(text3).toBe(text2)
    }
    warn.mockRestore()
  })
})
