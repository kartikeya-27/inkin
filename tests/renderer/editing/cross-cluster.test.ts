import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { pickClusterReassignment } from '../../../src/renderer/editing/cross-cluster'
import { parse } from '../../../src/schema'

/**
 * Unit tests for the pure cross-cluster decision helper.
 *
 * Why these live in their own file: the hook integration (`onNodeDragStop`
 * in `useFlowSync`) can't be cleanly tested against the real
 * `useReactFlow().getIntersectingNodes` under JSDOM because the spatial
 * index needs measured node dimensions, which JSDOM doesn't compute.
 * Extracting the decision logic into a pure function lets us cover every
 * branch deterministically without any mocking gymnastics; Phase 13's
 * Playwright e2e covers the spatial query against a real browser.
 */

function clusterNode(id: string, width = 200, height = 200): Node {
  return {
    id,
    type: 'cluster',
    position: { x: 0, y: 0 },
    data: {},
    measured: { width, height },
  } as unknown as Node
}

function nonClusterNode(id: string, type = 'rect'): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {},
  } as unknown as Node
}

const seed = parse({
  schemaVersion: 1,
  clusters: [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
  ],
  nodes: [
    { id: 'a', label: 'A', cluster: 'left', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', position: { x: 200, y: 200 } }, // top-level
  ],
  edges: [],
})

describe('pickClusterReassignment — no-change cases', () => {
  it('returns null when the dropped node id is not in the schema', () => {
    expect(pickClusterReassignment('ghost', [clusterNode('left')], seed)).toBeNull()
  })

  it('returns null when an in-cluster node intersects the SAME cluster', () => {
    // Node 'a' is in cluster 'left'; drop still resolves to 'left'.
    expect(pickClusterReassignment('a', [clusterNode('left')], seed)).toBeNull()
  })

  it('returns null when a top-level node intersects nothing', () => {
    // Node 'b' is top-level; drop intersects no clusters.
    expect(pickClusterReassignment('b', [], seed)).toBeNull()
  })

  it('returns null when the intersection set contains only non-cluster nodes', () => {
    // Sibling nodes overlap but no cluster does; treat as "still top-level".
    expect(
      pickClusterReassignment('b', [nonClusterNode('a'), nonClusterNode('c', 'terminal')], seed),
    ).toBeNull()
  })
})

describe('pickClusterReassignment — assign / reassign / unassign', () => {
  it('assigns a top-level node when it intersects a cluster', () => {
    const decision = pickClusterReassignment('b', [clusterNode('left')], seed)
    expect(decision).toEqual({ newCluster: 'left' })
  })

  it('reassigns a node from one cluster to a different one', () => {
    // Node 'a' is in 'left'; intersection resolves to 'right'.
    const decision = pickClusterReassignment('a', [clusterNode('right')], seed)
    expect(decision).toEqual({ newCluster: 'right' })
  })

  it('unassigns a node (empty-string sentinel) when dropped outside all clusters', () => {
    // Node 'a' was in 'left'; drop intersects nothing — empty string strips
    // the cluster field via the SetField reducer arm.
    const decision = pickClusterReassignment('a', [], seed)
    expect(decision).toEqual({ newCluster: '' })
  })
})

describe('pickClusterReassignment — pick policy on multiple intersections', () => {
  it('picks the smallest-area cluster when multiple intersect', () => {
    // 'right' is the more specific (smaller-area) containment.
    const decision = pickClusterReassignment(
      'b',
      [clusterNode('left', 500, 500), clusterNode('right', 100, 100)],
      seed,
    )
    expect(decision).toEqual({ newCluster: 'right' })
  })

  it('ignores non-cluster entries in the intersection set', () => {
    const decision = pickClusterReassignment(
      'b',
      [nonClusterNode('a'), clusterNode('left', 100, 100), nonClusterNode('c', 'terminal')],
      seed,
    )
    expect(decision).toEqual({ newCluster: 'left' })
  })

  it('treats missing dimensions as POSITIVE_INFINITY (never beats measured)', () => {
    const unmeasured = {
      id: 'big',
      type: 'cluster',
      position: { x: 0, y: 0 },
      data: {},
    } as unknown as Node // no `measured`, no `width`/`height`
    const decision = pickClusterReassignment('b', [unmeasured, clusterNode('left', 100, 100)], seed)
    // Measured 'left' wins over unmeasured 'big'.
    expect(decision).toEqual({ newCluster: 'left' })
  })
})
