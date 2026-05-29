import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration.
 *
 * Test layout (by directory):
 *   - tests/{schema,layout,round-trip,json-schema,renderer/translate}.test.ts
 *       Pure-Node tests. No DOM, no React. Fast (`environment: 'node'` default
 *       via the per-file directive comment in each file or via the file glob's
 *       absence from the JSDOM list below).
 *   - tests/renderer/*.test.tsx
 *       React component tests. Each tsx file declares `// @vitest-environment jsdom`
 *       at the top so it runs under JSDOM with `setup-dom.ts` polyfilling the
 *       browser globals xyflow expects (`ResizeObserver`, `DOMMatrix`).
 *
 * Coverage stays scoped to `src/**` and excludes barrel files (their lines
 * are exercised transitively but adding them inflates the coverage report
 * without informing anything).
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup-dom.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/index.{ts,tsx}', '**/*.d.ts'],
    },
    typecheck: {
      enabled: false,
    },
  },
})
