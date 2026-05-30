import { expect, test } from '@playwright/test'

/**
 * Delete-cascade — selecting a node and pressing Delete fires one
 * `onChange` containing the cascade (node + incident edges gone).
 *
 * Exercises xyflow's real keyboard handling (`deleteKeyCode={['Backspace',
 * 'Delete']}` set in GraphRenderer Phase 7), which fires a `remove` change
 * through `onNodesChange`, which the sync hook (Phase 6) dispatches as a
 * `DeleteNode` patch with the schema reducer's cascade rule (Phase 1).
 */

test.describe('delete-cascade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  test('Delete on a selected node removes the node + incident edges and fires one onChange', async ({
    page,
  }) => {
    // Initial: 3 nodes, 2 edges (Idea -> Sketch -> Ship in the editable sample).
    const initialNodes = page.locator('.react-flow__node[data-id]:not([data-id^="cluster"])')
    await expect(initialNodes).toHaveCount(3)
    const initialEdges = page.locator('.react-flow__edge')
    await expect(initialEdges).toHaveCount(2)

    // Select the middle node (Sketch — id 'b') by clicking it. xyflow
    // updates selection on click.
    const middleNode = page.locator('.react-flow__node[data-id="b"]')
    await expect(middleNode).toBeVisible()
    await middleNode.click()

    // Wait for selection ring to render — visual confirmation xyflow
    // accepted the click. The `.selected` class is xyflow's own marker.
    await expect(middleNode).toHaveClass(/selected/)

    // Fire Delete. The whole document hosts the keymap so focus position
    // doesn't matter much here; xyflow handles deleteKeyCode itself.
    await page.keyboard.press('Delete')

    // After the cascade: 2 nodes remain (a, c), 0 edges (both pointed at b).
    await expect(page.locator('.react-flow__node[data-id="b"]')).toHaveCount(0)
    await expect(page.locator('.react-flow__node[data-id]:not([data-id^="cluster"])')).toHaveCount(
      2,
    )
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)

    // Exactly one onChange — single dispatch covering the cascade.
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
  })

  test('Backspace works the same as Delete', async ({ page }) => {
    const node = page.locator('.react-flow__node[data-id="a"]')
    await node.click()
    await expect(node).toHaveClass(/selected/)
    await page.keyboard.press('Backspace')
    await expect(page.locator('.react-flow__node[data-id="a"]')).toHaveCount(0)
  })
})
