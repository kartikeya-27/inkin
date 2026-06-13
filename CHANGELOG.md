# Changelog

All notable changes to this project will be documented in this file. Format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0 conventions: per semver pre-1.0, MINOR bumps (`0.x.0`) may include breaking
changes; PATCH bumps (`0.x.y`) are bug fixes only. Schema version is tied to package
MAJOR — a `schemaVersion: 2` will only ship with `inkin@2.0.0`.

## [Unreleased]

_Nothing yet._

## [0.6.0] — 2026-06-13

The **Mermaid bridge release**. A new framework-agnostic subpath,
`@inkin/core/mermaid`, converts between Mermaid `flowchart` / `graph` /
`stateDiagram[-v2]` source and inkin's `Diagram` in both directions —
paste existing Mermaid markdown, edit it visually with the 0.4.x editor
chrome, export it back. The bridge is two pure functions; no React /
xyflow / DOM / CSS is pulled in, and consumers who don't import it pay
zero bytes.

Nothing else changes. Schema, renderer, `<DiagramStudio>` props, flow
animation, and editor chrome are byte-for-byte 0.5.0. Adopters upgrading
from 0.5.x see no behavioral change unless they import the new subpath.

### Added

- **`@inkin/core/mermaid` subpath** with two pure functions:
  - **`fromMermaid(text): { ok: true, diagram } | { ok: false, issues }`**
    — parse Mermaid source into a validated inkin `Diagram`. Detects the
    diagram kind from the header (`flowchart` / `graph` → flowchart;
    `stateDiagram[-v2]` → state), runs a hand-rolled recursive-descent
    parser, converts the AST via the shape/edge mapping tables, and
    `safeParse`s the result (defense in depth).
  - **`toMermaid(diagram, options?): string`** — emit a `Diagram` back
    as canonical Mermaid `flowchart` text. `options.direction` (default
    `'TB'`) sets the header direction.
- **Best-effort import.** Well-formed Mermaid that uses a feature outside
  inkin's documented subset (styling, `click` / `href` interactivity,
  `classDef`, notes, exotic shapes, nested clusters) is dropped or
  degraded to the nearest inkin equivalent with one `console.warn` per
  dropped-feature kind — the import still succeeds. Only malformed input
  (missing header, unmatched bracket, stray `end`) returns
  `{ ok: false, issues }` with field-path-precise positions.
- **Supported subset** (documented in the README's "Mermaid bridge"
  section and `notes/mermaid-grammar-snapshot/`):
  - Flowchart: `flowchart` / `graph` headers, all directions; 10 node
    shapes (`rect` / `circle` / `double-circle` faithful, the rest
    degrade to `rect` / `terminal` with a warn); 4 edge styles (`solid`
    faithful, `dotted` → `dashed`, `thick` / `invisible` → `solid` +
    warn); pipe + mid-edge labels; `subgraph … end` → clusters (nested
    flattened + warn).
  - State diagram: `stateDiagram` / `stateDiagram-v2`; `[*]` → reserved
    terminal sentinel nodes (`__start__` / `__end__` by position);
    `state X` / `state "Name" as X` / `X : desc`; `A --> B : event` →
    edge labels; `state X { … }` → clusters; `<<choice>>` / `<<fork>>` /
    `<<join>>` pseudostates → `rect` + warn.
- **Examples app gains a live two-way Mermaid editor** (fifth sample):
  type / paste Mermaid → the diagram redraws (debounced); edit the
  diagram → the code box rewrites to canonical `toMermaid` output. The
  "paste Mermaid, edit visually, export back" round-trip, live.

### Changed

- **Parser issue contract** (internal to the bridge): the parsers
  distinguish `syntax` issues (malformed input → fail) from
  `unsupported` issues (out-of-subset → best-effort degrade + warn). A
  successful parse carries its `unsupported` issues as `warnings`; only
  `syntax` issues produce `{ ok: false }`. This is what makes
  best-effort import possible.
- **Build: silenced `@tsdown/css` `SOURCEMAP_BROKEN` warnings.** The
  `@tsdown/css` 0.22.2 + rolldown 1.1.0 combo emitted ~60 cosmetic
  CSS-sourcemap warnings per build; a `tsdown.config.ts` `inputOptions`
  log filter suppresses only that one code from the CSS plugins, leaving
  every other warning (and JS sourcemaps) intact. No artifact change.

### Verified

- **Round-trip** (vitest, 15 tests): every fixture in the supported-
  subset corpus (10 flowchart, 4 state, adapted from Mermaid's own
  parser fixtures with MIT attribution) satisfies
  `normalize(fromMermaid(src)) == normalize(fromMermaid(toMermaid(
  fromMermaid(src).diagram)))` — semantic equivalence (decision #7), not
  byte-identical text. Plus a fixpoint test: `toMermaid(secondParse)`
  equals `toMermaid(thirdParse)` byte-for-byte, no drift across cycles.
- **Parser + converter coverage** (vitest): tokenizer (67 tests),
  flowchart parser (54), state parser (29), `fromMermaid` converter
  (26), `toMermaid` emitter (14). Total suite 579/579 green.
- **Bundle** (`pnpm size`): the `/mermaid` subpath is 62.17 kB brotli
  full (zod-dominated) / 8.41 kB inkin-only code. The main React bundle
  is **unchanged at 13.03 kB inkin-only brotli** — the bridge adds zero
  to it. Tree-shake confirmed: `grep -c` for mermaid symbols in
  `dist/index.js` returns 0.
- **Type resolution** (`arethetypeswrong`): the `/mermaid` subpath has
  the same resolution profile as the existing `.` and `/schema` entries.
- **Zero new runtime dependencies** — the bridge imports only `safeParse`
  from the already-present schema kernel; zod was already a dependency.

### Attribution

The hand-rolled parser uses Mermaid's `flowchart` + `stateDiagram`
grammar (JISON) as its syntactic spec, and the round-trip test corpus is
adapted from Mermaid's own parser fixtures. Source: mermaid-js/mermaid
HEAD `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`, MIT-licensed (© 2015
Knut Sveidqvist and Mermaid contributors). The parser, converter, and
emitter implementations are original to inkin.

### Deferred

- **Built-in Mermaid import/export UI** on `<DiagramStudio>` (a paste
  panel / export button as a component affordance) is not in 0.6.0 — the
  bridge ships as a library API (`fromMermaid` / `toMermaid`); consumers
  wire their own UI (the examples sample is the reference). A turnkey
  affordance, and a hosted standalone playground for non-coding end
  users, are post-1.0.0 candidates.
- **Wider shape / style fidelity** (preserving Mermaid's full shape
  vocabulary) would require schema changes and is not planned for the
  0.x line.

## [0.5.0] — 2026-06-08

The **flow-animation release**. The `flows?: Flow[]` field that has been
on the `Diagram` schema since 0.1.0 now renders: one animated `<circle>`
token per flow traces its composed path through the consumer-defined
edge sequence. No animation library, no JavaScript animation loop — pure
CSS `offset-path` + `offset-distance` keyframes, honors
`prefers-reduced-motion: reduce` with a static-dot fallback.

The feature is fully data-driven — there is no new `<DiagramStudio>`
prop. Consumers populate `value.flows` and the tokens appear. 0.4.x
consumers see zero behavior change unless their diagrams already carry
a `flows` field (no existing consumer does — the field was renderer-
inert until now).

### Added

- **`<FlowLayer>` SVG overlay** mounts as the last child of `<ReactFlow>`
  inside `GraphRenderer` when `diagram.flows` is non-empty. Renders one
  animated `<circle>` per flow, positioned along the composed
  `offset-path`. Mirrors xyflow's viewport transform so pan / zoom move
  the tokens in lockstep with the underlying edges. Reads xyflow's
  already-rendered edge `d` attributes from the DOM via a
  `useLayoutEffect` — pixel-perfect alignment with the visible edges
  regardless of cluster padding, node handle offset, or measured-vs-
  rendered-dimension differences.
- **Per-flow timing** via inline CSS custom properties on each token:
  `--inkin-flow-duration` from `flow.duration` (default 7000 ms),
  `--inkin-flow-delay` from `flow.delay` (default 0 ms). Both feed the
  shared `@keyframes flowTraverse` declaration so multiple flows can
  stagger their starts and run at different speeds while sharing one
  keyframe block.
- **Per-flow color** via `flow.color` (any CSS color or `var(...)`
  expression). Falls back to `var(--inkin-accent-primary)` when unset,
  so unconfigured flows match the theme palette automatically. Color
  drives both the circle `fill` AND the drop-shadow glow via
  `currentColor` — change one, both update.
- **`--inkin-flow-token-radius` theme token** (default `6px`) wired
  through `.flowToken` via the CSS `r` property. Consumers can rebrand
  the token size via the same `:root[data-inkin-theme="dark"|"light"]`
  mechanism every other theme token uses. Added to
  `src/renderer/themes/tokens.ts` for the typed token contract.
- **`prefers-reduced-motion: reduce` gate** at
  `@media (prefers-reduced-motion: reduce) { .flowToken { animation:
  none; } }`. Tokens become static dots at the start of their composed
  path — visible, in position, but motionless. Per the master plan's
  a11y spec.
- **Architecture sample gains two flows** (`request` traversing
  `req-in → req-svc → svc-db`, `queue-drain` traversing `wkr-db` with a
  3.25 s delay) — `pnpm examples` shows the feature live in a clustered
  three-tier diagram.
- **Editable playground gains a `pipeline` flow** tracing `refine →
  release`. Delete the `release` edge to watch the 0.3.0 `pruneFlows`
  cascade strip it from the flow's edges array; delete `refine` too
  and the flow gets removed entirely. Demonstrates how flows respond
  to editing without inventing flow-editing UI.

### Changed

- **`composeFlowPath` is now a pure string-concatenation helper.**
  Originally the helper recomputed edge geometry via
  `getSmoothStepPath` from node positions. Phase 10's visual review
  surfaced 6-12 px misalignment from xyflow's internal handle-bounds
  math (handle width, cluster content padding, measured-vs-rendered-
  height differences) that the helper couldn't honestly replicate. The
  helper now takes pre-extracted edge `d` strings (the `<FlowLayer>`
  reads them from xyflow's rendered DOM) and only owns the M-stripping
  needed to make N segments trace as one continuous `offset-path`. The
  helper is no longer exposed from any public entry; the `<FlowLayer>`
  is the only caller.
- **Examples app header** bumped to "0.5.0 flow-animation release";
  sample dropdown labels updated to signpost where flows appear
  ("Architecture — clustered + animated flows", "Editable playground —
  drag, edit, delete, chrome + flow").

### Verified

- **End-to-end animation gate** (Playwright, all three engines —
  chromium, firefox, webkit): each token's computed `animation-name`
  resolves to a hashed `flowTraverse` (regex suffix match — CSS
  Modules hashes `@keyframes` identifiers); `Animation.currentTime`
  advances over a 1 s observation window within ±200 ms of clock-time
  (the WebAnimations API, awaiting `Animation.ready` first to sync the
  headless engine's document timeline); per-flow `animation-duration` /
  `animation-delay` survive intact through the inline-style → CSS
  longhand pipeline.
- **Reduced-motion gate** (Playwright, all three engines, with
  `page.emulateMedia({ reducedMotion: 'reduce' })`): `matchMedia`
  confirms emulation; `animation-name` resolves to `'none'`; the
  token's bounding box is stable across 500 ms (≤ 2 px movement). Pin
  intact.
- **Backwards compatibility** (vitest + Playwright): a diagram
  without `flows` (every existing 0.4.x sample) renders identically
  to 0.4.x. A diagram with `flows: []` (empty array) renders no
  overlay either.
- **Bundle budget** (`pnpm size`): inkin-only code 13.07 kB brotli
  against the 25 kB ceiling (was 12.06 kB at 0.4.1; +1.01 kB for
  `<FlowLayer>` + `composeFlowPath` + the `useState` / useLayoutEffect`
  machinery). Consolidated CSS 4.86 kB against the 30 kB ceiling (was
  4.71 kB at 0.4.1; +0.15 kB for the `@keyframes flowTraverse` block,
  the reduced-motion media query, and the new theme token). React
  surface ESM 133.11 kB / 200 kB ceiling. Schema surface unchanged.
- **No new runtime dependencies** (`pnpm install --frozen-lockfile`
  green). Same peer-dep contract: React `>=18`, react-dom `>=18`.
- **Vitest** — 373/373 green across 32 test files. The Phase 10
  refactor moved 24 jsdom assertions that depended on xyflow rendering
  `<path>` elements (it doesn't in jsdom — verified
  `container.querySelectorAll('path').length === 0` under
  `@testing-library/react` + `@xyflow/react`) into the Playwright
  suite, where real browser engines render them.
- **Playwright** — 81/81 specs green across chromium + firefox +
  webkit on Linux CI. Six new specs in `tests/e2e/flows.spec.ts` cover
  the animation pipeline end-to-end + the reduced-motion gate.

### Schema

- `Flow.edges`'s `superRefine` validator (shipped in 0.1.0) is the
  authoritative gate against bad references — a flow that names an
  edge id which doesn't resolve fails `parse()` with a field-path-
  precise error (`diagram.flows[0].edges[2] — references unknown edge
  id`) that AI agents can self-correct from in one round. No new
  validation rules in 0.5.0.
- `pruneFlows` / `withPrunedFlows` reducer cascade (shipped in 0.3.0)
  is the authoritative gate for editing — `DeleteEdge` / `DeleteNode`
  patches strip the deleted ids from every affected flow's `edges`
  array before `safeParse` re-validates, and a flow whose `edges`
  becomes empty is removed entirely (the schema requires
  `Flow.edges.min(1)`). 0.5.0 is the first release where consumers can
  see this happen live.

### Deferred

- **Flow editing UI** is reserved for `1.1.0` per the master plan
  (post-1.0.0 schema freeze). No Inspector field for `Flow.edges`, no
  Palette tool for "add flow", no `AddFlow` / `DeleteFlow` /
  `SetFlowEdges` patch variants. Authoring flows is declarative-only:
  mutate `value.flows` in your own state and pass it down to
  `<DiagramStudio value>`. The cascade-prune from 0.3.0 is the only
  "editable interaction" with flows that ships.
- **Per-token pause / resume control** is not on the roadmap. Reduced
  motion is the only kill switch.
- **Multiple tokens per flow** is not on the roadmap. To show
  "three packets in flight" the consumer declares three flows with
  staggered delays.

## [0.4.1] — 2026-06-02

A focused patch release that closes the last visible polish gap in
0.4.0 and brings the CI workflows in line with GitHub's Node 24
deprecation timeline. No public API changes; consumers upgrading from
0.4.0 see no behavior change beyond the chrome painting cleanly on
first load.

### Fixed

- **Chrome flicker on initial paint** (Defect #10 from the 0.4.0 plan
  v2 backlog). The Inspector + Palette enter-keyframes started at
  `opacity: 0` and faded to `1` over 180 ms, which made the chrome
  invisible during the first ~350 ms of the page load. Dropped the
  opacity portion of `@keyframes inkinInspectorEnter` /
  `inkinInspectorEnterLeft` / `inkinInspectorEnterBottom` /
  `inkinPaletteEnterLeft` / `inkinPaletteEnterTop`. The translate-X /
  translate-Y "settle from the dock edge" motion is preserved for
  the prop-toggle case (e.g., `inspector="off"` → `"right"`), just
  no fade. Reproducible on both dev and production builds before;
  fully gone on both after.

### Changed

- **CI + publish workflows** opt in to GitHub's Node 24 JS-action
  runner via the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` env var.
  Removes the deprecation warning on every run ahead of the
  2026-09-16 cutoff GitHub announced for Node 20 in v4 of
  `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`,
  `actions/cache`, and `actions/upload-artifact`. Workflow logic is
  otherwise unchanged.

### Deferred

- `tests/e2e/connect.spec.ts` (drag-to-connect through Playwright's
  mouse + dragTo) stays `test.fixme`. Re-investigated against the
  Defect #10 chrome fix — xyflow's connection state machine still
  doesn't engage from either `page.mouse.{down,move,up}` or
  `locator.dragTo()` in the 0.4.0 flex-layout. The `ConnectEdge`
  patch + dispatcher are still gated by
  `tests/renderer/editing/sync.test.tsx` via direct hook-output
  calls, so the underlying behavior remains verified. Next cleanup
  pass will drive xyflow programmatically through `useStore` rather
  than through Playwright's pointer simulation.

## [0.4.0] — 2026-06-02

The editor-chrome release. `<DiagramStudio>` in editable mode (with
`onChange` provided) now auto-mounts a contextual Inspector panel and
a creation Palette toolbar. Both can be repositioned or disabled
per-prop. Clusters are first-class — selectable, draggable, deletable,
inline-renamable. The 0.3.0 surface is preserved: a consumer who
upgrades without supplying `onChange` sees zero behavior change; a
consumer who already supplies `onChange` gets the chrome by default.

### Added

- **`<InspectorPanel>`** — selection-driven contextual editor. Routes
  by priority (nodes > edges > clusters > nothing) and renders
  fields per kind: NodeFields (label / sublabel / shape / cluster),
  EdgeFields (label / style), ClusterFields (label), EmptyState.
  Multi-select shows the shared value or a `multiple values`
  placeholder when values differ; commit applies to every selected
  entity, micro-batched into one `onChange`. The header carries a
  **"Clear"** button next to the title (renders only when something
  is selected) so the user has a deterministic way out of any
  selection state. NodeFields renders a bulk-edit banner
  ("Applies to all N selected nodes") when N > 1, matching Figma's
  multi-select inspect pattern.
- **`<Palette>`** — creation toolbar with two tool buttons (Add Node,
  Add Cluster). `aria-pressed` mirrors the active mode. Document-
  level Esc + `visibilitychange` listeners reset to `idle` defensively
  so an armed tool can't survive a tab switch or a stray click.
- **Click-to-place** — when a Palette tool is armed, clicking on the
  canvas pane projects the click via `screenToFlowPosition`, mints a
  collision-free 6-char id, dispatches the matching Add patch, and
  **auto-selects the new entity** so the Inspector opens populated
  for the immediate rename. Mode resets to `idle` after a successful
  placement. For Add Node, the dispatch also looks up any cluster
  whose bounds contain the click point and parents the new node into
  it (smallest-area wins on overlap).
- **Cluster first-class behavior** — clusters are now selectable
  via the header strip, draggable from the same header strip
  (xyflow `dragHandle: '.inkin-cluster-drag-handle'`), deletable
  via Delete key, and inline-renamable via header double-click.
  Body remains `pointer-events: none` so child nodes that visually
  sit inside the cluster keep their own click targets. Cluster
  deletion cascades via the existing `DeleteCluster` reducer arm:
  children stay in the diagram with their `cluster` field stripped,
  matching tldraw / Excalidraw frame-deletion contracts.
- **Cluster.position + Cluster.size** — clusters carry their own
  position + size in the schema (both optional). When set, they
  win over the bbox-from-children derivation. Palette-added clusters
  materialize at the click point with `EMPTY_CLUSTER_SIZE` default
  and stay there on subsequent renders. Dragging child nodes no
  longer reshapes the parent cluster's bounds. `schemaVersion`
  stays `1` — additive optional fields are non-breaking.
- **`MoveCluster` patch** — drag-end on a cluster dispatches
  `MoveCluster` (analogous to `MoveNode` for regular nodes). The
  reducer arm short-circuits no-op writes the same way `MoveNode`
  does, so a click without an actual drag doesn't fire spurious
  `onChange` calls.
- **Cross-cluster drag-and-drop** — on `onNodeDragStop`, xyflow's
  `getIntersectingNodes` runs, the smallest-area intersecting cluster
  is picked, and a `SetField{node-cluster}` patch dispatches only
  when the assignment changes. Microtask batching collapses the new
  patch with the existing `MoveNode` into one `onChange`.
- **Two new `<DiagramStudio>` props**:
  - `inspector?: 'right' | 'left' | 'off'` — defaults to `'right'`
    when `onChange` is supplied, `'off'` when read-only.
  - `palette?: 'left' | 'top' | 'off'` — defaults to `'left'` when
    `onChange` is supplied, `'off'` when read-only.
  - Explicit non-`'off'` value in read-only mode logs a one-time
    `console.warn` so the misconfiguration isn't silent.
- **Multi-select via Shift+click** — `<ReactFlow>` is mounted with
  `multiSelectionKeyCode={'Shift'}` in editable mode (xyflow's
  default was OS-specific — Control/Meta — which Shift-first users
  silently lost). Matches Figma / Sketch / tldraw / Excalidraw
  convention.
- **Four new patch variants** behind the existing pure reducer:
  - `AddNodePatch` — palette-driven node creation (id, label,
    optional position / shape / cluster).
  - `AddClusterPatch` — cluster creation (id, label, optional
    position / size).
  - `MoveClusterPatch` — cluster drag-end.
  - Extended `SetFieldTarget` — four new `kind`s: `node-shape`,
    `edge-style`, `node-cluster` (empty-string value unassigns),
    `cluster-label`. Every existing 0.3.0 `SetField` call site
    continues to work unchanged.
- **Five internal-only UI primitives** at `src/renderer/ui/` —
  `Field`, `TextInput`, `Select`, `Button`, `ErrorPanel`. NOT
  re-exported from `src/index.ts`; consumers building their own
  chrome style their own controls. `TextInput` mirrors
  `EditableLabel`'s commit-on-blur/Enter pattern so typing in an
  Inspector field never fires per-keystroke `onChange` calls.
- **Hand-rolled id factory** at `src/renderer/lib/id.ts` — 6-char
  alphanumeric IDs from a 56-char alphabet (base62 minus look-alikes:
  `0/O/o/1/l/I`). Zero new runtime deps; statistical collision-
  resistance gated by a 10,000-id test.

### Changed

- **Chrome layout** — Inspector + Palette are now **flex siblings of
  the canvas** inside the `DiagramStudio` wrapper, not absolute
  overlays. The original 0.4.0 plan called for overlay positioning
  to spare the consumer's outer layout; the cost (Ship node hidden
  behind Inspector; "refine" / "release" edge labels clipped) was
  caught during smoke and is fixed here. Consumer outer dimensions
  are still untouched — the change is internal to the wrapper's
  flex tree. Sub-480 px viewports flip to a column layout so neither
  panel eats the canvas width on mobile.
- `<EditingProvider>` now mounts a sibling `<EditorActionsContext>`
  internally exposing `dispatchSetField` / `dispatchAddNode` /
  `dispatchAddCluster` / `dispatchAssignCluster`. The existing
  `EditingContext` stays focused on the inline-label-edit state
  machine. Both contexts share one provider boundary.
- `InteractionSlice` — the deliberately-empty 0.3.0 stub is now
  filled: `mode` (idle / placing-node / placing-cluster),
  `placementOrigin`, `hoveredClusterId`, plus four explicit-verb
  actions. All setters preserve state identity on no-op writes so
  per-frame `onNodeDrag` ticks don't trigger React re-renders.
- **Editable playground sample** — redesigned. Was "main pipeline +
  two disconnected nodes inside a `notes` cluster"; the disconnected
  nodes read as a layout bug. New shape: main pipeline + one
  annotation node ("Constraint") inside a `context` cluster, linked
  back to Sketch via a dashed "note" edge so the cluster's purpose
  reads off the canvas without explanation. Schema cluster id stays
  `'notes'` for stability — only the user-visible label changed.

### Verified

- 358 vitest tests (0.3.0: 187) + 22 Playwright e2e (0.3.0: 13).
- Bundle: **inkin-only code 12.06 kB brotli** against the 25 kB
  ceiling (excludes react / xyflow / zustand / dagre / html-to-image
  / zod). CSS: 4.62 kB brotli against 30 kB. React surface (with
  all deps): 144.72 kB brotli.
- Zero new runtime dependencies vs 0.3.0.
- CSS Modules leak gate confirms no unhashed class names from
  internal modules escape into `dist/styles.css`.
- Consumer-install smoke (mirrors 0.3.0's Phase 16a): packed tarball
  installed via `npm install file:…` into a fresh Vite+React+TS app;
  every Phase 17–21 affordance exercised end-to-end.

### Deferred

- Cluster resize handles via xyflow's `<NodeResizer>` — clusters
  carry the schema-side `size` field starting in 0.4.0, but the
  direct visual-resize affordance is deferred to keep the bundle
  budget headroom. 0.5.0 territory.
- Cluster id rename + parent-cluster reassignment — ClusterFields
  ships with the `label` field only in 0.4.0; id rename + parent
  changes land in 0.5.0+ alongside the Mermaid bridge work.
- Undo / redo — Patch reducer is already structurally undo-friendly
  (every variant is invertible) but the history stack ships in
  1.1.0 as planned.
- Cross-OS multi-select (Ctrl on Win, Cmd on Mac, Shift everywhere)
  — xyflow v12's `KeyCode` type accepts only AND-combinations, not
  ORs, so we pin to `Shift` (universal design-tool convention).
  Lifting this needs either an upstream xyflow API change or a
  custom click-handler bypass; not in scope for 0.4.0.

### Internal

- New helper `pickClusterReassignment` (`src/renderer/editing/cross-cluster.ts`)
  — pure decision function exhaustively unit-tested (10 branches)
  instead of a flaky JSDOM intersection mock.
- Subtle slide-in entrance animations on Inspector + Palette
  (~180ms ease-out, dock-edge directionality, opt-out via
  `prefers-reduced-motion: reduce`).
- Styled scrollbar inside the Inspector body (thin, theme-aware).
- Cluster body uses `pointer-events: none` so child node clicks
  fall through cleanly; the 28-px header strip carries
  `pointer-events: all` and is the only drag-handle.

## [0.3.0] — 2026-05-30

The editing release. `<DiagramStudio>` accepts a new `onChange?: (next:
Diagram) => void` prop — supply it for full in-place editing (drag,
drag-to-connect, Delete-key cascade removal, inline label editing,
keyboard a11y); omit it for byte-for-byte 0.2.0 read-only behavior.
The schema, the `Diagram` type, and the `0.2.0` invocation shape stay
unchanged.

### Added

- **`<DiagramStudio onChange={…}>`** turns on editing. The callback
  receives the parsed + re-validated next `Diagram`; consumers update
  their state (and any persistence layer) inside the handler. The
  schema is the single source of truth — the editor holds no
  independent state.
- **Drag to move** — drag a node body; xyflow handles the gesture, the
  sync hook dispatches a `MoveNode` patch at drag-end, the consumer's
  `onChange` fires exactly once with the new absolute coordinates.
  Clustered children are constrained by `extent: 'parent'`; cross-
  cluster drag is deferred to 0.4.0 (Inspector / Palette territory).
- **Drag-to-connect** — drag from a node handle to another node;
  produces a `ConnectEdge` patch. The reducer auto-generates an
  explicit `${from}->${to}#N` id only when the implicit form would
  collide with an existing edge (parallel-edge case); single edges
  keep the implicit form.
- **Delete-key cascade** — Backspace or Delete on selected nodes
  cascade-removes incident edges and prunes affected flow entries
  (flows that become empty are dropped). One patch, one `onChange`,
  one dispatch — even though xyflow fires the orphan-edge events and
  the node event as separate change batches.
- **Inline label editing** — double-click on a node label, node
  sublabel, or edge label opens a width-controlled `<input>` swap-in.
  Enter or blur commits via a `SetField` patch; Esc cancels. Empty
  strings are accepted (intentional blank labels). The `nodrag` /
  `nopan` className escape hatches keep xyflow's pointer capture
  from stealing focus.
- **Keyboard a11y floor** — `nodesFocusable={true}` flips on in edit
  mode (Tab cycles node focus through xyflow). Our keymap layer adds:
    - Arrow keys nudge every selected node by 10 px (one `MoveNode`
      per selected node, microtask-batched into one `onChange`).
    - Enter on a focused node opens label editing.
    - Esc cancels the active edit if any, otherwise clears selection.
- **Selection visual feedback** — selected nodes carry an accent-
  colored 2 px box-shadow ring on top of the existing node shadow;
  selected edges thicken to 2.5 px in the accent color and the edge
  label's border switches to accent. Both surfaces honor
  `--inkin-accent-primary` so theme overrides Just Work. Smooth
  120 ms ease-out transition on selection state change.
- **Focus indicator** — `:focus-visible` outline on the xyflow node
  wrapper for keyboard navigation; sits 3 px outside the selection
  ring so the two visuals stack cleanly.
- **`DiagramInput` typed `value` prop** — `<DiagramStudio value>` now
  accepts the unparsed input shape (defaulted fields optional). The
  parsed `Diagram` is still assignable to it (output is structurally
  compatible with input in TypeScript).
- **Examples app — editable playground sample** — fourth tab in the
  examples Vite app exercises the editing flow with `useState<DiagramInput>`,
  a "Last action" line, an `onChange` counter, and a reset button. JSDoc
  shows the two-line localStorage persistence pattern. Read-only samples
  unchanged (they verify the 0.2.0 surface still works).

### Changed

- **Bundle**: React surface ESM 128.22 kB (≤ 200 kB budget — well under).
  +3 kB from 0.2.0's 125 kB, in line with the +5–9 kB plan estimate.
  Schema unchanged, styles.css 3.27 kB (≤ 30 kB).
- **`translate.ts`** no longer hardcodes `selectable / draggable /
  connectable: false` on regular (rect / terminal) nodes — those flags
  are now owned by GraphRenderer's top-level `nodesDraggable` etc.,
  which derive from `editable`. Cluster nodes keep their `false`
  overrides since they remain non-editable in 0.3.0.
- **`BaseNode` Handles**: dropped per-handle `isConnectable={false}`
  (a 0.2.0 read-only override); xyflow's `nodesConnectable` controls
  it now.
- **Editor-store slices filled in**:
    - `SelectionSlice` — `selectedNodeIds / selectedEdgeIds /
      selectedClusterIds: ReadonlySet<string>`, identity-preserving
      `setSelection({ nodes?, edges?, clusters? })` and
      `clearSelection()`. Identical input → same Set reference →
      subscribers don't re-render.
    - `EditSlice` — single-slot `editTarget` + `draftText`;
      `startEdit / updateDraft / commitEdit / cancelEdit`. Schema-
      agnostic (commitEdit returns the committed value; the sync
      layer turns it into a `SetField` patch).
    - `InteractionSlice` — still empty (lands with the Palette
      / Inspector in 0.4.0).
- **CI**: new `e2e` job runs Playwright Chromium after `verify`
  succeeds. Browser binaries cached between runs keyed on the
  `@playwright/test` version.

### Verified

- **183 vitest tests pass** — reducer + cascades + reverse translate +
  store slices + sync read & write + EditableLabel + integration
  scenarios + keymap + multi-instance isolation + selection mirroring.
- **8 Playwright e2e tests pass** — drag (no jitter, exactly one
  `onChange` per drag, multi-drag accumulation), delete with cascade
  (Delete AND Backspace), inline edit on node label (Enter / Esc /
  blur), inline edit on edge label.
- All bundle budgets pass; lint clean; typecheck clean.

### Internal — architectural notes worth surfacing

- **Microtask-batched patch dispatch** — `useFlowSync` collects every
  patch dispatched within a tick into one queue, applies them in
  order against the latest parsed snapshot, and calls `onChange`
  exactly once with the final state. Solves the "Delete fires N+1
  onChange calls" case where xyflow's orphan-edge remove events
  (`onEdgesChange`) precede the node remove (`onNodesChange`). The
  Playwright drag spec is the regression gate.
- **No-op short-circuits in the reducer** — `MoveNode` at the same
  position and `DeleteEdge` of an already-removed edge both return
  the input by reference; the dispatcher's `next === parsed` check
  then suppresses `onChange`. Together with batching, this means
  pure-cosmetic xyflow events (click-without-drag, orphan cleanup)
  produce zero consumer-visible noise.
- **EditingContext** (`editing/EditingContext.tsx`) is mounted ONLY in
  editable mode. `useEditingActions()` returns `null` in read-only
  mode, which `BaseNode` / `LabeledEdge` use to decide between a
  static `<div>` and an `<EditableLabel>`. The read-only canvas has
  zero editing affordance — no hover cursor, no double-click handler.

### Deferred

- **Inspector + Palette UI** — 0.4.0. Lets non-engineers add nodes /
  clusters, change shape / style / cluster assignment via side-panel
  fields.
- **`pnpm attw`** — still skipped (the fflate streaming-Gunzip bug in
  `@arethetypeswrong/core` that fires on tarballs over ~64 kB hasn't
  been fixed upstream). Type-export correctness gated by the consumer-
  side examples typecheck + `npm pack --dry-run`.

[0.3.0]: https://github.com/kartikeya-27/inkin/releases/tag/v0.3.0

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
  case: `Diagram` (schema + type), `DiagramInput` (the unparsed shape used by
  `<DiagramStudio value>`), `parse`, `safeParse`, `InkinValidationError`,
  `ValidationIssue`. Less-common schema exports (layout engine, JSON Schema,
  individual zod schemas) remain at the dedicated `@inkin/core/schema` subpath.
- **`DiagramInput` type** added to `@inkin/core/schema` and re-exported from
  `@inkin/core`. Mirrors zod's `z.input<typeof Diagram>` — defaulted fields
  (`Node.shape`, `Edge.style`, `Flow.duration`, `Flow.delay`) are optional,
  matching what consumers actually write in object literals. The existing
  `Diagram` type (output, all defaults filled) is unchanged for 0.1.0
  backward compatibility. `<DiagramStudio>` accepts either shape.
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
- **CI**: added a consumer-side typecheck step (`pnpm --filter @inkin/examples
  exec tsc -b --noEmit`) proving the published types resolve from a third-
  party app. (`arethetypeswrong` is still NOT a CI gate — see Deferred
  below.)

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

- **`pnpm attw` from BOTH local `pnpm verify` AND CI**: the
  `@arethetypeswrong/core` tarball extractor uses fflate's streaming Gunzip
  and keeps only the LAST chunk callback, which is empty for any tarball
  that decompresses past one chunk (~64 kB). Repro confirmed on Windows +
  Node 24 (local) and Ubuntu + Node 22/24 (CI) against both this package
  and the previously-published `@inkin/core@0.1.0`. Not platform-specific
  (an earlier suspicion that it was Windows-only proved wrong on first CI
  run). Type-export correctness is instead enforced by the consumer-side
  examples typecheck step (`pnpm --filter @inkin/examples exec tsc -b
  --noEmit`) — running a real consumer's `tsc` against the freshly-built
  types exercises the same export-map resolution paths attw would check,
  plus the `npm pack --dry-run` step validates the tarball shape. The
  `pnpm attw` script is kept available for ad-hoc local runs whenever the
  upstream fix lands.

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
