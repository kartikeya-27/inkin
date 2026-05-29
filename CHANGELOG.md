# Changelog

All notable changes to this project will be documented in this file. Format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0 conventions: per semver pre-1.0, MINOR bumps (`0.x.0`) may include breaking
changes; PATCH bumps (`0.x.y`) are bug fixes only. Schema version is tied to package
MAJOR — a `schemaVersion: 2` will only ship with `inkin@2.0.0`.

## [Unreleased]

_Nothing yet._

## [0.2.0] — 2026-05-28

The read-only React renderer. `@inkin/core` (the bare import) now exists and
points at `<DiagramStudio>`, the drop-in React component that renders any
`Diagram` from the schema kernel with xyflow-powered pan/zoom, custom node
and edge shapes, dashed-border clusters, dark + light themes, and SVG export
via a ref handle. Editing affordances (drag, connect, inline label, inspector,
palette) stay deferred to `0.3.0` — `0.2.0` is the "Mermaid for React, with
clusters and theming" baseline. Zero breaking changes to the `0.1.0` schema
subpath; consumers' `@inkin/core/schema` imports are byte-identical.

### Added

- **`<DiagramStudio>` React component** at the bare `@inkin/core` root entry.
  Renders the diagram inside an `<InkinStoreProvider>` + xyflow's
  `<ReactFlowProvider>`, validates `value` on every reference change via
  `safeParse`, and shows an inline field-path error panel when invalid
  (DX commitment: error-on-mistake, not silent-render).
- **Props**: `value: Diagram`, `theme: 'dark' | 'light'` (default `'dark'`),
  `layout: 'auto' | 'manual'` (default `'auto'`), `minimap: boolean`
  (default `false`), `controls: boolean` (default `true`), `className?`.
- **Imperative `ref` handle**: `DiagramStudioRef.toSvg(options?)` for SVG
  export from outside the component, e.g. a consumer-owned download button.
- **Custom node shapes**: `RectNode` (rounded rect with optional monospace
  sublabel), `TerminalNode` (double-stroke for terminal states). Shared
  `BaseNode` shell owns connection handles and selection ring.
- **`LabeledEdge`**: smooth-step path, solid or dashed style, optional label
  rendered via xyflow's `<EdgeLabelRenderer>`, arrowhead marker.
- **Cluster rendering** via xyflow group nodes — dashed border, monospace
  label top-left, child nodes constrained via `extent: 'parent'`. Nested
  cluster `parent` field is accepted in the schema and rendered flat with a
  one-time console warning (nested rendering still lands in `1.2.0` with
  elkjs, per the plan).
- **Themes**: two CSS files (`themes/dark.css`, `themes/light.css`) declaring
  every `--inkin-*` token under `[data-inkin-theme="dark|light"]`. Theme
  attribute is per-`<DiagramStudio>`, so two instances can use different
  themes on the same page. All component styles consume the tokens via
  CSS Modules, so consumers can rebrand by overriding tokens in their own CSS.
- **Single CSS import**: `@inkin/core/styles.css` ships the consolidated
  stylesheet (xyflow's CSS + theme tokens + every hashed CSS Module) — one
  import covers everything the component needs.
- **Zustand store scaffolding** (`createInkinStore` factory +
  `InkinStoreProvider` + `useEditorStore` hook) using the Context-scoped
  pattern that xyflow itself uses, so each `<DiagramStudio>` instance gets
  an isolated store. Selection / interaction / edit slices are present but
  empty in `0.2.0` (filled in `0.3.0` when editing lands).
- **`translate(Diagram)`** — pure schema → xyflow `{ nodes, edges }`
  converter. Computes cluster bounding boxes, adjusts child positions from
  absolute to cluster-relative, auto-derives edge ids as `` `${from}->${to}` ``,
  attaches arrowhead markers, and warns once for unpositioned nodes under
  `layout="manual"` and once for nested clusters.
- **SVG export** via `toSvg(element, options?)` (`html-to-image` under the
  hood). Also re-exported from the root entry as `toSvg` / `ToSvgOptions`.
- **Convenience re-exports** from the root entry for the common React use
  case: `Diagram` (schema + type), `parse`, `safeParse`,
  `InkinValidationError`, `ValidationIssue`. Less-common schema exports
  (layout engine, JSON Schema, individual zod schemas) remain at the
  dedicated `@inkin/core/schema` subpath.
- **`'use client'` directive** at the top of `src/index.ts` and
  `DiagramStudio.tsx` so Next.js App Router and other RSC compilers treat
  imports as client-side. Verified preserved at the top of `dist/index.js`
  and `dist/index.cjs` by a build-time grep gate.
- **Examples app** at `examples/` — Vite + React 19 playground wired as a
  pnpm workspace. Three samples (minimal, lifecycle, architecture) switchable
  via a header dropdown, plus a dark/light theme toggle. Not published.

### Changed

- **Build pipeline**: added `@tsdown/css` plugin so Rolldown can process
  `*.module.css` imports (auto-hashed class names) and inline `@import`
  chains via Lightning CSS. The single `dist/styles.css` is emitted from
  the JS dependency graph — Rolldown 1.0 removed CSS-as-entry support, so
  the cross-package CSS imports (`@xyflow/react/dist/style.css`, theme
  files) live in `src/renderer/styles.css` and are pulled in by a
  side-effect import from `src/index.ts`.
- **`tsdown.config.ts`**: replaced the deprecated `external` field with
  `deps.neverBundle: ['react', 'react-dom']`; added `css.fileName: 'styles.css'`
  to pin the bundled CSS filename to match the exports map; added `jsx:
  "react-jsx"` to `tsconfig.json` so JSX compiles correctly for `dist`.
- **`package.json` exports map**: added the bare `.` entry (`types` /
  `import` / `require` to `dist/index.{d.ts,js,cjs}`) and the
  `./styles.css` subpath. The `./schema` entry is unchanged.
- **Bundle budgets** (`.size-limit.json`): added budgets for the React
  surface (ESM 200 kB / CJS 200 kB with all deps minified + brotli; current
  size ~125 kB / ~137 kB) and the consolidated stylesheet (30 kB; current
  ~3 kB). Existing schema budgets unchanged.
- **CI**: re-enabled `arethetypeswrong` as a CI gate now that the `.` entry
  exists (was deferred in `0.1.0` per its CHANGELOG). Added a consumer-side
  typecheck step (`pnpm --filter @inkin/examples exec tsc -b --noEmit`)
  proving the published types resolve from a third-party app.

### Verified

- Build emits `dist/styles.css` (22.45 kB raw / 3.65 kB gzip) containing
  xyflow's CSS, both theme files, and every CSS Module with hashed class
  names. Grep gate confirms no unhashed global class leaks.
- `'use client'` survives Rolldown's transform — present at line 1 of
  `dist/index.js` and `dist/index.cjs`.
- 63 vitest tests pass, including 5 new JSDOM-environment React tests
  asserting `<DiagramStudio>` mounts cleanly, honors the `theme` and
  `className` props, renders the inline error panel on invalid input, and
  supports two independent instances on the same page.
- All bundle budgets pass. `pnpm verify` (lint → typecheck → test → build →
  size) clean on a fresh checkout.

### Deferred

- **`pnpm attw` from local `pnpm verify`**: the `@arethetypeswrong/core`
  tarball extractor crashes on Windows + Node 24 due to an `fflate`
  streaming-Gunzip chunking bug (`Cannot read properties of undefined
  (reading 'filename')`) that fires on any package larger than ~64 kB,
  including the previously-published `@inkin/core@0.1.0`. Not anything
  this package does — verified by reproducing the bug end-to-end. The CI
  pipeline runs `pnpm attw` on Linux (where the bug doesn't surface), so
  the type-export gate is still enforced before publish.

[Unreleased]: https://github.com/kartikeya-27/inkin/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kartikeya-27/inkin/releases/tag/v0.2.0

## [0.1.0] — 2026-05-28

The schema kernel — framework-agnostic, AI-ready. Published as **`@inkin/core`** on npm; the project name remains **inkin**. Single package architecture: future releases grow `@inkin/core` itself rather than splitting into multiple packages — `0.2.0` adds the React `<DiagramStudio>` at the bare `@inkin/core` root entry, `0.6.0` adds the Mermaid bridge at the `@inkin/core/mermaid` subpath, etc. Consumers install `@inkin/core` once and pick which surfaces they import.

### Added

- `Diagram` zod schema (v1) covering `nodes`, `edges`, optional `clusters` and `flows`.
- `Node`, `Edge`, `Cluster`, `Flow`, `Position` zod schemas with TypeScript types inferred.
- `parse(input)` validator that returns a typed `Diagram` or throws `InkinValidationError`
  with field-path-precise issues (e.g. `diagram.nodes[3].id — Required`).
- `safeParse(input)` non-throwing variant returning a discriminated result.
- Integrity checks: unique node/edge/cluster ids, edge/cluster reference resolution,
  cluster-self-parent rejection, flow-edge resolution against both explicit ids and
  the auto-derived `${from}->${to}` form.
- `layout(diagram, engine?)` auto-positioning, defaulting to `@dagrejs/dagre` 1.x
  (the maintained dagre fork). User-supplied positions are preserved verbatim.
- `createDagreLayout(options)` factory for custom direction / spacing.
- `LayoutEngine` interface so consumers can swap in elkjs or hand-position layouts.
- `diagramJsonSchema` — JSON Schema Draft 2020-12 export via zod 4's `z.toJSONSchema()`,
  ready to drop into OpenAI / Anthropic / Gemini function-calling.
- Static `dist/schema/diagram.schema.json` file emitted at build time, exported via the
  `@inkin/core/diagram.schema.json` subpath for HTTP-fetchable / static-import consumers.
- **`@inkin/core/schema` is the only active subpath in `0.1.0`** — the bare
  `@inkin/core` root entry is intentionally absent from `package.json`'s `exports`
  map and will be added in `0.2.0` pointing at the React `<DiagramStudio>`
  component. Zero breaking changes between `0.1.0` and `0.2.0`; the schema subpath
  remains stable forever.
- **Published under the `@inkin` npm organization** as `@inkin/core`. The original
  unscoped name `inkin` was rejected by npm's anti-typosquatting check (too similar
  to existing packages `ink` and `ini`); the `@inkin` scope bypasses that check
  cleanly. Single-package architecture preserved from the original plan — future
  releases grow this package's exports map rather than spawning sibling packages.

### Verified

- Schema validation, layout determinism, JSON round-trip (parse → stringify → parse)
  via vitest. JSON Schema validity (Draft 2020-12) and runtime ↔ static parity via
  `ajv@8` with the 2020 meta-schema.

### Deferred

- **`arethetypeswrong` (attw) type-export check** is intentionally not gated in CI
  for `0.1.0`. attw requires either a `main` field or a `.` entry in `exports`;
  this release intentionally has only the `./schema` subpath (no `.`) so consumers
  can adopt without a breaking import path change at `0.2.0`. attw returns as a CI
  gate at `0.2.0` when the React surface adds the `.` entry. The `pnpm attw`
  script is still available for ad-hoc runs.

[0.1.0]: https://github.com/kartikeya-27/inkin/releases/tag/v0.1.0
[@inkin/core on npm]: https://www.npmjs.com/package/@inkin/core
