// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useFlowSync } from '../../../src/renderer/editing/sync'
import type { DiagramInput } from '../../../src/schema/types'

/**
 * Phase 5 (read path) tests for `useFlowSync`.
 *
 * Strategy: mount the hook with @testing-library's `renderHook` (JSDOM
 * environment via the directive at top), exercise its API, and assert
 * on the returned values + on whether `onChange` was called.
 *
 * Phase 5 only wires the read path. The handlers exist but no patches
 * fire — `onChange` MUST stay quiet in this commit. Phase 6 fills in
 * the write path and the tests there will assert dispatch behavior.
 */

const triangle: DiagramInput = {
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'A', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', position: { x: 200, y: 0 } },
    { id: 'c', label: 'C', position: { x: 100, y: 150 } },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ],
}

const pair: DiagramInput = {
  schemaVersion: 1,
  nodes: [
    { id: 'x', label: 'X', position: { x: 0, y: 0 } },
    { id: 'y', label: 'Y', position: { x: 200, y: 0 } },
  ],
  edges: [{ from: 'x', to: 'y' }],
}

const invalid = {
  schemaVersion: 1,
  nodes: [{ label: 'missing-id' }],
  edges: [],
} as unknown as DiagramInput

describe('useFlowSync — read path: initial state', () => {
  it('exposes parsed nodes + edges on mount when value is valid', () => {
    const { result } = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }))
    expect(result.current.nodes).toHaveLength(3)
    expect(result.current.edges).toHaveLength(2)
    expect(result.current.parsedDiagram).not.toBeNull()
    expect(result.current.parseError).toBeNull()
  })

  it('reports parseError and empty arrays when value is invalid', () => {
    const { result } = renderHook(() => useFlowSync({ value: invalid, layout: 'manual' }))
    expect(result.current.nodes).toEqual([])
    expect(result.current.edges).toEqual([])
    expect(result.current.parsedDiagram).toBeNull()
    expect(result.current.parseError).not.toBeNull()
    expect(result.current.parseError?.issues.length).toBeGreaterThan(0)
  })

  it('isEditable reflects whether onChange was provided', () => {
    const readOnly = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }))
    expect(readOnly.result.current.isEditable).toBe(false)

    const editable = renderHook(() =>
      useFlowSync({ value: triangle, layout: 'manual', onChange: () => {} }),
    )
    expect(editable.result.current.isEditable).toBe(true)
  })

  it('exposes the four xyflow change handlers as functions', () => {
    const { result } = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }))
    expect(typeof result.current.onNodesChange).toBe('function')
    expect(typeof result.current.onEdgesChange).toBe('function')
    expect(typeof result.current.onConnect).toBe('function')
    expect(typeof result.current.onNodesDelete).toBe('function')
    expect(typeof result.current.onEdgesDelete).toBe('function')
  })
})

describe('useFlowSync — read path: re-seeds on external value change', () => {
  it('rebuilds nodes/edges when the consumer passes a different value reference', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: DiagramInput }) => useFlowSync({ value, layout: 'manual' }),
      { initialProps: { value: triangle } },
    )
    expect(result.current.nodes).toHaveLength(3)

    rerender({ value: pair })
    expect(result.current.nodes).toHaveLength(2)
    expect(result.current.edges).toHaveLength(1)
    expect(result.current.parsedDiagram?.nodes.map((n) => n.id)).toEqual(['x', 'y'])
  })

  it('does NOT re-seed on a rerender with the same value reference', () => {
    let renderCount = 0
    const { result, rerender } = renderHook(() => {
      renderCount += 1
      return useFlowSync({ value: triangle, layout: 'manual' })
    })
    const firstNodes = result.current.nodes

    rerender()
    rerender()
    // After two no-op rerenders, the nodes array reference should be identical.
    expect(result.current.nodes).toBe(firstNodes)
    expect(renderCount).toBeGreaterThanOrEqual(3)
  })

  it('transitions cleanly from valid → invalid → valid', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: DiagramInput }) => useFlowSync({ value, layout: 'manual' }),
      { initialProps: { value: triangle } },
    )
    expect(result.current.parseError).toBeNull()

    rerender({ value: invalid })
    expect(result.current.parseError).not.toBeNull()
    expect(result.current.nodes).toEqual([])

    rerender({ value: pair })
    expect(result.current.parseError).toBeNull()
    expect(result.current.nodes).toHaveLength(2)
  })
})

describe('useFlowSync — read path: handlers never call onChange', () => {
  it('onNodesChange does not call onChange even when given a position update', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFlowSync({ value: triangle, layout: 'manual', onChange }),
    )
    act(() => {
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 999, y: 999 }, dragging: false },
      ])
    })
    // Local state updates — but Phase 5 does NOT escape via onChange.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('onConnect / onNodesDelete / onEdgesDelete are no-op stubs in this phase', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useFlowSync({ value: triangle, layout: 'manual', onChange }),
    )
    act(() => {
      result.current.onConnect({ source: 'a', target: 'c', sourceHandle: null, targetHandle: null })
      result.current.onNodesDelete([{ id: 'a', position: { x: 0, y: 0 }, data: {} }])
      result.current.onEdgesDelete([{ id: 'a->b', source: 'a', target: 'b' }])
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('useFlowSync — read path: dagre auto-layout', () => {
  it('runs dagre when layout is auto (default) and skips it when manual', () => {
    const unpositioned: DiagramInput = {
      schemaVersion: 1,
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    }

    const auto = renderHook(() => useFlowSync({ value: unpositioned, layout: 'auto' }))
    const a = auto.result.current.nodes.find((n) => n.id === 'a')
    const b = auto.result.current.nodes.find((n) => n.id === 'b')
    // Dagre assigns deterministic non-(0,0) coordinates.
    expect(a?.position).not.toEqual({ x: 0, y: 0 })
    expect(b?.position).not.toEqual({ x: 0, y: 0 })

    // Wrap the console.warn that the renderer emits for unpositioned nodes
    // under manual layout so it doesn't noise up test output.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const manual = renderHook(() => useFlowSync({ value: unpositioned, layout: 'manual' }))
    expect(manual.result.current.nodes.find((n) => n.id === 'a')?.position).toEqual({ x: 0, y: 0 })
    warn.mockRestore()
  })
})

// Quiet TS6133 for the unused JSX runtime import the JSDOM directive pulls in.
export type _Touch = ReactNode
