import { defineConfig } from 'tsdown'

/**
 * `@inkin/core` 0.1.0 build configuration.
 *
 * Single package containing all of inkin. Released surfaces grow over time:
 *   - 0.1.0: only the schema kernel (exposed at the `./schema` subpath)
 *   - 0.2.0: + React `<DiagramStudio>` (added at the root entry; schema subpath unchanged)
 *   - 0.6.0: + Mermaid bridge at the `./mermaid` subpath
 *   - 1.0.0: schema and root API frozen for semver guarantee
 *
 * Output structure mirrors the subpath names: `dist/schema/index.{js,cjs,d.ts,d.cts}`
 * for the `./schema` subpath, etc. `dist/schema/diagram.schema.json` is generated
 * by scripts/emit-json-schema.mjs after tsdown finishes (not produced by Rolldown).
 *
 * In 0.1.0 only the schema entry is built. Additional entries get added here as
 * each new surface ships.
 */
export default defineConfig({
  entry: {
    'schema/index': 'src/schema/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Framework-agnostic kernel: Node, Bun, Deno, edge runtimes, modern browsers
  // — never assume a single host. Enables more aggressive tree-shaking by skipping
  // Node-specific global assumptions.
  platform: 'neutral',
  // Explicit alignment with tsconfig.json `target: "ES2022"` so bundler and
  // typechecker can never disagree about which syntax/features are safe to emit.
  target: 'es2022',
})
