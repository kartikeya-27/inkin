// @vitest-environment jsdom

/**
 * `<FlowLayer>` — jsdom-friendly assertions only.
 *
 * Phase 10 refactor: FlowLayer reads xyflow's already-rendered edge
 * `<path>` `d` attributes from the DOM rather than re-computing them
 * from node positions. In jsdom, xyflow does NOT render any
 * `<path>` elements (verified: `container.querySelectorAll('path')`
 * returns 0 under `@testing-library/react` + `@xyflow/react`), so the
 * "renders one circle per flow" / "exposes per-flow custom properties"
 * assertions cannot pass under unit-test conditions. Those gates moved
 * to `tests/e2e/flows.spec.ts` (Phase 9) where real browser engines
 * give us real edge geometry.
 *
 * What this file still pins:
 *   - The "no svg when flows is undefined/empty" backwards-compat
 *     guarantee — purely a prop-driven branch that runs the same in
 *     every environment.
 *   - The one-time `console.warn` reset hook used by other suites.
 */

import { cleanup, render } from '@testing-library/react'
import type { Edge as XyEdge, Node as XyNode } from '@xyflow/react'
import { ReactFlow } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetFlowWarnings, FlowLayer } from '../../../src/renderer/flows'
import type { Flow } from '../../../src/schema/types'

const horizontalNodes: XyNode[] = [
  {
    id: 'a',
    type: 'rect',
    position: { x: 0, y: 0 },
    data: { label: 'A' },
    measured: { width: 180, height: 60 },
  },
  {
    id: 'b',
    type: 'rect',
    position: { x: 240, y: 0 },
    data: { label: 'B' },
    measured: { width: 180, height: 60 },
  },
]

const horizontalEdges: XyEdge[] = [{ id: 'a->b', source: 'a', target: 'b', type: 'labeled' }]

function renderWith({ flows }: { flows: readonly Flow[] | undefined }) {
  return render(
    <div style={{ width: 800, height: 600 }}>
      <ReactFlow nodes={horizontalNodes} edges={horizontalEdges} fitView={false}>
        <FlowLayer flows={flows} />
      </ReactFlow>
    </div>,
  )
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  __resetFlowWarnings()
})

describe('FlowLayer — prop-driven branches (env-agnostic)', () => {
  it('renders nothing when flows is undefined', () => {
    const { container } = renderWith({ flows: undefined })
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })

  it('renders nothing when flows is an empty array', () => {
    const { container } = renderWith({ flows: [] })
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })

  it('renders nothing in jsdom even when flows is populated (no edges → no paths)', () => {
    // Defensive: this documents the jsdom contract. The same input
    // renders an animated <svg> + <circle> in a real browser (covered
    // by tests/e2e/flows.spec.ts). The fact that jsdom produces no
    // output is by design — we can't fake xyflow's edge rendering.
    const flows: Flow[] = [{ id: 'f', edges: ['a->b'], duration: 7000, delay: 0 }]
    const { container } = renderWith({ flows })
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })
})
