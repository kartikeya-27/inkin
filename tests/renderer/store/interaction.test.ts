import { describe, expect, it, vi } from 'vitest'
import { createInkinStore } from '../../../src/renderer/store'
import { pointEquals } from '../../../src/renderer/store/interaction'

/**
 * InteractionSlice unit tests.
 *
 * Strategy mirrors SelectionSlice's tests: instantiate a per-test store
 * via `createInkinStore()`, exercise actions through `getState()`, assert
 * both the post-write state AND the absence of notifications on no-op
 * writes. The identity-preservation gate matters here because the
 * canvas's `onNodeDrag` ticks ~60 Hz during a cross-cluster drag and
 * must not trigger React re-renders unless the hovered cluster actually
 * changed.
 */

describe('InteractionSlice — initial state', () => {
  it('mode defaults to idle', () => {
    expect(createInkinStore().getState().mode).toBe('idle')
  })

  it('placementOrigin defaults to null', () => {
    expect(createInkinStore().getState().placementOrigin).toBe(null)
  })

  it('hoveredClusterId defaults to null', () => {
    expect(createInkinStore().getState().hoveredClusterId).toBe(null)
  })

  it('exposes the four placement / hover actions', () => {
    const state = createInkinStore().getState()
    expect(typeof state.enterPlacementMode).toBe('function')
    expect(typeof state.exitPlacementMode).toBe('function')
    expect(typeof state.setPlacementOrigin).toBe('function')
    expect(typeof state.setHoveredCluster).toBe('function')
  })
})

describe('InteractionSlice — enterPlacementMode', () => {
  it('sets mode to placing-node', () => {
    const store = createInkinStore()
    store.getState().enterPlacementMode('placing-node')
    expect(store.getState().mode).toBe('placing-node')
  })

  it('sets mode to placing-cluster', () => {
    const store = createInkinStore()
    store.getState().enterPlacementMode('placing-cluster')
    expect(store.getState().mode).toBe('placing-cluster')
  })

  it('switching modes clears placementOrigin', () => {
    const store = createInkinStore()
    store.getState().enterPlacementMode('placing-cluster')
    store.getState().setPlacementOrigin({ x: 10, y: 20 })
    store.getState().enterPlacementMode('placing-node')
    expect(store.getState().mode).toBe('placing-node')
    expect(store.getState().placementOrigin).toBe(null)
  })

  it('is a no-op (no subscriber notification) when called with the current mode', () => {
    const store = createInkinStore()
    store.getState().enterPlacementMode('placing-node')
    const listener = vi.fn()
    store.subscribe(listener)
    store.getState().enterPlacementMode('placing-node')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('InteractionSlice — exitPlacementMode', () => {
  it('returns mode to idle', () => {
    const store = createInkinStore()
    store.getState().enterPlacementMode('placing-cluster')
    store.getState().exitPlacementMode()
    expect(store.getState().mode).toBe('idle')
  })

  it('clears placementOrigin', () => {
    const store = createInkinStore()
    store.getState().enterPlacementMode('placing-cluster')
    store.getState().setPlacementOrigin({ x: 5, y: 5 })
    store.getState().exitPlacementMode()
    expect(store.getState().placementOrigin).toBe(null)
  })

  it('is a no-op when already idle with null origin', () => {
    const store = createInkinStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.getState().exitPlacementMode()
    expect(listener).not.toHaveBeenCalled()
  })

  it('does notify when origin is non-null even if mode is idle', () => {
    // Pathological state: caller set placementOrigin without entering a
    // placement mode. exitPlacementMode should still clean it up.
    const store = createInkinStore()
    store.getState().setPlacementOrigin({ x: 1, y: 1 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.getState().exitPlacementMode()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().placementOrigin).toBe(null)
  })
})

describe('InteractionSlice — setPlacementOrigin', () => {
  it('sets a coordinate point', () => {
    const store = createInkinStore()
    store.getState().setPlacementOrigin({ x: 100, y: 200 })
    expect(store.getState().placementOrigin).toEqual({ x: 100, y: 200 })
  })

  it('null clears the origin', () => {
    const store = createInkinStore()
    store.getState().setPlacementOrigin({ x: 1, y: 1 })
    store.getState().setPlacementOrigin(null)
    expect(store.getState().placementOrigin).toBe(null)
  })

  it('setting the same point twice does not notify', () => {
    const store = createInkinStore()
    store.getState().setPlacementOrigin({ x: 50, y: 60 })
    const listener = vi.fn()
    store.subscribe(listener)
    // Different object reference, identical coordinates.
    store.getState().setPlacementOrigin({ x: 50, y: 60 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('null when already null does not notify', () => {
    const store = createInkinStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.getState().setPlacementOrigin(null)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('InteractionSlice — setHoveredCluster', () => {
  it('sets the cluster id', () => {
    const store = createInkinStore()
    store.getState().setHoveredCluster('left')
    expect(store.getState().hoveredClusterId).toBe('left')
  })

  it('null clears the id', () => {
    const store = createInkinStore()
    store.getState().setHoveredCluster('left')
    store.getState().setHoveredCluster(null)
    expect(store.getState().hoveredClusterId).toBe(null)
  })

  it('setting the same id does not notify (per-frame onNodeDrag guard)', () => {
    const store = createInkinStore()
    store.getState().setHoveredCluster('left')
    const listener = vi.fn()
    store.subscribe(listener)
    store.getState().setHoveredCluster('left')
    expect(listener).not.toHaveBeenCalled()
  })

  it('null when already null does not notify', () => {
    const store = createInkinStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.getState().setHoveredCluster(null)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('pointEquals helper', () => {
  it('returns true for identical x/y pairs from different object refs', () => {
    expect(pointEquals({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true)
  })

  it('returns false on any coordinate mismatch', () => {
    expect(pointEquals({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false)
    expect(pointEquals({ x: 1, y: 2 }, { x: 2, y: 2 })).toBe(false)
  })
})
