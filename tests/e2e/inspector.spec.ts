import { expect, test } from '@playwright/test'

/**
 * Inspector e2e — click a node, change its shape/cluster via the
 * Inspector form, and verify the canvas re-renders and the consumer's
 * onChange counter increments.
 *
 * What this catches that JSDOM can't:
 *   - The Inspector mounts inside a real measured viewport; the
 *     selection-ring + form fields show up where you can actually see
 *     them.
 *   - Shape changes flip the rendered node class from rect → terminal
 *     against real layout (terminal nodes have a different border
 *     treatment in real CSS, not just a data attribute).
 */

test.describe('Inspector — single-node editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  test('selecting a node mounts the Inspector populated with its values', async ({ page }) => {
    await page.locator('.react-flow__node[data-id="a"]').click()
    const inspector = page.getByTestId('inkin-inspector')
    await expect(inspector).toBeVisible()
    await expect(inspector.getByText('Node')).toBeVisible()
    await expect(inspector.getByLabel('Label', { exact: true })).toHaveValue('Idea')
    await expect(inspector.getByLabel('Shape')).toHaveValue('rect')
  })

  test('changing shape to terminal updates the schema and re-renders the node', async ({
    page,
  }) => {
    await page.locator('.react-flow__node[data-id="a"]').click()
    const inspector = page.getByTestId('inkin-inspector')
    await inspector.getByLabel('Shape').selectOption('terminal')

    // Schema-side proof: onChange counter incremented exactly once.
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
    // Canvas-side proof: the xyflow node-type class flipped.
    await expect(page.locator('.react-flow__node[data-id="a"]')).toHaveClass(
      /react-flow__node-terminal/,
    )
  })

  test('changing cluster reassigns the node + onChange fires once', async ({ page }) => {
    // The editable sample has a `notes` cluster; reassign node 'a' into it.
    await page.locator('.react-flow__node[data-id="a"]').click()
    const inspector = page.getByTestId('inkin-inspector')
    await inspector.getByLabel('Cluster').selectOption('notes')

    // Schema-side proof: exactly one onChange. The cluster reassignment
    // dispatches SetField{node-cluster}; microtask flush turns that into
    // a single consumer call.
    await expect(page.getByTestId('onchange-count')).toHaveText('1')

    // After the consumer re-renders with the new value, the Inspector
    // re-reads the field — selecting node 'a' again should now show
    // cluster='notes' in the dropdown.
    await page.locator('.react-flow__node[data-id="a"]').click()
    await expect(inspector.getByLabel('Cluster')).toHaveValue('notes')
  })

  test('typing in the label field does NOT fire onChange per keystroke', async ({ page }) => {
    await page.locator('.react-flow__node[data-id="a"]').click()
    const labelInput = page.getByTestId('inkin-inspector').getByLabel('Label', { exact: true })
    await labelInput.fill('Renamed')
    // Storm guard — only Enter / blur commit.
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
    await labelInput.press('Enter')
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
  })
})
