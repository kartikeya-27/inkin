import { expect, test } from '@playwright/test'

/**
 * Flow animation — Phase 9 of 0.5.0. The real-browser gate the JSDOM
 * integration test cannot honestly assert.
 *
 * What JSDOM gives us (covered by `FlowLayer.integration.test.tsx`):
 *   - The `<svg>` overlay mounts.
 *   - One `<circle>` per flow with the right `data-flow-id`.
 *   - Per-flow color + duration + delay reach the inline custom
 *     properties on each circle.
 *   - The composed `path('...')` string is well-formed.
 *
 * What JSDOM CAN'T give us — what this spec gates:
 *   1. The `flowTraverse` keyframes are applied. JSDOM resolves
 *      `animation-name` to whatever the inline style says, but CSS
 *      Module class lookup, custom-property cascading, and `@keyframes`
 *      resolution don't actually happen against a real CSSOM. A real
 *      browser is the only honest test that the computed
 *      `animation-name` ends in `flowTraverse` (CSS Modules hashes the
 *      keyframes identifier — verified prefix changes per build, so the
 *      assertion is a regex suffix match, not equality).
 *   2. The animation actually RUNS — i.e., the token's rendered
 *      bounding box changes over time. `getComputedStyle(el)
 *      .offsetDistance` returns the static rule value across browsers
 *      we tested (Chromium spec compliance for animated properties is
 *      patchy here), so we sample the visual position instead. Two
 *      `boundingBox()` reads 1s apart prove the engine is actually
 *      stepping `offset-distance` through the keyframes — not just
 *      declaring the animation in the markup.
 *   3. The `prefers-reduced-motion: reduce` media query actually
 *      suppresses the animation on the engine. JSDOM's `matchMedia` is
 *      a default-stubbed shim — the Phase 5 CSS gate is invisible to
 *      vitest. Use `page.emulateMedia` directly (per-context) and
 *      assert both the rule wins (`animation-name === 'none'`) and the
 *      token doesn't move (bbox stable across 500ms).
 *
 * Engine coverage: chromium + firefox + webkit per `playwright.config.ts`.
 * CSS `offset-path: path('...')` and `r` (CSS property on SVG geometry)
 * are both supported across the three engines as of our pinned versions
 * (Chromium 86+, Firefox 72+, Safari 16+ — well within the matrix).
 *
 * Sample switch: the examples app defaults to the editable playground,
 * which has no flows. We switch to the architecture sample (which
 * defines `request` + `queue-drain`) via the header dropdown so the
 * tokens are present in the DOM. The `data-testid="inkin-flow-layer"`
 * `<svg>` mount is the readiness signal — it only appears once xyflow's
 * store has populated its nodes/edges (per `FlowLayer.tsx`'s transitional
 * guard), which is also when the composed paths resolve.
 */

// Cancel every running animation on the page after each test. The flow
// tokens animate with `iteration-count: infinite`; on Windows + Playwright
// some worker processes get held alive at shutdown because their last
// page still has a running infinite animation, which Playwright then
// force-kills after 5 minutes (returning exit code 1 even though every
// test passed). Cancelling animations on teardown lets the worker exit
// cleanly. Guarded against an already-closed page so the cleanup itself
// never throws.
const cancelAllAnimations = async (page: import('@playwright/test').Page) => {
  await page
    .evaluate(() => {
      // `document.getAnimations()` returns the live list across the page.
      for (const anim of document.getAnimations()) anim.cancel()
    })
    .catch(() => {})
}

test.describe('flows — animation runs end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Sample').selectOption('architecture')
    await expect(page.getByTestId('inkin-flow-layer')).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    await cancelAllAnimations(page)
  })

  test('each flow renders a token with the flowTraverse animation applied', async ({ page }) => {
    const requestToken = page.getByTestId('inkin-flow-token-request')
    const queueDrainToken = page.getByTestId('inkin-flow-token-queue-drain')

    await expect(requestToken).toBeVisible()
    await expect(queueDrainToken).toBeVisible()

    // CSS Modules hashes the keyframes identifier — the bundled CSS
    // emits `animation: <hash>_flowTraverse ...`, so `getComputedStyle`
    // resolves to a CSS-escaped local name (e.g.
    // `-\36 6ycG_flowTraverse`). The hash prefix varies per build; the
    // suffix is stable. Match on the suffix.
    const requestAnim = await requestToken.evaluate((el) => getComputedStyle(el).animationName)
    const queueAnim = await queueDrainToken.evaluate((el) => getComputedStyle(el).animationName)
    expect(requestAnim).toMatch(/flowTraverse$/)
    expect(queueAnim).toMatch(/flowTraverse$/)
  })

  test('per-flow duration + delay survive the wire all the way to computed style', async ({
    page,
  }) => {
    const requestToken = page.getByTestId('inkin-flow-token-request')
    const queueDrainToken = page.getByTestId('inkin-flow-token-queue-drain')

    // architecture sample: request → duration: 6500, delay: 0;
    //                       queue-drain → duration: 6500, delay: 3250.
    // These are set as inline `--inkin-flow-duration` / `--inkin-flow-delay`
    // custom properties by the React component, then read by the CSS
    // animation longhand. If either link breaks the computed values
    // revert to the rule's fallback (7s / 0s).
    const requestDur = await requestToken.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    )
    const requestDelay = await requestToken.evaluate(
      (el) => getComputedStyle(el).animationDelay,
    )
    const queueDur = await queueDrainToken.evaluate(
      (el) => getComputedStyle(el).animationDuration,
    )
    const queueDelay = await queueDrainToken.evaluate(
      (el) => getComputedStyle(el).animationDelay,
    )

    expect(requestDur).toBe('6.5s')
    expect(requestDelay).toBe('0s')
    expect(queueDur).toBe('6.5s')
    expect(queueDelay).toBe('3.25s')
  })

  test('the animation is actually playing — currentTime advances over 1s', async ({ page }) => {
    const token = page.getByTestId('inkin-flow-token-request')

    // Probe via the WebAnimations API. `Element.getAnimations()` returns
    // the live animation objects attached to the element; reading
    // `currentTime` on a `running` animation gives the engine's
    // authoritative playhead position, independent of how a particular
    // browser surfaces `getComputedStyle(el).offsetDistance` or how
    // `offset-path` positions an SVG `<circle>` in
    // `getBoundingClientRect()` (both of which we found to be unreliable
    // for this exact assertion in headless engines).
    //
    // First wait for `Animation.ready`. In headless Chromium the
    // document timeline doesn't tick until the first paint that needs
    // it — until then, `Animation.pending === true`, `startTime` is
    // null, and `currentTime` reads 0 even though playState is
    // 'running'. Awaiting `ready` synchronizes the timeline and pins
    // the animation to a concrete `startTime` so subsequent advance
    // measurements are honest.
    //
    // The architecture sample's `request` flow has a 6500ms duration
    // and 0ms delay, so 1s of clock-time should advance `currentTime`
    // by very close to 1000ms. Tolerate ±200ms for scheduler jitter /
    // GC pauses on slower CI runners.
    await token.evaluate(async (el) => {
      const anim = el.getAnimations()[0]
      if (anim === undefined) return
      await anim.ready
    })

    const readState = async () =>
      token.evaluate((el) => {
        const anim = el.getAnimations()[0]
        if (anim === undefined) return null
        const currentTime = anim.currentTime
        return {
          playState: anim.playState,
          // currentTime is `number | CSSNumericValue | null` in TS but
          // for CSSAnimations of CSS-time properties it resolves to a
          // number of ms. Coerce explicitly.
          currentTime: typeof currentTime === 'number' ? currentTime : null,
        }
      })

    const before = await readState()
    expect(before).not.toBeNull()
    if (before === null) return
    expect(before.playState).toBe('running')
    expect(before.currentTime).not.toBeNull()

    await page.waitForTimeout(1000)

    const after = await readState()
    expect(after).not.toBeNull()
    if (after === null || after.currentTime === null || before.currentTime === null) return
    expect(after.playState).toBe('running')

    const advanced = after.currentTime - before.currentTime
    expect(advanced).toBeGreaterThan(800)
    expect(advanced).toBeLessThan(1200)
  })
})

test.describe('flows — prefers-reduced-motion: reduce gate', () => {
  test.beforeEach(async ({ page }) => {
    // Emulate the OS preference per-context. `page.emulateMedia` is the
    // direct Playwright API for media-query overrides; it activates
    // before the page evaluates any CSS. The Phase 5 media-query rule
    // (`@media (prefers-reduced-motion: reduce) { .flowToken {
    // animation: none; } }`) should then win the cascade.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.getByLabel('Sample').selectOption('architecture')
    await expect(page.getByTestId('inkin-flow-layer')).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    // Defensive — animations should be suppressed under reduce-motion,
    // but the cleanup is cheap insurance against an engine that
    // started the animation before the media query took effect.
    await cancelAllAnimations(page)
  })

  test('matchMedia confirms the emulation is active', async ({ page }) => {
    // Sanity gate — if Playwright ever stops honoring `emulateMedia`,
    // the subsequent assertions get a noisy obvious failure point
    // instead of a confusing CSS cascade mystery.
    const matches = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    )
    expect(matches).toBe(true)
  })

  test('animation-name resolves to "none" — the reduce-motion rule wins the cascade', async ({
    page,
  }) => {
    const requestToken = page.getByTestId('inkin-flow-token-request')
    const queueDrainToken = page.getByTestId('inkin-flow-token-queue-drain')

    // `none` is a CSS keyword, never hashed — equality is fine here.
    const requestAnim = await requestToken.evaluate((el) => getComputedStyle(el).animationName)
    const queueAnim = await queueDrainToken.evaluate((el) => getComputedStyle(el).animationName)
    expect(requestAnim).toBe('none')
    expect(queueAnim).toBe('none')
  })

  test('the token does not move — bounding box is stable across 500ms', async ({ page }) => {
    const token = page.getByTestId('inkin-flow-token-request')

    // With `animation: none`, the token sits at `offset-distance: 0%`
    // (the resting state preserved from Phase 3). Two bbox samples
    // 500ms apart must be effectively identical — sub-pixel jitter
    // is OK, but anything more than a couple of pixels means the
    // animation is still running.
    const bbox1 = await token.boundingBox()
    expect(bbox1).not.toBeNull()
    await page.waitForTimeout(500)
    const bbox2 = await token.boundingBox()
    expect(bbox2).not.toBeNull()
    if (bbox1 === null || bbox2 === null) return

    const moved = Math.hypot(bbox2.x - bbox1.x, bbox2.y - bbox1.y)
    expect(moved).toBeLessThan(2)
  })
})
