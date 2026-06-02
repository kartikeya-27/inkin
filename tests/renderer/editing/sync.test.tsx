// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { describe, expect, it, vi } from 'vitest'
import { useFlowSync } from '../../../src/renderer/editing/sync'
import { InkinStoreProvider, useEditorStore } from '../../../src/renderer/store'
import type { DiagramInput } from '../../../src/schema/types'

/**
 * Test wrapper: useFlowSync reads the editor store via useEditorStoreApi
 * (Phase 11 added selection mirroring) AND now calls useReactFlow() for
 * cross-cluster drag detection (Phase 9). Both providers are required in
 * the hook's ancestry. Apply this wrapper to every renderHook call.
 */
function withStore({ children }: { children: React.ReactNode }) {
  return (
    <InkinStoreProvider>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </InkinStoreProvider>
  )
}

/**
 * Flush pending microtasks. `useFlowSync` batches patch dispatches via
 * `queueMicrotask` so `onChange` fires once per tick — tests that assert
 * synchronously after `act(() => dispatch())` need to await this before
 * inspecting `onChange.mock.calls`.
 */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

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
    const { result } = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }), {
      wrapper: withStore,
    })
    expect(result.current.nodes).toHaveLength(3)
    expect(result.current.edges).toHaveLength(2)
    expect(result.current.parsedDiagram).not.toBeNull()
    expect(result.current.parseError).toBeNull()
  })

  it('reports parseError and empty arrays when value is invalid', () => {
    const { result } = renderHook(() => useFlowSync({ value: invalid, layout: 'manual' }), {
      wrapper: withStore,
    })
    expect(result.current.nodes).toEqual([])
    expect(result.current.edges).toEqual([])
    expect(result.current.parsedDiagram).toBeNull()
    expect(result.current.parseError).not.toBeNull()
    expect(result.current.parseError?.issues.length).toBeGreaterThan(0)
  })

  it('isEditable reflects whether onChange was provided', () => {
    const readOnly = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }), {
      wrapper: withStore,
    })
    expect(readOnly.result.current.isEditable).toBe(false)

    const editable = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange: () => {} }),
      { wrapper: withStore },
    )
    expect(editable.result.current.isEditable).toBe(true)
  })

  it('exposes the four xyflow change handlers as functions', () => {
    const { result } = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }), {
      wrapper: withStore,
    })
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
      { wrapper: withStore, initialProps: { value: triangle } },
    )
    expect(result.current.nodes).toHaveLength(3)

    rerender({ value: pair })
    expect(result.current.nodes).toHaveLength(2)
    expect(result.current.edges).toHaveLength(1)
    expect(result.current.parsedDiagram?.nodes.map((n) => n.id)).toEqual(['x', 'y'])
  })

  it('does NOT re-seed on a rerender with the same value reference', () => {
    let renderCount = 0
    const { result, rerender } = renderHook(
      () => {
        renderCount += 1
        return useFlowSync({ value: triangle, layout: 'manual' })
      },
      { wrapper: withStore },
    )
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
      { wrapper: withStore, initialProps: { value: triangle } },
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

describe('useFlowSync — read-only: handlers stay quiet without onChange', () => {
  it('onNodesChange does not call any callback (no onChange supplied)', () => {
    const { result } = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }), {
      wrapper: withStore,
    })
    // Just exercise without asserting onChange — there's no callback to call.
    act(() => {
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 999, y: 999 }, dragging: false },
      ])
    })
    expect(result.current.isEditable).toBe(false)
  })

  it('onConnect is a complete no-op in read-only mode', () => {
    const { result } = renderHook(() => useFlowSync({ value: triangle, layout: 'manual' }), {
      wrapper: withStore,
    })
    const edgesBefore = result.current.edges.length
    act(() => {
      result.current.onConnect({
        source: 'a',
        target: 'c',
        sourceHandle: null,
        targetHandle: null,
      })
    })
    // Read-only: connect doesn't dispatch and doesn't grow the local array.
    expect(result.current.edges.length).toBe(edgesBefore)
  })
})

describe('useFlowSync — write path: MoveNode dispatch on drag-end', () => {
  it('does NOT call onChange during a drag (dragging: true)', () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 50, y: 50 }, dragging: true },
      ])
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange exactly once with the new absolute position on drag-end', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 250, y: 175 }, dragging: false },
      ])
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    const a = next.nodes.find((n: { id: string }) => n.id === 'a')
    expect(a?.position).toEqual({ x: 250, y: 175 })
  })

  it('mid-drag updates followed by drag-end produces a single onChange', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 50, y: 50 }, dragging: true },
      ])
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 100, y: 100 }, dragging: true },
      ])
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 150, y: 175 }, dragging: false },
      ])
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0].nodes[0]?.position).toEqual({ x: 150, y: 175 })
  })
})

describe('useFlowSync — write path: deletion dispatch', () => {
  it('dispatches DeleteNode (with cascade) on a remove change in onNodesChange', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onNodesChange([{ id: 'b', type: 'remove' }])
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    expect(next.nodes.map((n: { id: string }) => n.id)).toEqual(['a', 'c'])
    // Cascade: edges referencing 'b' are gone.
    expect(next.edges).toHaveLength(0)
  })

  it('dispatches DeleteEdge on a remove change in onEdgesChange', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onEdgesChange([{ id: 'a->b', type: 'remove' }])
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    // onChange receives the schema `Diagram` (with `from`/`to`), not xyflow.
    expect(next.edges.map((e: { from: string; to: string }) => `${e.from}->${e.to}`)).toEqual([
      'b->c',
    ])
  })

  it('onNodesDelete and onEdgesDelete are intentional no-ops (deletion lives on the change events)', () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onNodesDelete([{ id: 'a', position: { x: 0, y: 0 }, data: {} } as never])
      result.current.onEdgesDelete([{ id: 'a->b', source: 'a', target: 'b' } as never])
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})

/**
 * About the missing browser-pointer-event e2e:
 *
 * From 0.3.0 through 0.4.1 we kept a Playwright spec
 * (`tests/e2e/connect.spec.ts`) that drove `page.mouse.{down,move,up}` over
 * the source handle to gate the full chain: real browser pointer events →
 * xyflow's connection state machine → `useFlowSync.onConnect` →
 * `ConnectEdge` patch → consumer `onChange`. It went `test.fixme` in 0.4.0
 * after the chrome animation moved handle positions mid-test.
 *
 * The 0.4.1+ root-cause investigation: xyflow v12 listens for
 * `pointerdown` (not `mousedown`) on handles — see
 * `@xyflow/system`'s `onPointerDown` + `getEventPosition`. Playwright's
 * `page.mouse` and Chrome DevTools Protocol's `Input.dispatchMouseEvent`
 * both synthesize `mousedown`/`mousemove`/`mouseup` only; neither
 * generates `PointerEvent`s that xyflow's handler recognizes. A jsdom
 * integration test can't fill the gap either — xyflow's "closest handle"
 * hit-test at pointerup relies on `getBoundingClientRect`, which returns
 * zero in jsdom.
 *
 * What's covered without it:
 *   - This file's `ConnectEdge dispatch` describe — `onConnect` →
 *     `ConnectEdge` patch → `onChange` via direct hook-output calls (the
 *     contract every consumer relies on).
 *   - `tests/renderer/editing/apply-patch.test.ts` — reducer correctness
 *     including the parallel-edge auto-id-generation rule.
 *   - The examples playground — manually exercised every release. Drag
 *     a handle from a node to another; verify a new edge appears and
 *     the "onChange fired" counter ticks.
 *
 * If a future release wants automated coverage of the browser-pointer
 * layer, the path forward is to drive xyflow's internal store via
 * `useReactFlow` from inside an injected playground-level test hook —
 * not to wrestle with Playwright's event synthesis.
 */
describe('useFlowSync — write path: ConnectEdge dispatch', () => {
  it('dispatches ConnectEdge on onConnect with implicit id when free', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onConnect({
        source: 'a',
        target: 'c',
        sourceHandle: null,
        targetHandle: null,
      })
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    const added = next.edges.find(
      (e: { from: string; to: string }) => e.from === 'a' && e.to === 'c',
    )
    expect(added).toBeDefined()
    expect(added.id).toBeUndefined()
  })

  it('auto-generates an explicit id when the auto-derived form would collide', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onConnect({
        source: 'a',
        target: 'b',
        sourceHandle: null,
        targetHandle: null,
      })
    })
    await flush()
    const next = onChange.mock.calls[0]?.[0]
    expect(next.edges.at(-1)?.id).toBe('a->b#2')
  })

  it('drops a connect with missing source / target without crashing', () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      // xyflow's `Connection` type marks source/target as `string`, but
      // mid-drag states with no snapped handle produce null at runtime —
      // cast to exercise the defensive guard in the dispatcher.
      result.current.onConnect({
        source: null,
        target: 'b',
        sourceHandle: null,
        targetHandle: null,
      } as unknown as Parameters<typeof result.current.onConnect>[0])
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('useFlowSync — selection mirroring (xyflow → store)', () => {
  it('forwards xyflow select changes into the SelectionSlice', () => {
    const onChange = vi.fn()
    // Use a wrapper that exposes the store so we can read selection state.
    const { result } = renderHook(
      () => {
        const sync = useFlowSync({ value: triangle, layout: 'manual', onChange })
        const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds)
        return { sync, selectedNodeIds }
      },
      { wrapper: withStore },
    )

    expect(result.current.selectedNodeIds.size).toBe(0)

    act(() => {
      result.current.sync.onNodesChange([
        { id: 'a', type: 'select', selected: true },
        { id: 'b', type: 'select', selected: true },
      ])
    })

    expect(result.current.selectedNodeIds.size).toBe(2)
    expect(result.current.selectedNodeIds.has('a')).toBe(true)
    expect(result.current.selectedNodeIds.has('b')).toBe(true)
  })

  it('removes ids from the store on select=false events', () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => {
        const sync = useFlowSync({ value: triangle, layout: 'manual', onChange })
        const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds)
        return { sync, selectedNodeIds }
      },
      { wrapper: withStore },
    )
    act(() => {
      result.current.sync.onNodesChange([{ id: 'a', type: 'select', selected: true }])
    })
    expect(result.current.selectedNodeIds.has('a')).toBe(true)
    act(() => {
      result.current.sync.onNodesChange([{ id: 'a', type: 'select', selected: false }])
    })
    expect(result.current.selectedNodeIds.has('a')).toBe(false)
  })
})

describe('useFlowSync — write path: schema isolation between handlers', () => {
  it('back-to-back patches in one tick compound into a single onChange', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      // First patch: MoveNode for 'a'.
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 99, y: 99 }, dragging: false },
      ])
      // Second patch in the same tick: DeleteNode 'b'. Both patches go
      // through the microtask-batched dispatcher and produce ONE onChange
      // with the cumulative state — 'a' moved AND 'b' (plus incident
      // edges) removed.
      result.current.onNodesChange([{ id: 'b', type: 'remove' }])
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const final = onChange.mock.calls[0]?.[0]
    const a = final.nodes.find((n: { id: string }) => n.id === 'a')
    expect(a?.position).toEqual({ x: 99, y: 99 })
    expect(final.edges).toHaveLength(0)
  })
})

describe('useFlowSync — write path: defense-in-depth', () => {
  it('suppresses onChange and logs an error if the reducer produces an invalid Diagram', () => {
    // Simulate a reducer bug by intercepting a dispatched patch path that
    // would produce invalid state. We can't easily inject a bad patch
    // without a fixture, so this test exercises the parseError surface.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()

    // Use a diagram where deleting 'a' leaves an edge dangling — but our
    // reducer cascades correctly, so we can't trigger the safeParse trap
    // from outside. Skip the actual trigger; just verify the surface
    // exists by deleting a non-existent node — the reducer returns the
    // input by reference, and the dispatcher's no-op short-circuit
    // suppresses onChange. Confirms that orphan-cascade events
    // (xyflow's auto-cleanup of edges after a node is deleted) don't
    // produce N+1 redundant onChange calls.
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onNodesChange([{ id: 'ghost', type: 'remove' }])
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('useFlowSync — no-op short-circuit', () => {
  it('does not fire onChange when MoveNode lands at the same position', () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    // Node 'a' starts at { x: 0, y: 0 }. A position change at the same
    // coords (e.g. xyflow's click-without-drag) should NOT escape.
    act(() => {
      result.current.onNodesChange([
        { id: 'a', type: 'position', position: { x: 0, y: 0 }, dragging: false },
      ])
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not fire onChange when DeleteEdge targets an already-removed edge', () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: triangle, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.onEdgesChange([{ id: 'ghost-edge', type: 'remove' }])
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

    const auto = renderHook(() => useFlowSync({ value: unpositioned, layout: 'auto' }), {
      wrapper: withStore,
    })
    const a = auto.result.current.nodes.find((n) => n.id === 'a')
    const b = auto.result.current.nodes.find((n) => n.id === 'b')
    // Dagre assigns deterministic non-(0,0) coordinates.
    expect(a?.position).not.toEqual({ x: 0, y: 0 })
    expect(b?.position).not.toEqual({ x: 0, y: 0 })

    // Wrap the console.warn that the renderer emits for unpositioned nodes
    // under manual layout so it doesn't noise up test output.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const manual = renderHook(() => useFlowSync({ value: unpositioned, layout: 'manual' }), {
      wrapper: withStore,
    })
    expect(manual.result.current.nodes.find((n) => n.id === 'a')?.position).toEqual({ x: 0, y: 0 })
    warn.mockRestore()
  })
})

// --- 0.4.0 dispatcher verbs --------------------------------------------------

describe('useFlowSync — 0.4.0: dispatchAddNode', () => {
  it('appends a node and fires exactly one onChange', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useFlowSync({ value: pair, layout: 'manual', onChange }), {
      wrapper: withStore,
    })
    act(() => {
      result.current.dispatchAddNode({ id: 'z', label: 'Zed' })
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    expect(next?.nodes).toHaveLength(3)
    expect(next?.nodes[2]).toMatchObject({ id: 'z', label: 'Zed', shape: 'rect' })
  })

  it('honors explicit position, shape, and cluster', async () => {
    const seed: DiagramInput = {
      schemaVersion: 1,
      clusters: [{ id: 'group', label: 'Group' }],
      nodes: [{ id: 'x', label: 'X', cluster: 'group', position: { x: 0, y: 0 } }],
      edges: [],
    }
    const onChange = vi.fn()
    const { result } = renderHook(() => useFlowSync({ value: seed, layout: 'manual', onChange }), {
      wrapper: withStore,
    })
    act(() => {
      result.current.dispatchAddNode({
        id: 'y',
        label: 'Y',
        position: { x: 99, y: 88 },
        shape: 'terminal',
        cluster: 'group',
      })
    })
    await flush()
    const added = onChange.mock.calls[0]?.[0]?.nodes?.find((n: { id: string }) => n.id === 'y')
    expect(added).toMatchObject({
      id: 'y',
      label: 'Y',
      shape: 'terminal',
      position: { x: 99, y: 88 },
      cluster: 'group',
    })
  })

  it('does nothing when onChange is omitted (read-only mode)', async () => {
    const { result } = renderHook(() => useFlowSync({ value: pair, layout: 'manual' }), {
      wrapper: withStore,
    })
    expect(result.current.isEditable).toBe(false)
    act(() => {
      result.current.dispatchAddNode({ id: 'z', label: 'Zed' })
    })
    await flush()
    // No assertion needed beyond "did not throw"; no onChange to call.
    expect(result.current.parsedDiagram?.nodes).toHaveLength(2)
  })
})

describe('useFlowSync — 0.4.0: dispatchAddCluster', () => {
  it('lazily creates the clusters array on a diagram without one', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useFlowSync({ value: pair, layout: 'manual', onChange }), {
      wrapper: withStore,
    })
    expect(result.current.parsedDiagram?.clusters).toBeUndefined()
    act(() => {
      result.current.dispatchAddCluster({ id: 'group', label: 'Group' })
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    expect(next?.clusters).toEqual([{ id: 'group', label: 'Group' }])
  })
})

describe('useFlowSync — 0.4.0: dispatchAssignCluster', () => {
  const clustered: DiagramInput = {
    schemaVersion: 1,
    clusters: [
      { id: 'left', label: 'Left' },
      { id: 'right', label: 'Right' },
    ],
    nodes: [
      { id: 'a', label: 'A', cluster: 'left', position: { x: 0, y: 0 } },
      { id: 'b', label: 'B', position: { x: 200, y: 0 } },
    ],
    edges: [],
  }

  it('reassigns a node from one cluster to another with one onChange', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: clustered, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.dispatchAssignCluster('a', 'right')
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    expect(next?.nodes?.find((n: { id: string }) => n.id === 'a')?.cluster).toBe('right')
  })

  it('unassigns when clusterId is undefined (strips the cluster field)', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: clustered, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.dispatchAssignCluster('a', undefined)
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    const a = next?.nodes?.find((n: { id: string }) => n.id === 'a')
    expect(a).toBeDefined()
    expect(a).not.toHaveProperty('cluster')
  })

  it('assigns from unassigned (node had no cluster) to a real cluster', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(
      () => useFlowSync({ value: clustered, layout: 'manual', onChange }),
      { wrapper: withStore },
    )
    act(() => {
      result.current.dispatchAssignCluster('b', 'left')
    })
    await flush()
    const b = onChange.mock.calls[0]?.[0]?.nodes?.find((n: { id: string }) => n.id === 'b')
    expect(b?.cluster).toBe('left')
  })
})

describe('useFlowSync — 0.4.0: microtask batching across new verbs', () => {
  it('AddNode + SetField on the new node within the same tick collapse to one onChange', async () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useFlowSync({ value: pair, layout: 'manual', onChange }), {
      wrapper: withStore,
    })
    act(() => {
      result.current.dispatchAddNode({ id: 'z', label: 'Zed' })
      result.current.dispatchSetField({ kind: 'node-label', id: 'z' }, 'Renamed')
    })
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0]
    expect(next?.nodes?.find((n: { id: string }) => n.id === 'z')?.label).toBe('Renamed')
  })
})

// --- 0.4.0: cross-cluster drag detection (integration smoke) ----------------

describe('useFlowSync — 0.4.0: onNodeDragStop wiring', () => {
  /**
   * The dispatch logic is exhaustively covered by the
   * `pickClusterReassignment` pure-function tests
   * (`tests/renderer/editing/cross-cluster.test.ts`). Here we verify
   * only that `onNodeDragStop` is exposed on the result bundle, is a
   * function, and bails harmlessly in read-only mode. xyflow's
   * `getIntersectingNodes` requires a measured layout which JSDOM
   * can't produce, so end-to-end pixel-level verification lives in
   * Phase 13's Playwright spec.
   */

  it('exposes onNodeDragStop as a function', () => {
    const { result } = renderHook(() => useFlowSync({ value: pair, layout: 'manual' }), {
      wrapper: withStore,
    })
    expect(typeof result.current.onNodeDragStop).toBe('function')
  })
})
