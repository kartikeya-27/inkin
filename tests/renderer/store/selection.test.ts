import { describe, expect, it } from 'vitest'
import { createInkinStore } from '../../../src/renderer/store'
import {
  EMPTY_SELECTION,
  selectionEquals,
} from '../../../src/renderer/store/selection'

/**
 * SelectionSlice unit tests.
 *
 * Strategy: instantiate a per-test store via `createInkinStore()` (matching
 * how `<InkinStoreProvider>` does it at runtime), exercise the actions, and
 * read state back via `store.getState()`. We never use the React `useStore`
 * hook here — that's covered in the React integration tests in Phase 14.
 *
 * The Phase 3 verification gate is identity preservation: setting the same
 * selection twice must NOT replace the existing Set reference, so subscribers
 * with selectors like `(s) => s.selectedNodeIds` don't re-render on a no-op
 * update.
 */

describe('SelectionSlice — initial state', () => {
  it('starts with the shared empty Set in all three fields', () => {
    const store = createInkinStore()
    const state = store.getState()
    expect(state.selectedNodeIds).toBe(EMPTY_SELECTION)
    expect(state.selectedEdgeIds).toBe(EMPTY_SELECTION)
    expect(state.selectedClusterIds).toBe(EMPTY_SELECTION)
  })

  it('exposes setSelection and clearSelection actions', () => {
    const state = createInkinStore().getState()
    expect(typeof state.setSelection).toBe('function')
    expect(typeof state.clearSelection).toBe('function')
  })
})

describe('SelectionSlice — setSelection identity preservation', () => {
  it('preserves the existing Set reference when the proposed selection has identical contents', () => {
    const store = createInkinStore()
    store.getState().setSelection({ nodes: new Set(['a', 'b']) })
    const after1st = store.getState().selectedNodeIds

    // Different Set instance, identical members — should NOT replace state.
    store.getState().setSelection({ nodes: new Set(['b', 'a']) })
    const after2nd = store.getState().selectedNodeIds

    expect(after2nd).toBe(after1st)
  })

  it('replaces the Set reference when contents actually differ (added element)', () => {
    const store = createInkinStore()
    store.getState().setSelection({ nodes: new Set(['a']) })
    const before = store.getState().selectedNodeIds

    store.getState().setSelection({ nodes: new Set(['a', 'b']) })
    const after = store.getState().selectedNodeIds

    expect(after).not.toBe(before)
    expect(after.size).toBe(2)
    expect(after.has('b')).toBe(true)
  })

  it('replaces the Set reference when contents actually differ (removed element)', () => {
    const store = createInkinStore()
    store.getState().setSelection({ nodes: new Set(['a', 'b']) })
    const before = store.getState().selectedNodeIds

    store.getState().setSelection({ nodes: new Set(['a']) })
    const after = store.getState().selectedNodeIds

    expect(after).not.toBe(before)
    expect(after.size).toBe(1)
    expect(after.has('b')).toBe(false)
  })

  it('updates only the fields supplied in the partial', () => {
    const store = createInkinStore()
    store.getState().setSelection({ nodes: new Set(['n1']), edges: new Set(['e1']) })
    const nodesBefore = store.getState().selectedNodeIds
    const edgesBefore = store.getState().selectedEdgeIds

    // Only touch edges — nodes Set must keep identity.
    store.getState().setSelection({ edges: new Set(['e1', 'e2']) })
    const state = store.getState()
    expect(state.selectedNodeIds).toBe(nodesBefore)
    expect(state.selectedEdgeIds).not.toBe(edgesBefore)
    expect(state.selectedEdgeIds.size).toBe(2)
  })

  it('does not notify subscribers when the proposed selection is identical', () => {
    const store = createInkinStore()
    store.getState().setSelection({ nodes: new Set(['a']) })
    let calls = 0
    const unsub = store.subscribe(() => {
      calls += 1
    })
    store.getState().setSelection({ nodes: new Set(['a']) })
    unsub()
    expect(calls).toBe(0)
  })
})

describe('SelectionSlice — clearSelection', () => {
  it('resets all three fields back to the shared empty Set', () => {
    const store = createInkinStore()
    store.getState().setSelection({
      nodes: new Set(['n']),
      edges: new Set(['e']),
      clusters: new Set(['c']),
    })
    store.getState().clearSelection()
    const state = store.getState()
    expect(state.selectedNodeIds).toBe(EMPTY_SELECTION)
    expect(state.selectedEdgeIds).toBe(EMPTY_SELECTION)
    expect(state.selectedClusterIds).toBe(EMPTY_SELECTION)
  })

  it('is a no-op when every field is already empty (no subscriber notification)', () => {
    const store = createInkinStore()
    let calls = 0
    const unsub = store.subscribe(() => {
      calls += 1
    })
    store.getState().clearSelection()
    unsub()
    expect(calls).toBe(0)
  })

  it('only resets the non-empty fields when called with mixed state', () => {
    const store = createInkinStore()
    store.getState().setSelection({ nodes: new Set(['n']) })
    const edgesBefore = store.getState().selectedEdgeIds
    store.getState().clearSelection()
    const state = store.getState()
    expect(state.selectedNodeIds).toBe(EMPTY_SELECTION)
    // Edges was already empty — same reference preserved.
    expect(state.selectedEdgeIds).toBe(edgesBefore)
  })
})

describe('SelectionSlice — per-instance isolation', () => {
  it('two stores hold independent selection state', () => {
    const a = createInkinStore()
    const b = createInkinStore()
    a.getState().setSelection({ nodes: new Set(['only-in-a']) })
    expect(a.getState().selectedNodeIds.has('only-in-a')).toBe(true)
    expect(b.getState().selectedNodeIds.size).toBe(0)
  })
})

describe('selectionEquals — pure helper', () => {
  it('returns true for the same reference', () => {
    const s = new Set(['a'])
    expect(selectionEquals(s, s)).toBe(true)
  })

  it('returns true for equal contents in different instances', () => {
    expect(selectionEquals(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
  })

  it('returns false when sizes differ', () => {
    expect(selectionEquals(new Set(['a']), new Set(['a', 'b']))).toBe(false)
  })

  it('returns false when contents differ', () => {
    expect(selectionEquals(new Set(['a']), new Set(['b']))).toBe(false)
  })

  it('returns true for two empty Sets', () => {
    expect(selectionEquals(new Set(), new Set())).toBe(true)
  })
})
