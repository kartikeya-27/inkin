# inkin

Editable React diagrams from a typed schema. Published as the `@inkin/core` npm package.

> **You are here**: `@inkin/core@0.5.0` — the **flow-animation release**. Declare a `flows?: Flow[]` field on your `Diagram` and one animated `<circle>` per flow traverses its composed edge path via native CSS `offset-path` keyframes. No animation library. Pixel-perfect alignment with xyflow's rendered edges. Honors `prefers-reduced-motion: reduce` with a static-dot fallback. Editor chrome from 0.4.x (Inspector + Palette + cross-cluster drag) is unchanged. Schema, editing primitives, and `<DiagramStudio>` props all unchanged — purely additive overlay. See [the release roadmap](#release-roadmap) below.

## What this gives you (today, at 0.5.0)

- A drop-in React component, **`<DiagramStudio>`**, that renders a typed `Diagram` with xyflow-powered pan/zoom, optional minimap and controls, custom node/edge/cluster shapes, dark + light themes, and SVG export via a ref handle
- **In-place editing when you supply `onChange`** — drag to move, drag handles to connect, Delete or Backspace to remove with cascade, double-click any label to edit it inline. Arrow-key nudges and Esc-cancel come for free. Same component, two visible UIs.
- **Editor chrome auto-mounts in editable mode** (since 0.4.0) — a contextual **Inspector** (label / sublabel / shape / cluster) and a **Palette** toolbar (Add Node / Add Cluster). Opt out per-panel via `inspector="off"` / `palette="off"`. Drag a node into a cluster to reassign it.
- **Animated data-flow tokens** (new in 0.5.0) — populate `diagram.flows` with ordered edge ids and one `<circle>` per flow loops along the composed path. Per-flow `duration` / `delay` / `color`. No new prop on `<DiagramStudio>`. Honors `prefers-reduced-motion: reduce`. See the [Flow animation](#flow-animation) section.
- A **zod 4** schema for graph-shaped diagrams (nodes, edges, optional clusters and animated flows) — still at `@inkin/core/schema`, framework-agnostic
- A `parse()` validator with field-path-precise errors that AI agents and humans can self-correct from
- Auto-layout powered by `@dagrejs/dagre` (the maintained dagre fork) behind a pluggable `LayoutEngine` interface
- A **JSON Schema Draft 2020-12 export** ready to drop into OpenAI / Anthropic / Gemini tool-use APIs
- The schema subpath has zero React, zero DOM, zero CSS — safe in Node, edge runtimes, Bun, Deno, and the browser

> **Why a typed JSON schema instead of Mermaid / PlantUML / D2 syntax?** Text-based diagram DSLs force AI agents to emit valid grammar — one misplaced bracket and the whole diagram fails silently. `inkin`'s zod-validated JSON shape returns **token-isolated field-path errors** (`diagram.nodes[3].id — Required`) that agents can self-correct in a single round, instead of regenerating from scratch. Same advantage applies to human authoring: an autocomplete IDE catches mistakes at the keystroke level, not after rendering.

## Install

```bash
pnpm add @inkin/core
# or: npm install @inkin/core / yarn add @inkin/core
```

`react` and `react-dom` (>=18) are peer dependencies — your app already has them. Everything else (xyflow, zustand, dagre, zod, html-to-image) is pulled in transitively.

## React quickstart

Three lines of code, one CSS import, one component:

```tsx
import { DiagramStudio } from '@inkin/core'
import '@inkin/core/styles.css'

export function Demo() {
  return (
    <div style={{ width: '100%', height: 600 }}>
      <DiagramStudio
        value={{
          schemaVersion: 1,
          nodes: [
            { id: 'a', label: 'Start' },
            { id: 'b', label: 'Middle' },
            { id: 'c', label: 'End', shape: 'terminal' },
          ],
          edges: [
            { from: 'a', to: 'b', label: 'go' },
            { from: 'b', to: 'c', label: 'finish' },
          ],
        }}
      />
    </div>
  )
}
```

That's a complete read-only diagram with pan, zoom, and viewport controls. The wrapper must have explicit width *and* height — xyflow measures the parent on first mount; if either dimension reads `0` before CSS applies (common in iframes / sandboxes / flex parents without `min-width: 0`), it logs a harmless one-shot `[React Flow] error#004` warning. Setting both upfront avoids the warning. Typical sizes: `height: 600` for an embed; `width: '100vw', height: '100vh'` for a full-page canvas.

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `DiagramInput` | _required_ | The diagram to render — the unparsed object literal you'd hand to `parse()`. Defaulted fields (`Node.shape`, `Edge.style`) can be omitted. Validated on every reference change; failures render an inline error panel instead of a blank canvas. |
| `onChange` | `(next: Diagram) => void` | — | Editing toggle. Supply to enable drag / connect / delete / inline edit. Omit for the read-only experience. The callback receives the parsed-and-validated next `Diagram`; consumers update their state inside it. |
| `theme` | `'dark' \| 'light'` | `'dark'` | Reflected as `data-inkin-theme` on the wrapper; all theme tokens are scoped to that attribute. |
| `layout` | `'auto' \| 'manual'` | `'auto'` | `'auto'` runs dagre on any node without a `position`. `'manual'` trusts the diagram as-is. |
| `minimap` | `boolean` | `false` | Show xyflow's minimap overlay. |
| `controls` | `boolean` | `true` | Show xyflow's viewport controls (zoom in/out, fit-view). |
| `inspector` | `'right' \| 'left' \| 'off'` | `'right'` editable / `'off'` read-only | Contextual editor panel position. New in 0.4.0. Renders fields per selection: label / sublabel / shape / cluster (nodes), label / style (edges), label (clusters). Multi-select shows shared values or a `multiple values` placeholder. |
| `palette` | `'left' \| 'top' \| 'off'` | `'left'` editable / `'off'` read-only | Creation toolbar position. New in 0.4.0. Two tools: Add Node (click on canvas to place), Add Cluster. Esc cancels an armed tool. |
| `className` | `string` | — | Appended to the wrapper element. |
| `ref` | `Ref<DiagramStudioRef>` | — | Imperative handle exposing `toSvg(options?)`. |

### SVG export

```tsx
import { useRef } from 'react'
import { DiagramStudio, type DiagramStudioRef } from '@inkin/core'

function ExportButton() {
  const ref = useRef<DiagramStudioRef>(null)

  return (
    <>
      <DiagramStudio ref={ref} value={diagram} />
      <button onClick={async () => {
        const svg = await ref.current?.toSvg()
        // download / display / copy to clipboard
      }}>
        Download SVG
      </button>
    </>
  )
}
```

### Next.js App Router

`<DiagramStudio>` is client-only (xyflow touches `window` / `document` at import time). The component file ships `'use client'` so the App Router treats it correctly out of the box. If you import it from a Server Component anyway, dynamic-import without SSR:

```tsx
import dynamic from 'next/dynamic'

const DiagramStudio = dynamic(
  () => import('@inkin/core').then((m) => m.DiagramStudio),
  { ssr: false },
)
```

### Editable mode — supply `onChange`

```tsx
import { type Diagram, type DiagramInput, DiagramStudio } from '@inkin/core'
import '@inkin/core/styles.css'
import { useState } from 'react'

export function EditableDemo() {
  const [diagram, setDiagram] = useState<DiagramInput>({
    schemaVersion: 1,
    nodes: [
      { id: 'a', label: 'Idea',  position: { x: 0,   y: 0 } },
      { id: 'b', label: 'Ship', shape: 'terminal', position: { x: 250, y: 0 } },
    ],
    edges: [{ from: 'a', to: 'b', label: 'go' }],
  })

  return (
    <div style={{ width: '100%', height: 600 }}>
      <DiagramStudio
        value={diagram}
        onChange={(next: Diagram) => setDiagram(next)}
      />
    </div>
  )
}
```

What turns on with `onChange`:

- **Drag** a node body to move it. Children stay inside their cluster (drag-end fires one `onChange`, no jitter during the drag).
- **Drag from a node handle** to another node to create a labeled edge. Parallel edges get auto-generated explicit ids (`a->b#2`).
- **Drag a node into a cluster's bounds** to reassign it (new in 0.4.0). MoveNode + cluster reassignment microtask-batch into one `onChange`.
- **Click + Delete / Backspace** removes a node along with every incident edge (cascade) and prunes flows that reference removed edges.
- **Double-click** a label, sublabel, or edge label to edit it inline. Enter or blur commits, Esc cancels. Empty strings are valid.
- **Tab** to focus a node, **arrows** to nudge it by 10 px, **Enter** to edit its label, **Esc** to cancel-edit or clear selection.
- **Inspector + Palette auto-mount** (new in 0.4.0). The Inspector reflects the current selection — type into a TextInput and press Enter to commit a label change; pick a dropdown to change shape / style / cluster. The Palette has Add Node + Add Cluster tools — click a tool, then click the canvas to place. Newly-placed entities are auto-selected so the Inspector opens populated for the rename. Opt out per-panel:

  ```tsx
  <DiagramStudio value={diagram} onChange={setDiagram} inspector="off" />
  ```
- **Clusters are first-class** (new in 0.4.0) — click the header to select, drag the header to move (children follow), double-click to rename inline, Delete to remove (children kept, `cluster` field cleared). Add Node inside a cluster auto-parents the new node.
- **Shift-click** to multi-select. Inspector header shows the count + a Clear button; bulk edits flow through one microtask-batched `onChange`. A visible "Applies to all N selected nodes" banner appears before you type so the bulk effect is never silent.

### Editor chrome (Inspector + Palette)

When you supply `onChange`, two panels mount as flex siblings of the canvas inside the same wrapper element — they reserve their own width so no node or edge label is ever hidden behind them:

```
┌───────────────────────────────────────────────────────────────┐
│ ┌───────────┐ ┌───────────────────────────┐ ┌───────────────┐ │
│ │  + Node   │ │                           │ │ NODE   Clear  │ │
│ │  + Cluster│ │     [diagram canvas]      │ │ Label         │ │
│ └───────────┘ │                           │ │ Shape   ▼     │ │
│               │                           │ │ Cluster ▼     │ │
│               └───────────────────────────┘ └───────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

Sub-480 px viewports auto-collapse to a stacked column so neither panel eats the canvas width on mobile. Pass `inspector="left"` / `palette="top"` to flip orientation, or `"off"` to suppress per panel. Explicit non-`"off"` values in read-only mode log a one-time `console.warn`.

**Cluster affordances** (all in editable mode):
- Click the cluster's header to select it.
- Drag from the header to move the cluster — children move with it.
- Double-click the header to rename inline.
- Delete (or Backspace) removes the cluster; child nodes stay in the diagram with their `cluster` field cleared.
- Click "+ Cluster" in the Palette, then click on the canvas — the new cluster materializes at the click point.
- Click "+ Node" in the Palette, then click inside an existing cluster's bounds — the new node auto-parents into that cluster.

**Multi-select**: Shift-click extends the selection. The Inspector header shows the count and a Clear button; bulk edits commit to every selected entity via one microtask-batched `onChange`, with a visible "Applies to all N selected nodes" banner before you type.

Every editing event flows through a pure schema reducer and is re-validated before `onChange` fires — invalid diagrams can never escape from the editor. Persistence is whatever your `onChange` does: a `useState`, a `localStorage.setItem`, a `fetch` to your backend — see the [examples app](examples/src/App.tsx) for a working playground.

## Flow animation

New in 0.5.0. Declare a `flows?: Flow[]` field on your `Diagram` and one
animated `<circle>` per flow traces its composed path through the
listed edges. Pure CSS `offset-path` + `offset-distance` keyframes — no
animation library, no JavaScript animation loop. The feature is fully
data-driven; no new `<DiagramStudio>` prop.

```tsx
import { DiagramStudio } from '@inkin/core'
import '@inkin/core/styles.css'

export function ArchitectureMap() {
  return (
    <div style={{ width: '100%', height: 600 }}>
      <DiagramStudio
        value={{
          schemaVersion: 1,
          clusters: [
            { id: 'edge', label: 'edge' },
            { id: 'app', label: 'application' },
            { id: 'data', label: 'data' },
          ],
          nodes: [
            { id: 'browser', label: 'Browser', cluster: 'edge' },
            { id: 'api', label: 'API Gateway', cluster: 'app' },
            { id: 'web', label: 'Web Service', cluster: 'app' },
            { id: 'worker', label: 'Worker', cluster: 'app' },
            { id: 'db', label: 'Database', cluster: 'data', shape: 'terminal' },
          ],
          edges: [
            { id: 'req-in', from: 'browser', to: 'api', label: 'HTTPS' },
            { id: 'req-svc', from: 'api', to: 'web', style: 'dashed' },
            { id: 'svc-db', from: 'web', to: 'db' },
            { id: 'wkr-db', from: 'worker', to: 'db', label: 'consume queue' },
          ],
          flows: [
            // Sync request path: browser → API → web → db. 6.5 s loop.
            { id: 'request', edges: ['req-in', 'req-svc', 'svc-db'], duration: 6500 },
            // Async queue drain — staggered half a loop so the two
            // tokens are never visually overlaid on the same frame.
            { id: 'queue-drain', edges: ['wkr-db'], duration: 6500, delay: 3250 },
          ],
        }}
      />
    </div>
  )
}
```

Two blue tokens. The `request` token traces the three-edge sync path
continuously; the `queue-drain` token starts at the worker's right
handle for the first 3.25 seconds (its `delay`), then begins its loop
half a phase out of step with the request token.

| `Flow` field | Type | Default | Notes |
|---|---|---|---|
| `id` | `string` | _required_ | Schema-unique identifier. |
| `edges` | `string[]` (length ≥ 1) | _required_ | Ordered edge ids the token traverses. Each id must resolve to an `Edge` — either the explicit `Edge.id` field or the auto-derived `${from}->${to}` form. Adjacent edges (target of `[i]` = source of `[i+1]`) trace as one smooth continuous path; non-adjacent sequences render a straight connector segment between disjoint endpoints. |
| `duration` | `number` (ms) | `7000` | One full loop time. |
| `delay` | `number` (ms) | `0` | Offset before the first iteration begins — handy for staggering parallel flows. |
| `color` | `string` | `var(--inkin-accent-primary)` | Any CSS color (hex, `rgb()`, `hsl()`) or CSS custom property expression (`var(...)`). Drives both the token's `fill` AND its drop-shadow glow via `currentColor`. |
| `label` | `string` | — | Schema-only in 0.5.0; reserved for a future flow-editor surface that consumes it. |

**Cascade behavior** — when a user deletes an edge that one of the
flows references, the `pruneFlows` reducer cascade (shipped in 0.3.0)
strips the deleted edge id from the affected flow's `edges` array
before `onChange` fires. A flow whose `edges` array becomes empty is
removed entirely. 0.5.0 is the first release where consumers can see
this happen live: the token shortens its path, then disappears when
the last referenced edge goes away.

**Theming** — the token radius is themeable via the
`--inkin-flow-token-radius` CSS custom property (default `6px`,
declared in both `dark.css` and `light.css`). Override the same way
you'd override any other theme token:

```css
[data-inkin-theme='dark'] {
  --inkin-flow-token-radius: 9px;
}
```

The CSS `r` property is supported in Chromium 86+, Firefox 100+, and
Safari 16+ — well within the inkin browser matrix.

**Reduced motion** — `@media (prefers-reduced-motion: reduce) {
.flowToken { animation: none; } }` is baked into the consolidated CSS.
Users opting in at the OS level see each token as a static dot at the
start of its path with color and drop-shadow glow intact — visible
and in position, but motionless. No code change needed.

**What's not in 0.5.0** — there is no Inspector field for `Flow.edges`,
no Palette "add flow" tool, no patch variants for adding / editing /
removing flows. Authoring is declarative-only — mutate `value.flows`
in your own state and pass the new value down. The full flow editor
lands in `1.1.0` after the `1.0.0` schema freeze; the master plan
reserves the post-stable enhancement queue for this kind of additive
feature so the patch surface ships at most once.

## Schema-only quickstart (framework-agnostic)

The schema kernel from `0.1.0` is still available at the same subpath, unchanged:

```ts
import { parse, layout, type Diagram } from '@inkin/core/schema'

const draft: Diagram = parse({
  schemaVersion: 1,
  nodes: [
    { id: 'pending', label: 'Pending' },
    { id: 'running', label: 'Running' },
    { id: 'complete', label: 'Complete', shape: 'terminal' },
  ],
  edges: [
    { from: 'pending', to: 'running', label: 'dequeue' },
    { from: 'running', to: 'complete', label: 'success' },
  ],
})

const positioned = layout(draft)
// → every node now has a `position: { x, y }` from dagre
```

`@inkin/core` (the React surface) also re-exports the common schema essentials (`Diagram`, `parse`, `safeParse`, `InkinValidationError`, `ValidationIssue`) for convenience — you only need the subpath when you want the layout engine, JSON Schema, or individual zod schemas.

## AI tool-use

```ts
import { diagramJsonSchema, parse } from '@inkin/core/schema'

// OpenAI / Anthropic / Gemini function-calling — drop in directly
const tool = {
  name: 'create_diagram',
  description: 'Produce an inkin Diagram object.',
  input_schema: diagramJsonSchema,
}

// after the model responds, validate before doing anything else
const diagram = parse(model.output)
// → throws InkinValidationError with field-path issues; agent can self-correct in one round
```

For tools that prefer fetching the schema as a static file rather than importing it, the same content ships as `@inkin/core/diagram.schema.json`:

```ts
import schema from '@inkin/core/diagram.schema.json' with { type: 'json' }
// or fetch it from your CDN of choice: unpkg, jsdelivr, etc.
```

## Validation errors

`parse()` throws `InkinValidationError` with a multi-line message and a structured `issues[]` array:

```
inkin: invalid Diagram
  - diagram.nodes[3].id — Required
  - diagram.edges[1].from — edge.from references unknown node id "noep"
```

The `issues[]` array is the agent-friendly version: each entry has `path` (e.g. `"diagram.nodes[3].id"`) and `message`. Use `safeParse()` if you'd rather not throw.

When `<DiagramStudio>` receives an invalid `value`, it renders the same field-path errors inline (as a `role="alert"` panel) instead of a blank canvas — DX commitment from the plan: "Error-on-mistake, not silent-render."

## Schema shape

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` (literal) | tied to package MAJOR; `2` would ship with `inkin@2.0.0` |
| `nodes` | `Node[]` | `{ id, label, sublabel?, position?, cluster?, shape }` |
| `edges` | `Edge[]` | `{ id?, from, to, label?, style }` |
| `clusters?` | `Cluster[]` | `{ id, label, parent? }` (nested rendering: `1.2.0`) |
| `flows?` | `Flow[]` | `{ id, label?, edges, duration, delay, color? }` — animated tokens since `0.5.0`; see [Flow animation](#flow-animation) |

`shape` is `'rect' \| 'terminal'`; `style` is `'solid' \| 'dashed'`. Both have sensible defaults.

## Custom layout

```ts
import { layout, createDagreLayout, type LayoutEngine } from '@inkin/core/schema'

const myLayout = createDagreLayout({ direction: 'TB', nodesep: 30, ranksep: 60 })
const positioned = layout(draft, myLayout)

// or roll your own engine for elkjs, hand-positioning, etc.
const noop: LayoutEngine = { layout: (d) => d }
```

## Theming

`@inkin/core/styles.css` defines every visible color, border, radius, and font as a `--inkin-*` CSS custom property scoped to `[data-inkin-theme="dark"|"light"]`. Override any of them in your own CSS to rebrand without forking:

```css
[data-inkin-theme='dark'] {
  --inkin-accent-primary: #ff00aa;
  --inkin-bg-node: #1a0d22;
}
```

The theme attribute lives on the `<DiagramStudio>` wrapper, so two instances on the same page can use different themes side by side.

## Release roadmap

| Version | Headline | What gets added to `@inkin/core` | Status |
|---|---|---|---|
| `0.1.0` | Schema kernel (AI-ready) | `@inkin/core/schema` subpath | ✅ shipped |
| `0.2.0` | Read-only `<DiagramStudio>` React renderer | bare `@inkin/core` root entry (React surface), `@inkin/core/styles.css` | ✅ shipped |
| `0.3.0` | Core editing (drag, connect, delete, inline label) | `onChange` prop; `DiagramInput` type; editing layer | ✅ shipped |
| `0.4.0` | Editor chrome (InspectorPanel, Palette, ui primitives) | root entry grows | ✅ shipped |
| **`0.5.0`** | Flow animation (CSS `offset-path` tokens) — you are here | `<FlowLayer>` overlay, `--inkin-flow-token-radius` theme token | ✅ shipped |
| `0.6.0` | Mermaid bidirectional bridge | `@inkin/core/mermaid` subpath added | planned |
| `1.0.0` | Stable — schema and root API frozen, semver guarantee begins | polish only | planned |

Post-stable: undo/redo, copy/paste, PNG export, **flow-editor UI** (Inspector / Palette surface for adding, editing, and removing flows), `layout="elk"`, custom node/edge type registry.

## Security

To report a security vulnerability, please use the [private vulnerability reporting feature](https://github.com/kartikeya-27/inkin/security/advisories/new) on the GitHub repository. Do **not** open a public issue for security-sensitive reports.

## License

[MIT](./LICENSE)
