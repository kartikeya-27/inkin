import { expect, test } from '@playwright/test'

/**
 * Keyboard a11y — focus + ArrowRight nudges + Enter opens inline-edit.
 *
 * The keymap (`src/renderer/a11y/keymap.ts`) is mounted via `<KeymapMount>`
 * inside `<EditingProvider>` so its `useEditingActions()` resolves against
 * the actions context — without that nesting, the Enter binding silently
 * no-ops because `editing?.startEdit(...)` short-circuits on null. This
 * spec is the regression gate for that wiring.
 *
 * Why programmatic `.focus()` instead of Tab traversal: headless Chromium
 * sometimes doesn't move keyboard focus through xyflow's nodes (they're
 * focusable but rendered at `visibility: hidden` during initial measure;
 * by the time the test runs, traversal order can race). `.focus()` once
 * visibility is stable models the same end-state as a real Tab press.
 */

test.describe('keyboard a11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('editable-status')).toBeVisible()
    // xyflow renders nodes with visibility:hidden until it measures them.
    // Wait for the wrapper of node 'a' to be visible before focusing.
    await page.waitForFunction(() => {
      const n = document.querySelector('.react-flow__node[data-id="a"]') as HTMLElement | null
      return n !== null && getComputedStyle(n).visibility === 'visible'
    })
  })

  test('focus + Enter opens inline-edit input pre-seeded with current label', async ({ page }) => {
    await page.evaluate(() => {
      const n = document.querySelector('.react-flow__node[data-id="a"]') as HTMLElement | null
      n?.focus()
    })

    await page.keyboard.press('Enter')

    const input = page.getByLabel('label for node a')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('Idea')
    // Type-to-replace: text should be selected on auto-focus.
    await page.keyboard.type('Renamed')
    await page.keyboard.press('Enter')
    await expect(input).toBeHidden()
    await expect(page.locator('.react-flow__node[data-id="a"]').getByText('Renamed')).toBeVisible()
  })

  test('focus + ArrowRight nudges the node and fires onChange', async ({ page }) => {
    const startCount = Number(await page.getByTestId('onchange-count').textContent())
    const nodeLoc = page.locator('.react-flow__node[data-id="a"]')
    const start = await nodeLoc.boundingBox()
    if (start === null) throw new Error('node has no bounding box')

    await page.evaluate(() => {
      const n = document.querySelector('.react-flow__node[data-id="a"]') as HTMLElement | null
      n?.focus()
    })
    await page.keyboard.press('ArrowRight')

    await page.waitForFunction(
      (initial: number) => {
        const t = document.querySelector('[data-testid="onchange-count"]')?.textContent
        return t !== null && t !== undefined && Number(t) > initial
      },
      startCount,
      { timeout: 2000 },
    )

    const end = await nodeLoc.boundingBox()
    if (end === null) throw new Error('node disappeared after nudge')
    expect(end.x).toBeGreaterThan(start.x + 3)
  })

  test('focus + Escape clears any active selection', async ({ page }) => {
    // Click a node first so xyflow puts it in `.selected` state.
    const node = page.locator('.react-flow__node[data-id="a"]')
    await node.click()
    await expect(node).toHaveClass(/selected/)

    await page.keyboard.press('Escape')
    await expect(node).not.toHaveClass(/selected/)
  })
})
