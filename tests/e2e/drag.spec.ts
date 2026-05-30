import { expect, test } from '@playwright/test'

/**
 * Drag-no-jitter — the make-or-break Phase 6 gate the JSDOM suite cannot
 * honestly assert.
 *
 * What "no jitter" means concretely:
 *   1. xyflow's transient drag-during events stay LOCAL — they don't
 *      escape via `onChange`. The status bar's counter increments by
 *      exactly 1 for one drag, no matter how many mid-drag move events
 *      Chromium synthesises.
 *   2. The node's DOM position smoothly tracks the cursor and lands
 *      where the cursor was released — no snap-back to the original
 *      position, no half-step landing midway.
 *
 * Test strategy:
 *   - Pick a node from the editable playground and read its initial
 *     bounding box.
 *   - Drag it ~150px right + ~80px down in 12 intermediate steps so
 *     Playwright fires a stream of move events through the hold.
 *   - Assert the final box is approximately at the new position (within
 *     a small tolerance — xyflow rounds, transforms snap to integers).
 *   - Assert `data-onchange-count` advanced by exactly 1.
 */

test.describe('drag-no-jitter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Make sure the editable playground is mounted.
    await expect(page.getByTestId('editable-status')).toBeVisible()
    await expect(page.getByTestId('onchange-count')).toHaveText('0')
  })

  test('dragging a node fires onChange exactly once with the final position', async ({ page }) => {
    // xyflow tags node DOM elements with `data-id` matching the schema node id.
    const node = page.locator('.react-flow__node[data-id="a"]')
    await expect(node).toBeVisible()

    const start = await node.boundingBox()
    expect(start).not.toBeNull()
    if (start === null) return

    const fromX = start.x + start.width / 2
    const fromY = start.y + start.height / 2
    const dx = 150
    const dy = 80

    // Streamed drag: mouse.down → many move steps → mouse.up. Playwright's
    // built-in steps option emits a fan of move events along the path so
    // any "fires onChange on every move" regression would multiply the
    // counter above the expected 1.
    await page.mouse.move(fromX, fromY)
    await page.mouse.down()
    await page.mouse.move(fromX + dx, fromY + dy, { steps: 12 })
    await page.mouse.up()

    // Final position: generous tolerance — the test cares that the node
    // landed in the neighborhood, NOT that browser-side coordinates round-
    // trip pixel-perfectly through the xyflow transform stack.
    const end = await node.boundingBox()
    expect(end).not.toBeNull()
    if (end === null) return
    expect(Math.abs(end.x - (start.x + dx))).toBeLessThan(25)
    expect(Math.abs(end.y - (start.y + dy))).toBeLessThan(25)
    // Stronger: confirm the node MOVED (vs snap-back which would leave it
    // approximately where it started).
    expect(Math.abs(end.x - start.x)).toBeGreaterThan(dx / 2)
    expect(Math.abs(end.y - start.y)).toBeGreaterThan(dy / 2)

    // The make-or-break assertion — exactly one onChange for one drag.
    await expect(page.getByTestId('onchange-count')).toHaveText('1')
  })

  test('multiple drags accumulate one onChange per drag', async ({ page }) => {
    const node = page.locator('.react-flow__node[data-id="a"]')
    await expect(node).toBeVisible()
    const start = await node.boundingBox()
    if (start === null) return
    const cx = start.x + start.width / 2
    const cy = start.y + start.height / 2

    // First drag: +60, 0
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 60, cy, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId('onchange-count')).toHaveText('1')

    // Second drag from new position: +0, +60
    const mid = await node.boundingBox()
    if (mid === null) return
    const mx = mid.x + mid.width / 2
    const my = mid.y + mid.height / 2
    await page.mouse.move(mx, my)
    await page.mouse.down()
    await page.mouse.move(mx, my + 60, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId('onchange-count')).toHaveText('2')
  })
})
