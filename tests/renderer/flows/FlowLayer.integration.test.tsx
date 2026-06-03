// @vitest-environment jsdom

/**
 * Phase 8 of 0.5.0 — `<FlowLayer>` integration through `<DiagramStudio>`.
 *
 * The unit suites at `compose-path.test.ts` and `FlowLayer.test.tsx`
 * exercise the helpers in isolation. This integration suite mounts the
 * full provider tree (`InkinStoreProvider` → `ReactFlowProvider` →
 * `DiagramStudioInner` → `GraphRenderer` → `FlowLayer`) and asserts that
 * the *data-driven seam* — `value.flows` → `useFlowSync.parsedDiagram.flows`
 * → `<GraphRenderer flows={...}>` → `<FlowLayer>` rendering — carries
 * the consumer's flow definitions all the way to the rendered SVG
 * circles without losing them.
 *
 * Why this matters: Phase 4 introduced four layers of indirection
 * between the consumer's `value` and the rendered `<circle>`. A regression
 * anywhere in that chain (e.g., `useFlowSync` accidentally dropping
 * `flows` on a re-render, `GraphRenderer` not forwarding the prop,
 * `<DiagramStudio>` not threading the value through) would be invisible
 * to the per-component suites but break the user-facing feature. This
 * suite is the end-to-end gate.
 *
 * Fixture: a clustered architecture-style diagram with two flows
 * sharing one edge — small enough to keep test churn low, expressive
 * enough to cover the "multiple flows referencing the same edge"
 * scenario (a real-world pattern: a synchronous request flow and a
 * retry/replay flow over the same wire). Mirrors the shape of
 * `examples/src/samples/architecture.ts` without depending on it
 * (importing across workspace package boundaries from tests would
 * couple the test suite to the examples app's lifecycle).
 */

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DiagramStudio } from '../../../src/renderer/DiagramStudio'
import { __resetFlowWarnings } from '../../../src/renderer/flows'
import type { DiagramInput } from '../../../src/schema/types'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  __resetFlowWarnings()
})

const clusteredWithFlows: DiagramInput = {
  schemaVersion: 1,
  clusters: [
    { id: 'app', label: 'application' },
    { id: 'data', label: 'data' },
  ],
  nodes: [
    { id: 'api', label: 'API Gateway', cluster: 'app' },
    { id: 'web', label: 'Web Service', cluster: 'app' },
    { id: 'db', label: 'Database', cluster: 'data', shape: 'terminal' },
  ],
  edges: [
    { id: 'req-in', from: 'api', to: 'web', label: 'HTTPS' },
    { id: 'svc-db', from: 'web', to: 'db' },
  ],
  flows: [
    { id: 'request', edges: ['req-in', 'svc-db'], duration: 6500 },
    { id: 'replay', edges: ['svc-db'], duration: 6500, delay: 3250, color: '#ff7a18' },
  ],
}

describe('<FlowLayer> integration through <DiagramStudio>', () => {
  it('renders one <circle> per flow with the right data-flow-ids', () => {
    const { container } = render(<DiagramStudio value={clusteredWithFlows} />)
    const ids = Array.from(container.querySelectorAll('circle[data-flow-id]')).map((el) =>
      el.getAttribute('data-flow-id'),
    )
    expect(ids).toEqual(['request', 'replay'])
  })

  it('mounts a single <FlowLayer> SVG overlay (data-testid="inkin-flow-layer")', () => {
    const { container } = render(<DiagramStudio value={clusteredWithFlows} />)
    expect(container.querySelectorAll('[data-testid="inkin-flow-layer"]')).toHaveLength(1)
  })

  it('per-flow color and timing reach the rendered circle as inline custom properties', () => {
    const { container } = render(<DiagramStudio value={clusteredWithFlows} />)

    const requestCircle = container.querySelector(
      'circle[data-testid="inkin-flow-token-request"]',
    ) as SVGCircleElement | null
    const replayCircle = container.querySelector(
      'circle[data-testid="inkin-flow-token-replay"]',
    ) as SVGCircleElement | null
    expect(requestCircle).not.toBeNull()
    expect(replayCircle).not.toBeNull()

    // `request` flow has no `color` → falls back to the accent token.
    expect(requestCircle?.style.fill).toBe('var(--inkin-accent-primary)')
    expect(requestCircle?.style.getPropertyValue('--inkin-flow-duration')).toBe('6500ms')
    expect(requestCircle?.style.getPropertyValue('--inkin-flow-delay')).toBe('0ms')

    // `replay` flow has its own color + a stagger delay so two tokens
    // sharing the `svc-db` edge never visually overlay.
    expect(replayCircle?.style.fill).toBe('rgb(255, 122, 24)')
    expect(replayCircle?.style.getPropertyValue('--inkin-flow-duration')).toBe('6500ms')
    expect(replayCircle?.style.getPropertyValue('--inkin-flow-delay')).toBe('3250ms')
  })

  it('the composed offset-path string is set per flow (Phase 3 animation seam)', () => {
    const { container } = render(<DiagramStudio value={clusteredWithFlows} />)
    const circles = Array.from(
      container.querySelectorAll('circle[data-testid^="inkin-flow-token-"]'),
    ) as SVGCircleElement[]

    for (const circle of circles) {
      const inlinePath = circle.style.getPropertyValue('--inkin-flow-path')
      // Each circle's offset-path is a non-empty `path('...')` expression
      // — that's what the CSS `animation: flowTraverse` rule consumes.
      expect(inlinePath.startsWith("path('")).toBe(true)
      expect(inlinePath.endsWith("')")).toBe(true)
      // And the path itself is non-trivially long (a single edge's
      // smooth-step path is well over 10 chars).
      expect(inlinePath.length).toBeGreaterThan(20)
    }
  })

  it('a value update with different flows reflects in the rendered circles', () => {
    const { container, rerender } = render(<DiagramStudio value={clusteredWithFlows} />)
    expect(
      Array.from(container.querySelectorAll('circle[data-flow-id]')).map((el) =>
        el.getAttribute('data-flow-id'),
      ),
    ).toEqual(['request', 'replay'])

    // Drop the second flow; the seam should re-render with only one circle.
    const next: DiagramInput = {
      ...clusteredWithFlows,
      flows: [{ id: 'request', edges: ['req-in', 'svc-db'], duration: 6500 }],
    }
    rerender(<DiagramStudio value={next} />)

    const idsAfter = Array.from(container.querySelectorAll('circle[data-flow-id]')).map((el) =>
      el.getAttribute('data-flow-id'),
    )
    expect(idsAfter).toEqual(['request'])
  })

  it('dropping `flows` entirely unmounts the FlowLayer (0.4.x backwards-compat)', () => {
    const { container, rerender } = render(<DiagramStudio value={clusteredWithFlows} />)
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).not.toBeNull()

    const noFlows: DiagramInput = {
      schemaVersion: 1,
      nodes: clusteredWithFlows.nodes,
      edges: clusteredWithFlows.edges,
      ...(clusteredWithFlows.clusters !== undefined && {
        clusters: clusteredWithFlows.clusters,
      }),
    }
    rerender(<DiagramStudio value={noFlows} />)
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })
})
