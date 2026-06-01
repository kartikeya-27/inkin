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
    // Initial: 4 non-cluster nodes (Idea, Sketch, Ship + Constraint
    // inside the context cluster per the Phase 21 editable sample), 3
    // edges (Idea→Sketch, Sketch→Ship, Sketch→Constraint dashed).
    const initialNodes = page.locator(
      '.react-flow__node.react-flow__node-rect, .react-flow__node.react-flow__node-terminal',
    )
    await expect(initialNodes).toHaveCount(4)
    const initialEdges = page.locator('.react-flow__edge')
    await expect(initialEdges).toHaveCount(3)

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

    // After the cascade: 3 non-cluster nodes remain (a, c, Constraint).
    // All three edges pointed at b, so 0 edges remain.
    await expect(page.locator('.react-flow__node[data-id="b"]')).toHaveCount(0)
    await expect(
      page.locator(
        '.react-flow__node.react-flow__node-rect, .react-flow__node.react-flow__node-terminal',
      ),
    ).toHaveCount(3)
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
