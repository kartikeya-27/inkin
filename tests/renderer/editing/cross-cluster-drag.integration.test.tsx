// @vitest-environment jsdom

/**
 * Phase 12 integration coverage — cross-cluster drag-and-drop.
 *
 * The drag-end decision logic is exhaustively covered by the pure-
 * function tests in `cross-cluster.test.ts` (10 cases across no-change,
 * reassign, unassign, multi-intersection pick policy, dimension-missing
 * fallback). The wiring (`useFlowSync.onNodeDragStop` → `dispatchPatch`
 * → microtask flush → `onChange`) is covered by the smoke check in
 * `sync.test.tsx` plus the prop-forwarding gates in `DiagramStudio.test.tsx`.
 *
 * What's NOT covered by JSDOM tests, and why:
 *
 *   - The bridge between xyflow's `getIntersectingNodes` (a spatial-index
 *     query against measured node dimensions) and our handler. xyflow's
 *     intersection math relies on layout boxes that JSDOM doesn't compute
 *     — every node ends up at (0, 0) with zero width/height, so the
 *     intersection set is either empty or contains every node trivially.
 *     Neither result is informative.
 *
 *   - Real pointer-driven drag events. xyflow's drag pipeline uses
 *     `pointermove` / `pointerup` against a measured viewport; firing
 *     synthetic events doesn't trigger the drag-end callback.
 *
 * Phase 13's Playwright e2e covers the spatial path against a real
 * browser: drag a node from outside a cluster into its bounds, assert
 * the schema records the reassignment, and verify a single `onChange`
 * carries both the new position and the new cluster (microtask batching
 * gate).
 *
 * This integration file documents the trade-off explicitly so a future
 * reviewer doesn't waste time trying to write a JSDOM-friendly intersection
 * test. The single placeholder test below verifies the file is reachable
 * and the trade-off note isn't accidentally stale.
 */

import { describe, expect, it } from 'vitest'
import { pickClusterReassignment } from '../../../src/renderer/editing/cross-cluster'

describe('cross-cluster drag integration (Phase 12 placeholder)', () => {
  it('relies on cross-cluster.test.ts + Phase 13 Playwright per the file header note', () => {
    // Sanity-check that the pure helper is importable from the same path
    // the hook uses. If this assertion ever fails, the helper export was
    // renamed and the trade-off note above needs to be revised.
    expect(typeof pickClusterReassignment).toBe('function')
  })
})
