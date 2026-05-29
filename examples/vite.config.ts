import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Vite config for the `@inkin/core` examples playground.
 *
 * Why nothing fancy: this app exists to dogfood the published surface of
 * `@inkin/core` end-to-end (consumer-side install, single CSS import, default
 * exports, types resolving). Anything Vite-specific (path aliases, asset
 * pipelines, env-var indirection) would dilute that signal.
 *
 * The `@inkin/core` dep is wired via pnpm's `workspace:*` protocol, so Vite
 * resolves it from `../dist/` after a parent-level `pnpm build` runs.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
})
