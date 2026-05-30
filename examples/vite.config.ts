import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite config for the `@inkin/core` examples playground.
 *
 * The `@inkin/core` dep is wired via pnpm's `workspace:*` protocol, so Vite
 * resolves it from `../dist/` after a parent-level `pnpm build`.
 *
 * `optimizeDeps.exclude` keeps Vite from pre-bundling the workspace dep
 * into `node_modules/.vite/deps/`. Without this, an edit-rebuild-refresh
 * cycle would still serve the stale pre-bundle until the cache key
 * invalidated — which is the same bug consumers don't have (they never
 * change `@inkin/core`'s code), but which made dogfooding here painful.
 * With it excluded, every request re-reads `../dist/index.js` directly, so
 * `pnpm build && hard refresh` is enough — no cache flush required.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  optimizeDeps: {
    exclude: ['@inkin/core'],
  },
})
