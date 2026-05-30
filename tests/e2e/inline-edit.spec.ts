import { expect, test } from '@playwright/test'

/**
 * Inline-edit — double-click a label, type, commit via Enter (or blur),
 * cancel via Esc.
 *
 * The JSDOM integration tests cover the node-label path against a flat
 * `<DiagramStudio>`; this Playwright version exercises the same path
 * against a real ReactFlow viewport + xyflow's pointer-capture, plus
 * adds the edge-label flow (which JSDOM couldn't cover because xyflow's
 * `EdgeLabelRenderer` is a portal whose target needs real layout).
 */

test.describe('inline-edit — node label', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
  })

  test('double-click → type → Enter commits the new label', async ({ page }) => {
    const nodeA = page.locator('.react-flow__node[data-id="a"]')
    // The static label inside the node — `tabindex="-1"` is set by
    // EditableLabel on its resting <div>.
    const labelA = nodeA.locator('div[tabindex="-1"]').first()
    await expect(labelA).toHaveText('Idea')

    await labelA.dblclick()

    // EditableLabel swapped to <input>.
    const input = page.getByLabel('label for node a')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()

    // The current value is selected on mount — typing replaces it.
    await input.fill('Renamed via Playwright')
    await input.press('Enter')

    // Input gone, static label updated, onChange fired once.
    await expect(input).not.toBeVisible()
    await expect(labelA).toHaveText('Renamed via Playwright')
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
  })

  test('Esc cancels — no onChange, label unchanged', async ({ page }) => {
    const labelA = page.locator('.react-flow__node[data-id="a"] div[tabindex="-1"]').first()
    await expect(labelA).toHaveText('Idea')
    await labelA.dblclick()

    const input = page.getByLabel('label for node a')
    await input.fill('Discarded text')
    await input.press('Escape')

    await expect(input).not.toBeVisible()
    await expect(labelA).toHaveText('Idea')
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  test('double-click on the node body (off the label text) also opens edit', async ({ page }) => {
    // Click in the top-left padding zone of the node — clearly inside the
    // node body but outside the centered EditableLabel's hit-area. Without
    // the root-level dblclick handler this would fall through to xyflow's
    // pane and trigger zoom-on-doubleclick instead.
    const nodeA = page.locator('.react-flow__node[data-id="a"]')
    await nodeA.dblclick({ position: { x: 10, y: 8 } })

    const input = page.getByLabel('label for node a')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('Idea')
  })

  test('blur (without Enter) commits — single onChange', async ({ page }) => {
    const labelA = page.locator('.react-flow__node[data-id="a"] div[tabindex="-1"]').first()
    await labelA.dblclick()

    const input = page.getByLabel('label for node a')
    await input.fill('Blurred commit')
    // Click elsewhere to blur the input.
    await page.locator('.react-flow__pane').click({ position: { x: 30, y: 30 } })

    await expect(input).not.toBeVisible()
    await expect(labelA).toHaveText('Blurred commit')
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
  })
})

test.describe('inline-edit — edge label (Phase 10 JSDOM gap)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
  })

  test('double-click on edge label → type → Enter commits', async ({ page }) => {
    // Edge labels live in EdgeLabelRenderer portal — find by text.
    const edgeLabel = page.locator('div[tabindex="-1"]').filter({ hasText: 'refine' }).first()
    await expect(edgeLabel).toBeVisible()

    // Real mouse double-click — exercises the `pointer-events: all` fix
    // on `.label` that lets clicks reach the EditableLabel through
    // xyflow's transparent `.react-flow__edge-interaction` overlay
    // (which previously stole the click and made edge labels unrenamable
    // by a real user).
    await edgeLabel.dblclick()

    const input = page.getByLabel(/^label for edge /)
    await expect(input).toBeVisible()
    await input.fill('reshape')
    await input.press('Enter')

    await expect(input).not.toBeVisible()
    await expect(
      page.locator('div[tabindex="-1"]').filter({ hasText: 'reshape' }).first(),
    ).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
  })
})
