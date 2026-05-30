// @vitest-environment jsdom

/**
 * Phase 11 keymap unit tests.
 *
 *   - Arrow keys with selection dispatch one MoveNode per selected node.
 *   - Arrow keys with no selection pass through (let xyflow's default
 *     pan handle it).
 *   - Enter on a focused node dispatches startEdit on the EditSlice with
 *     a `node-label` target.
 *   - Esc with an active inline edit dispatches cancel; no selection
 *     change.
 *   - Esc without an active edit clears the selection.
 *   - Esc / Enter / Arrows all become no-ops in read-only mode (enabled=false).
 *
 * The hook is exercised inside an InkinStoreProvider so the store reads in
 * the handler resolve. EditingProvider is mounted with a stub
 * `dispatchSetField` so the Enter path's downstream commit chain has
 * something to call (but Enter only triggers startEdit, which doesn't
 * touch dispatchSetField).
 */

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEffect, useRef } from 'react'
import { useKeymap, NUDGE_STEP } from '../../../src/renderer/a11y/keymap'
import { EditingProvider } from '../../../src/renderer/editing/EditingContext'
import {
  InkinStoreProvider,
  useEditorStoreApi,
} from '../../../src/renderer/store'

afterEach(() => {
  cleanup()
})

/**
 * Test harness: renders a focusable wrapper element, mounts `useKeymap`
 * targeting it, and exposes the store via a callback so tests can prime
 * selection / edit state and assert results.
 */
interface HarnessProps {
  readonly enabled?: boolean
  readonly dispatchMoveNode?: ReturnType<typeof vi.fn>
  readonly dispatchSetField?: ReturnType<typeof vi.fn>
  /** Called once with the live store API. */
  readonly storeRef?: (api: ReturnType<typeof useEditorStoreApi>) => void
}

function Harness({
  enabled = true,
  dispatchMoveNode = vi.fn(),
  dispatchSetField = vi.fn(),
  storeRef,
}: HarnessProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  return (
    <InkinStoreProvider>
      <EditingProvider dispatchSetField={dispatchSetField}>
        <KeymapMount
          wrapperRef={wrapperRef}
          enabled={enabled}
          dispatchMoveNode={dispatchMoveNode}
        />
        <StoreExposer storeRef={storeRef} />
        <div ref={wrapperRef} data-testid="wrapper" tabIndex={0} />
      </EditingProvider>
    </InkinStoreProvider>
  )
}

function KeymapMount({
  wrapperRef,
  enabled,
  dispatchMoveNode,
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>
  enabled: boolean
  dispatchMoveNode: (nodeId: string, dx: number, dy: number) => void
}) {
  useKeymap({ target: wrapperRef, enabled, dispatchMoveNode })
  return null
}

function StoreExposer({ storeRef }: { storeRef?: HarnessProps['storeRef'] }) {
  const api = useEditorStoreApi()
  useEffect(() => {
    storeRef?.(api)
  }, [api, storeRef])
  return null
}

function fireKey(element: HTMLElement, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

type StoreApi = ReturnType<typeof useEditorStoreApi>

/**
 * Mutable holder for the store API exposed by Harness — using an object
 * (instead of `let storeApi: StoreApi | null = null`) prevents TypeScript
 * from narrowing the local binding to `null` after the initial assignment.
 */
function mkRef() {
  return { api: null as StoreApi | null }
}

describe('useKeymap — arrow keys', () => {
  it('dispatches one MoveNode per selected node on ArrowRight', () => {
    const dispatchMoveNode = vi.fn()
    const ref = mkRef()
    const { getByTestId } = render(
      <Harness dispatchMoveNode={dispatchMoveNode} storeRef={(api) => (ref.api = api)} />,
    )
    expect(ref.api).not.toBeNull()
    act(() => {
      ref.api?.getState().setSelection({ nodes: new Set(['a', 'b']) })
    })

    fireKey(getByTestId('wrapper'), 'ArrowRight')

    expect(dispatchMoveNode).toHaveBeenCalledTimes(2)
    expect(dispatchMoveNode).toHaveBeenCalledWith('a', NUDGE_STEP, 0)
    expect(dispatchMoveNode).toHaveBeenCalledWith('b', NUDGE_STEP, 0)
  })

  it('uses the correct delta for each arrow direction', () => {
    const dispatchMoveNode = vi.fn()
    const ref = mkRef()
    const { getByTestId } = render(
      <Harness dispatchMoveNode={dispatchMoveNode} storeRef={(api) => (ref.api = api)} />,
    )
    act(() => {
      ref.api?.getState().setSelection({ nodes: new Set(['a']) })
    })

    fireKey(getByTestId('wrapper'), 'ArrowUp')
    fireKey(getByTestId('wrapper'), 'ArrowDown')
    fireKey(getByTestId('wrapper'), 'ArrowLeft')
    fireKey(getByTestId('wrapper'), 'ArrowRight')

    expect(dispatchMoveNode).toHaveBeenNthCalledWith(1, 'a', 0, -NUDGE_STEP)
    expect(dispatchMoveNode).toHaveBeenNthCalledWith(2, 'a', 0, NUDGE_STEP)
    expect(dispatchMoveNode).toHaveBeenNthCalledWith(3, 'a', -NUDGE_STEP, 0)
    expect(dispatchMoveNode).toHaveBeenNthCalledWith(4, 'a', NUDGE_STEP, 0)
  })

  it('does NOT dispatch when no nodes are selected (xyflow pan passes through)', () => {
    const dispatchMoveNode = vi.fn()
    const { getByTestId } = render(<Harness dispatchMoveNode={dispatchMoveNode} />)
    fireKey(getByTestId('wrapper'), 'ArrowRight')
    expect(dispatchMoveNode).not.toHaveBeenCalled()
  })
})

describe('useKeymap — Enter on focused node', () => {
  it('dispatches startEdit with kind=node-label for the data-id of the focused element', () => {
    const ref = mkRef()
    const { getByTestId, container } = render(
      <Harness storeRef={(api) => (ref.api = api)} />,
    )

    // Create a focusable element with data-id matching xyflow's contract.
    const nodeEl = document.createElement('div')
    nodeEl.setAttribute('data-id', 'a')
    nodeEl.setAttribute('tabindex', '0')
    container.appendChild(nodeEl)
    nodeEl.focus()
    expect(document.activeElement).toBe(nodeEl)

    fireKey(getByTestId('wrapper'), 'Enter')

    expect(ref.api?.getState().editTarget).toEqual({ kind: 'node-label', id: 'a' })
  })

  it('no-op when no node has focus (no data-id on activeElement)', () => {
    const ref = mkRef()
    const { getByTestId } = render(<Harness storeRef={(api) => (ref.api = api)} />)
    fireKey(getByTestId('wrapper'), 'Enter')
    expect(ref.api?.getState().editTarget).toBeNull()
  })
})

describe('useKeymap — Esc semantics', () => {
  it('cancels an active inline edit; selection is untouched', () => {
    const ref = mkRef()
    const { getByTestId } = render(<Harness storeRef={(api) => (ref.api = api)} />)
    act(() => {
      ref.api?.getState().setSelection({ nodes: new Set(['a']) })
      ref.api?.getState().startEdit({ kind: 'node-label', id: 'a' }, 'initial')
    })

    fireKey(getByTestId('wrapper'), 'Escape')

    const state = ref.api?.getState()
    expect(state?.editTarget).toBeNull()
    expect(state?.selectedNodeIds.size).toBe(1)
  })

  it('clears selection when no edit is active', () => {
    const ref = mkRef()
    const { getByTestId } = render(<Harness storeRef={(api) => (ref.api = api)} />)
    act(() => {
      ref.api?.getState().setSelection({
        nodes: new Set(['a']),
        edges: new Set(['e1']),
      })
    })

    fireKey(getByTestId('wrapper'), 'Escape')

    const state = ref.api?.getState()
    expect(state?.selectedNodeIds.size).toBe(0)
    expect(state?.selectedEdgeIds.size).toBe(0)
  })
})

describe('useKeymap — read-only mode (enabled=false)', () => {
  it('is a no-op for arrows, Enter, and Esc', () => {
    const dispatchMoveNode = vi.fn()
    const ref = mkRef()
    const { getByTestId } = render(
      <Harness
        enabled={false}
        dispatchMoveNode={dispatchMoveNode}
        storeRef={(api) => (ref.api = api)}
      />,
    )
    act(() => {
      ref.api?.getState().setSelection({ nodes: new Set(['a']) })
    })

    fireKey(getByTestId('wrapper'), 'ArrowUp')
    fireKey(getByTestId('wrapper'), 'Enter')
    fireKey(getByTestId('wrapper'), 'Escape')

    expect(dispatchMoveNode).not.toHaveBeenCalled()
    expect(ref.api?.getState().selectedNodeIds.size).toBe(1)
  })
})
