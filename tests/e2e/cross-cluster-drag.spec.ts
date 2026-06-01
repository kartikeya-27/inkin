import { expect, test } from '@playwright/test'

/**
 * Cross-cluster drag e2e.
 *
 * The drag-end decision logic (`pickClusterReassignment`) is exhaustively
 * covered by `tests/renderer/editing/cross-cluster.test.ts` — 10 unit
 * tests across every branch of the decision tree against synthetic
 * intersection inputs. The Inspector-driven cluster-reassignment path
 * (which exercises the same `SetField{node-cluster}` dispatcher and
 * canvas re-render) is gated by `tests/e2e/inspector.spec.ts`'s
 * "changing cluster reassigns the node" test.
 *
 * What this file covers: the INSPECTOR-side proof that the schema's
 * cluster state IS readable through the form when a node is selected.
 * This is the gate that the cross-cluster-via-drag flow relies on to
 * verify reassignment — without it, any drag-based assertion would
 * have no schema source-of-truth check.
 *
 * The drag-into-cluster path itself is not asserted here because
 * xyflow's drag pipeline does not deterministically translate an
 * arbitrary pointer-drag into a SetField{node-cluster} dispatch under
 * the current `extent: 'parent'` configuration — the spatial
 * intersection has to land precisely within the auto-computed cluster
 * bounds, which depend on Lightning CSS measurement timing. The
 * decision logic is unit-tested; the Inspector dropdown is e2e-tested;
 * the wire-up is integration-tested.
 */

test.describe('cross-cluster drag — schema readback through Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  test('a node seeded with cluster="notes" reads as cluster="notes" in the Inspector', async ({
    page,
  }) => {
    // The editable sample seeds n1 + n2 with `cluster: 'notes'`. Verify
    // the Inspector reads the schema correctly — this is the
    // "Inspector is schema-authoritative" gate that any cluster-
    // reassignment proof depends on.
    await page.locator('.react-flow__node[data-id="n1"]').click()
    const inspector = page.getByTestId('inkin-inspector')
    await expect(inspector.getByLabel('Cluster')).toHaveValue('notes')
  })

  test('a top-level node reads as cluster="" (unassigned) in the Inspector', async ({ page }) => {
    // Node 'a' is top-level in the seed. The "no cluster" state in the
    // Inspector dropdown is the empty string (— none — option).
    await page.locator('.react-flow__node[data-id="a"]').click()
    const inspector = page.getByTestId('inkin-inspector')
    await expect(inspector.getByLabel('Cluster')).toHaveValue('')
  })
})
