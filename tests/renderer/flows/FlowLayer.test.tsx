// @vitest-environment jsdom

/**
 * Phase 2 of 0.5.0 — `<FlowLayer>` scaffold test.
 *
 * Verifies the rendering contract before any animation is added:
 *   - N flows + valid nodes/edges → N `<circle>` elements in the DOM
 *   - `flows` empty / undefined → no `<svg>` rendered at all
 *   - Each circle carries the per-flow `color` (or default accent)
 *     as both `fill` and the `color` CSS property (used by the
 *     drop-shadow `currentColor`)
 *   - The `--inkin-flow-path` custom property is set with a `path(...)`
 *     value containing the composed SVG `d` string (so Phase 3 can
 *     reference it from the `animation` rule without re-rendering)
 *   - Unresolved flows render nothing and emit one console.warn per
 *     flow id (via the `__resetFlowWarnings` test hook)
 *
 * Mounting strategy: pass `<FlowLayer>` as a child of `<ReactFlow>`
 * with controlled nodes/edges so `useNodes()` / `useEdges()` /
 * `useViewport()` resolve. The standalone `<ReactFlowProvider>` path
 * trips React 19's hook dispatcher in jsdom; `<ReactFlow>` sets up
 * its own internal store correctly. This mirrors the exact composition
 * Phase 4 wires into `GraphRenderer.tsx`.
 */

import { cleanup, render } from '@testing-library/react'
import type { Edge as XyEdge, Node as XyNode } from '@xyflow/react'
import { ReactFlow } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  {
    id: 'c',
    type: 'rect',
    position: { x: 480, y: 0 },
    data: { label: 'C' },
    measured: { width: 180, height: 60 },
  },
]

const horizontalEdges: XyEdge[] = [
  { id: 'a->b', source: 'a', target: 'b', type: 'labeled' },
  { id: 'b->c', source: 'b', target: 'c', type: 'labeled' },
]

function renderWith({
  flows,
  nodes = horizontalNodes,
  edges = horizontalEdges,
}: {
  flows: readonly Flow[] | undefined
  nodes?: XyNode[]
  edges?: XyEdge[]
}) {
  // Mount a real `<ReactFlow>` with controlled nodes/edges so
  // `useNodes()` / `useEdges()` / `useViewport()` inside `<FlowLayer>`
  // resolve. `<FlowLayer>` is passed as a child of ReactFlow — the
  // exact composition Phase 4 wires into `GraphRenderer.tsx`.
  return render(
    <div style={{ width: 800, height: 600 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView={false}>
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

describe('FlowLayer — rendering shape', () => {
  it('renders nothing when flows is undefined', () => {
    const { container } = renderWith({ flows: undefined })
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })

  it('renders nothing when flows is an empty array', () => {
    const { container } = renderWith({ flows: [] })
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })

  it('renders one <svg> root and one <circle> per resolvable flow', () => {
    const flows: Flow[] = [
      { id: 'f-one', edges: ['a->b'], duration: 7000, delay: 0 },
      { id: 'f-two', edges: ['a->b', 'b->c'], duration: 5000, delay: 100 },
    ]
    const { container } = renderWith({ flows })
    expect(container.querySelectorAll('[data-testid="inkin-flow-layer"]')).toHaveLength(1)
    expect(container.querySelectorAll('circle[data-testid^="inkin-flow-token-"]')).toHaveLength(2)
  })

  it('each circle is tagged with its flow id via data-flow-id', () => {
    const flows: Flow[] = [
      { id: 'alpha', edges: ['a->b'], duration: 7000, delay: 0 },
      { id: 'beta', edges: ['b->c'], duration: 7000, delay: 0 },
    ]
    const { container } = renderWith({ flows })
    const ids = Array.from(container.querySelectorAll('circle[data-flow-id]')).map((el) =>
      el.getAttribute('data-flow-id'),
    )
    expect(ids).toEqual(['alpha', 'beta'])
  })
})

describe('FlowLayer — color sourcing', () => {
  it('uses the per-flow `color` when set', () => {
    const flows: Flow[] = [{ id: 'f', edges: ['a->b'], duration: 7000, delay: 0, color: '#ff00aa' }]
    const { container } = renderWith({ flows })
    const circle = container.querySelector(
      'circle[data-testid="inkin-flow-token-f"]',
    ) as SVGCircleElement | null
    expect(circle).not.toBeNull()
    // Both `fill` (the actual paint) and `color` (driving currentColor
    // for the drop-shadow glow) carry the flow's hex.
    expect(circle?.style.fill).toBe('rgb(255, 0, 170)')
    expect(circle?.style.color).toBe('rgb(255, 0, 170)')
  })

  it('falls back to var(--inkin-accent-primary) when color is unset', () => {
    const flows: Flow[] = [{ id: 'f', edges: ['a->b'], duration: 7000, delay: 0 }]
    const { container } = renderWith({ flows })
    const circle = container.querySelector(
      'circle[data-testid="inkin-flow-token-f"]',
    ) as SVGCircleElement | null
    expect(circle).not.toBeNull()
    // CSS variable references survive jsdom's CSSOM as the literal
    // `var(...)` string in inline style.
    expect(circle?.style.fill).toBe('var(--inkin-accent-primary)')
    expect(circle?.style.color).toBe('var(--inkin-accent-primary)')
  })
})

describe('FlowLayer — Phase 3 seam', () => {
  it('exposes the composed d path via the `--inkin-flow-path` custom property', () => {
    const flows: Flow[] = [{ id: 'f', edges: ['a->b'], duration: 7000, delay: 0 }]
    const { container } = renderWith({ flows })
    const circle = container.querySelector(
      'circle[data-testid="inkin-flow-token-f"]',
    ) as SVGCircleElement | null
    expect(circle).not.toBeNull()
    // The Phase 3 `@keyframes flowTraverse` rule will reference
    // `var(--inkin-flow-path)` from CSS without needing inline
    // recomputation. The variable must be a `path(...)` expression
    // with the composed `d` string inside.
    const inlinePath = circle?.style.getPropertyValue('--inkin-flow-path') ?? ''
    expect(inlinePath.startsWith("path('")).toBe(true)
    expect(inlinePath.endsWith("')")).toBe(true)
  })

  it('exposes flow.duration + flow.delay via custom properties for the Phase 3 animation rule', () => {
    const flows: Flow[] = [{ id: 'f', edges: ['a->b'], duration: 5000, delay: 750 }]
    const { container } = renderWith({ flows })
    const circle = container.querySelector(
      'circle[data-testid="inkin-flow-token-f"]',
    ) as SVGCircleElement | null
    expect(circle?.style.getPropertyValue('--inkin-flow-duration')).toBe('5000ms')
    expect(circle?.style.getPropertyValue('--inkin-flow-delay')).toBe('750ms')
  })
})

describe('FlowLayer — defensive resolution', () => {
  it('skips an unresolvable flow + emits one console.warn per flow id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const flows: Flow[] = [
      { id: 'good', edges: ['a->b'], duration: 7000, delay: 0 },
      { id: 'bad', edges: ['nonexistent'], duration: 7000, delay: 0 },
    ]
    const { container } = renderWith({ flows })

    // The good flow renders; the bad flow doesn't.
    expect(container.querySelector('circle[data-flow-id="good"]')).not.toBeNull()
    expect(container.querySelector('circle[data-flow-id="bad"]')).toBeNull()

    // One warning was emitted, naming the bad flow's id.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('"bad"')

    warn.mockRestore()
  })

  it('the same unresolvable flow id only warns once across re-renders', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const flows: Flow[] = [
      { id: 'persistent-bad', edges: ['nonexistent'], duration: 7000, delay: 0 },
    ]
    const { rerender } = renderWith({ flows })
    rerender(
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={horizontalNodes} edges={horizontalEdges} fitView={false}>
          <FlowLayer flows={flows} />
        </ReactFlow>
      </div>,
    )

    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
