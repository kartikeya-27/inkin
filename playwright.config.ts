import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e configuration for `@inkin/core@0.3.0`.
 *
 * What this gates that JSDOM can't:
 *   - drag-no-jitter — drag a node, assert exactly one `onChange` fires
 *     and the node DOM tracks the cursor without snap-back. JSDOM has no
 *     pointer events / no real layout, so this would silently regress.
 *   - delete-cascade via real keyboard — Delete on a selected node
 *     removes the node + incident edges from the DOM.
 *   - inline-edit via real focus/blur — double-click → input → type →
 *     Enter, with all the focus shifts and pointer-capture interactions
 *     that xyflow does in the real browser.
 *
 * 0.4.x: matrix expanded to Chromium + Firefox + WebKit so pointer
 * events, drag-and-drop, animation timing, and CSS feature support
 * are gated against all three engines a real consumer might be on.
 * The 21 specs are written engine-agnostically; per-browser skips
 * (if any are ever needed) carry their own inline reason at the
 * spec site rather than being hidden in this config.
 *
 * Server boot: relies on the `examples/` Vite dev server. CI installs
 * dependencies, builds `@inkin/core`, then `pnpm test:e2e` starts via
 * the `webServer` block below. Locally, if you're already running
 * `pnpm examples` in another terminal, Playwright reuses it.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /** Each spec is independent — fully parallel is safe. */
  fullyParallel: true,
  /** Prevent `.only` from sneaking into CI runs. */
  forbidOnly: !!process.env.CI,
  /** A single retry on CI handles the rare flake; locally fail fast. */
  retries: process.env.CI ? 1 : 0,
  /** CI runs serially to keep cost predictable; local can use cores. */
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    /** Trace on first retry — cheap, invaluable when a spec flakes. */
    trace: 'on-first-retry',
    /** Disable smooth scrolling so coordinate-comparison assertions are stable. */
    actionTimeout: 10_000,
  },

  webServer: {
    command: 'pnpm --filter @inkin/examples dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
