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

  test('dragging from a → c source handle to target handle creates a new edge', async ({
    page,
  }) => {
    // Wait for xyflow to paint the initial edges.
    await expect(page.locator('.react-flow__edge')).toHaveCount(2)

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
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 12 },
    )
    await page.mouse.up()

    // New edge added; exactly one onChange fired.
    await expect(page.locator('.react-flow__edge')).toHaveCount(3)
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
  })
})
