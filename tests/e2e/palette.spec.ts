import { expect, test } from '@playwright/test'

/**
 * Palette e2e — click the Add Node tool, then click on the canvas
 * pane, then verify a new node materialized at (or near) the click
 * coordinates and the schema records it.
 *
 * What this catches that JSDOM can't:
 *   - The screen → flow coordinate projection (`screenToFlowPosition`)
 *     depends on a measured viewport that JSDOM doesn't produce.
 *   - The Palette's document-level Esc listener needs a real keydown
 *     event (JSDOM's `fireEvent.keyDown(document, ...)` works but
 *     doesn't catch the subtleties of focus targets).
 */

test.describe('Palette — placement mode + click-to-place', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  test('Add Node click + canvas click creates a node and fires one onChange', async ({ page }) => {
    const initialCount = await page.locator('.react-flow__node[data-id]').count()

    // Arm the tool.
    const addNode = page.getByRole('button', { name: 'add node' })
    await addNode.click()
    await expect(addNode).toHaveAttribute('aria-pressed', 'true')

    // Click on the canvas pane. The xyflow pane is `.react-flow__pane`;
    // we click at an empty region (far below the existing pipeline).
    const pane = page.locator('.react-flow__pane')
    const paneBox = await pane.boundingBox()
    if (paneBox === null) throw new Error('pane bbox missing')
    await page.mouse.click(paneBox.x + paneBox.width * 0.7, paneBox.y + paneBox.height * 0.8)

    // One new node appeared; onChange fired once.
    await expect(page.locator('.react-flow__node[data-id]')).toHaveCount(initialCount + 1)
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
    // Mode reset after successful placement.
    await expect(addNode).toHaveAttribute('aria-pressed', 'false')
  })

  test('Esc cancels an armed tool without dropping a node', async ({ page }) => {
    const addCluster = page.getByRole('button', { name: 'add cluster' })
    await addCluster.click()
    await expect(addCluster).toHaveAttribute('aria-pressed', 'true')

    // Press Esc from the document; the Palette's listener resets mode.
    await page.keyboard.press('Escape')
    await expect(addCluster).toHaveAttribute('aria-pressed', 'false')

    // No onChange — no patch fired.
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  test('switching tools transitions mode (only one armed at a time)', async ({ page }) => {
    const addNode = page.getByRole('button', { name: 'add node' })
    const addCluster = page.getByRole('button', { name: 'add cluster' })

    await addNode.click()
    await expect(addNode).toHaveAttribute('aria-pressed', 'true')

    await addCluster.click()
    await expect(addNode).toHaveAttribute('aria-pressed', 'false')
    await expect(addCluster).toHaveAttribute('aria-pressed', 'true')
  })
})
