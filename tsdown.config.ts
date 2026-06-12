import { defineConfig } from 'tsdown'

/**
 * `@inkin/core` 0.2.0 build configuration.
 *
 * Builds two JS entries plus one auto-emitted CSS asset:
 *   - `index`           → `dist/index.{js,cjs,d.ts,d.cts}` — the React surface
 *                         (`DiagramStudio` + convenience re-exports from
 *                         schema). Starts with `'use client'` so Next.js App
 *                         Router consumers don't crash on SSR.
 *   - `schema/index`    → `dist/schema/index.{js,cjs,d.ts,d.cts}` — the
 *                         framework-agnostic schema kernel. Unchanged from
 *                         0.1.0; consumers' `'@inkin/core/schema'` imports
 *                         remain stable forever.
 *   - `dist/styles.css` → emitted automatically by Rolldown (via
 *                         `@tsdown/css`) from the side-effect CSS imports at
 *                         the top of `src/index.ts` (xyflow's stylesheet +
 *                         the two inkin theme files) plus every
 *                         `*.module.css` pulled in through the JS dep graph.
 *                         The `outputOptions.assetFileNames` pattern below
 *                         pins the filename so `package.json` exports map
 *                         (`./styles.css → ./dist/styles.css`) stays valid.
 *
 * Rolldown 1.0 removed CSS-as-entry support (rolldown#4271), so the previous
 * `styles: 'src/styles.css'` entry was dropped. All CSS now flows through the
 * JS import graph — the only path that still yields one consolidated bundle.
 *
 * `dist/schema/diagram.schema.json` is still generated separately by
 * `scripts/emit-json-schema.mjs` after tsdown finishes (not produced by
 * Rolldown itself — it imports the freshly-built schema JS to call
 * `z.toJSONSchema()` once and write the result as a static file).
 *
 * `'use client'` survival: Rolldown preserves directive prologues
 * (`'use client'`, `'use server'`) verbatim from the entry file. The
 * Phase 14 verification grep-checks that `dist/index.js` starts with
 * the directive — if a future tsdown/Rolldown release ever changes this,
 * the gate fails and we catch it before publish.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'schema/index': 'src/schema/index.ts',
    'mermaid/index': 'src/mermaid/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Framework-agnostic for the schema entry; React-aware for index.ts via JSX
  // transform (configured in tsconfig.json's `jsx: "react-jsx"`).
  platform: 'neutral',
  target: 'es2022',
  // React/react-dom are peer deps — consumers bring their own. xyflow,
  // zustand, dagre, zod, html-to-image are runtime deps but still external
  // (tsdown auto-externalizes everything in `dependencies` by default).
  deps: {
    neverBundle: ['react', 'react-dom'],
  },
  // Pin the bundled CSS filename to `styles.css` so the package.json exports
  // map (`./styles.css` → `./dist/styles.css`) resolves correctly. `@tsdown/css`
  // defaults to `style.css` (singular); we want the plural to match the
  // documented import path.
  css: {
    fileName: 'styles.css',
  },
  // Suppress the cosmetic `SOURCEMAP_BROKEN` warnings emitted by the
  // `@tsdown/css` / `@tsdown/css:collect` plugins. As of `@tsdown/css`
  // 0.22.2 + rolldown 1.1.0, the CSS plugins transform stylesheets
  // without handing rolldown a sourcemap for the transformation, and
  // rolldown now warns once per transformed CSS module (~60 lines on a
  // full build). The warnings are harmless: the build exits 0, the
  // published `dist/styles.css` is correct, no `styles.css.map` ships,
  // and the JS sourcemaps (the ones consumers use for stack traces) are
  // emitted normally. `@tsdown/css` exposes no option to disable its
  // CSS sourcemap behavior, so we filter the single noisy log code at
  // the rolldown level — wrapping (not replacing) tsdown's own `onLog`
  // so every OTHER warning, including any future JS `SOURCEMAP_BROKEN`,
  // still surfaces. Remove this once @tsdown/css emits CSS sourcemaps.
  inputOptions(options) {
    const previous = options.onLog
    options.onLog = (level, log, defaultHandler) => {
      const fromCssPlugin = typeof log.plugin === 'string' && log.plugin.includes('@tsdown/css')
      if (log.code === 'SOURCEMAP_BROKEN' && fromCssPlugin) return
      if (previous) {
        previous(level, log, defaultHandler)
      } else {
        defaultHandler(level, log)
      }
    }
    return options
  },
})
