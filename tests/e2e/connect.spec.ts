import { expect, test } from '@playwright/test'

/**
 * Drag-to-connect — after deleting a connection (or just to add a new
 * one), the user drags from a node's right source handle to another
 * node's left target handle to create an edge. xyflow's `onConnect`
 * fires, the sync hook dispatches a `ConnectEdge` patch, the reducer
 * appends the new `Edge` to the schema, and onChange fires once.
 *
 * Handles are hidden at rest (opacity: 0) and revealed on node hover
 * via the parent-hover CSS rule. The drag mechanics rely on
 * `connectionindicator` which xyflow adds when the node is connectable.
 */

test.describe('drag-to-connect', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  // FIXME: Playwright mouse-driven drag-to-connect is flaky against the
  // Phase 17 flex layout — xyflow's handle hit-testing fires
  // intermittently depending on browser timing between the chrome
  // slide-in animation and the bbox query. The underlying ConnectEdge
  // patch is exercised by tests/renderer/editing/sync.test.tsx via
  // synthetic onConnect calls, so the schema-side behavior is gated.
  // 0.4.1 cleanup item: re-write this spec to dispatch synthetic
  // pointer events bypassing the bbox-driven mouse path.
  test.fixme('dragging from a → c source handle to target handle creates a new edge', async ({
    page,
  }) => {
    // Wait for xyflow to paint the initial edges. Phase 21 seed: 3 edges
    // (Idea→Sketch, Sketch→Ship, Sketch→Constraint dashed).
    await expect(page.locator('.react-flow__edge')).toHaveCount(3)

    // Chrome mounts after the first paint (Inspector slides in from the
    // right via a 180 ms animation; that reflow shifts the canvas width
    // and re-positions the nodes via xyflow's fitView). Wait for the
    // animation to settle before we read handle positions, otherwise the
    // boundingBox values from below are mid-animation and the drag
    // misses xyflow's actual hit-targets.
    await expect(page.getByTestId('inkin-inspector')).toBeVisible()
    await page.waitForTimeout(500)

    // Hover over node a so its handles fade in (opacity: 1).
    const nodeA = page.locator('.react-flow__node[data-id="a"]')
    const nodeC = page.locator('.react-flow__node[data-id="c"]')
    await nodeA.hover()

    // Source handle = right side of node a. xyflow positions it via
    // `.react-flow__handle-right` and translates it half-out of the node
    // bounding box.
    const sourceHandle = nodeA.locator('.react-flow__handle-right')
    const targetHandle = nodeC.locator('.react-flow__handle-left')
    await expect(sourceHandle).toBeAttached()
    await expect(targetHandle).toBeAttached()

    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await targetHandle.boundingBox()
    if (sourceBox === null || targetBox === null) throw new Error('handle bbox missing')

    // Manual drag — Playwright's high-level .dragTo() doesn't always
    // produce the pointer-event sequence xyflow's connection state
    // machine needs. Move slowly with multiple steps to keep xyflow's
    // hit-testing happy.
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 12,
    })
    await page.mouse.up()

    // New edge added; exactly one onChange fired (3 seed + 1 new = 4).
    await expect(page.locator('.react-flow__edge')).toHaveCount(4)
    await expect(page.getByTestId('onchange-count')).toHaveText('1')

    // The new edge gets an editable empty-label slot — same opaque
    // chip styling as "refine" / "release" so the affordance reads as
    // editable at a glance. Verify the slot exists and that dispatching
    // a dblclick on it opens the input. We use dispatchEvent here
    // because in this specific a → c geometry, xyflow places the edge
    // midpoint over node b (Sketch), which would intercept a real
    // pixel-level dblclick — a positioning artifact unrelated to the
    // editability fix.
    const placeholderLabel = page.locator('div[tabindex="-1"]').filter({ hasText: 'label' }).first()
    await expect(placeholderLabel).toBeAttached()
    await placeholderLabel.dispatchEvent('dblclick')

    const input = page.getByLabel(/^label for edge /)
    await expect(input).toBeVisible()
    await input.fill('reconnected')
    await input.press('Enter')

    await expect(input).not.toBeVisible()
    await expect(
      page.locator('div[tabindex="-1"]').filter({ hasText: 'reconnected' }).first(),
    ).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('2')
  })
})
