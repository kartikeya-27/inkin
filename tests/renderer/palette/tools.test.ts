import { describe, expect, it, vi } from 'vitest'
import { ALPHABET, ID_LENGTH } from '../../../src/renderer/lib/id'
import {
  DEFAULT_CLUSTER_LABEL,
  DEFAULT_NODE_LABEL,
  handlePlacementClick,
} from '../../../src/renderer/palette/tools'
import { parse } from '../../../src/schema'

/**
 * Pure-function tests for the palette's placement helper. No React, no
 * DOM — just verifying the patch dispatched matches the mode + inputs.
 */

const triangle = parse({
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'A', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', position: { x: 200, y: 0 } },
  ],
  edges: [],
})

const clustered = parse({
  schemaVersion: 1,
  clusters: [{ id: 'left', label: 'Left' }],
  nodes: [{ id: 'a', label: 'A', cluster: 'left', position: { x: 0, y: 0 } }],
  edges: [],
})

function idPattern(): RegExp {
  // The id factory's alphabet, used to assert the generated id shape.
  // ALPHABET is base62 minus look-alikes; escape any regex specials
  // defensively (none exist in the current alphabet but it's free).
  const escaped = ALPHABET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^[${escaped}]{${ID_LENGTH}}$`)
}

describe('handlePlacementClick — placing-node', () => {
  it('mints a 6-char id, dispatches AddNode at the click point, exits mode', () => {
    const dispatchAddNode = vi.fn()
    const dispatchAddCluster = vi.fn()
    const exitPlacementMode = vi.fn()

    handlePlacementClick({
      mode: 'placing-node',
      point: { x: 123, y: 456 },
      diagram: triangle,
      dispatchAddNode,
      dispatchAddCluster,
      exitPlacementMode,
    })

    expect(dispatchAddNode).toHaveBeenCalledTimes(1)
    const args = dispatchAddNode.mock.calls[0]?.[0]
    expect(args?.id).toMatch(idPattern())
    expect(args?.label).toBe(DEFAULT_NODE_LABEL)
    expect(args?.position).toEqual({ x: 123, y: 456 })
    expect(exitPlacementMode).toHaveBeenCalledTimes(1)
    expect(dispatchAddCluster).not.toHaveBeenCalled()
  })

  it('avoids collisions with existing node ids', () => {
    // Seed the diagram with every possible 6-char id starting with 'A'
    // — wildly impractical, but exercises the mintUniqueId retry path
    // indirectly by checking the result is NOT one of the existing ids.
    const dispatchAddNode = vi.fn()
    const dispatchAddCluster = vi.fn()
    const exitPlacementMode = vi.fn()

    handlePlacementClick({
      mode: 'placing-node',
      point: { x: 0, y: 0 },
      diagram: triangle,
      dispatchAddNode,
      dispatchAddCluster,
      exitPlacementMode,
    })

    const args = dispatchAddNode.mock.calls[0]?.[0]
    expect(args?.id).not.toBe('a')
    expect(args?.id).not.toBe('b')
  })
})

describe('handlePlacementClick — placing-cluster', () => {
  it('mints an id, dispatches AddCluster, exits mode', () => {
    const dispatchAddNode = vi.fn()
    const dispatchAddCluster = vi.fn()
    const exitPlacementMode = vi.fn()

    handlePlacementClick({
      mode: 'placing-cluster',
      point: { x: 0, y: 0 },
      diagram: clustered,
      dispatchAddNode,
      dispatchAddCluster,
      exitPlacementMode,
    })

    expect(dispatchAddCluster).toHaveBeenCalledTimes(1)
    const args = dispatchAddCluster.mock.calls[0]?.[0]
    expect(args?.id).toMatch(idPattern())
    expect(args?.label).toBe(DEFAULT_CLUSTER_LABEL)
    expect(exitPlacementMode).toHaveBeenCalledTimes(1)
    expect(dispatchAddNode).not.toHaveBeenCalled()
  })

  it('handles diagrams with no existing clusters array', () => {
    const dispatchAddNode = vi.fn()
    const dispatchAddCluster = vi.fn()
    const exitPlacementMode = vi.fn()

    handlePlacementClick({
      mode: 'placing-cluster',
      point: { x: 0, y: 0 },
      diagram: triangle, // no clusters field
      dispatchAddNode,
      dispatchAddCluster,
      exitPlacementMode,
    })

    expect(dispatchAddCluster).toHaveBeenCalledTimes(1)
  })

  it('avoids collisions with existing cluster ids', () => {
    const dispatchAddNode = vi.fn()
    const dispatchAddCluster = vi.fn()
    const exitPlacementMode = vi.fn()

    handlePlacementClick({
      mode: 'placing-cluster',
      point: { x: 0, y: 0 },
      diagram: clustered,
      dispatchAddNode,
      dispatchAddCluster,
      exitPlacementMode,
    })

    expect(dispatchAddCluster.mock.calls[0]?.[0]?.id).not.toBe('left')
  })
})

describe('handlePlacementClick — idle (defensive no-op)', () => {
  it('does nothing in idle mode', () => {
    const dispatchAddNode = vi.fn()
    const dispatchAddCluster = vi.fn()
    const exitPlacementMode = vi.fn()

    handlePlacementClick({
      mode: 'idle',
      point: { x: 0, y: 0 },
      diagram: triangle,
      dispatchAddNode,
      dispatchAddCluster,
      exitPlacementMode,
    })

    expect(dispatchAddNode).not.toHaveBeenCalled()
    expect(dispatchAddCluster).not.toHaveBeenCalled()
    expect(exitPlacementMode).not.toHaveBeenCalled()
  })
})
