# inkin

Editable React diagrams from a typed schema. Published as the `@inkin/core` npm package.

> **You are here**: `@inkin/core@0.2.0` — the **read-only `<DiagramStudio>` React renderer** plus the framework-agnostic schema kernel (still at `./schema`). Editing affordances (drag, connect, inline edit, inspector, palette) land in `0.3.0`. See [the release roadmap](#release-roadmap) below.

## What this gives you (today, at 0.2.0)

- A drop-in React component, **`<DiagramStudio>`**, that renders a typed `Diagram` with xyflow-powered pan/zoom, optional minimap and controls, custom node/edge/cluster shapes, dark + light themes, and SVG export via a ref handle
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
    <div style={{ height: 600 }}>
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

That's a complete read-only diagram with pan, zoom, and viewport controls. The wrapper inherits its parent's size, so size the parent — typical use is `height: 600px` or a flex/grid child.

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `Diagram` | _required_ | The diagram to render. Validated on every reference change; failures render an inline error panel instead of a blank canvas. |
| `theme` | `'dark' \| 'light'` | `'dark'` | Reflected as `data-inkin-theme` on the wrapper; all theme tokens are scoped to that attribute. |
| `layout` | `'auto' \| 'manual'` | `'auto'` | `'auto'` runs dagre on any node without a `position`. `'manual'` trusts the diagram as-is. |
| `minimap` | `boolean` | `false` | Show xyflow's minimap overlay. |
| `controls` | `boolean` | `true` | Show xyflow's viewport controls (zoom in/out, fit-view). |
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

### Read-only today

`0.2.0` renders diagrams — it does not edit them. Pan and zoom work (xyflow defaults). Drag-to-move, drag-to-connect, inline label editing, inspector panel, and palette all land in `0.3.0` behind an `onChange` prop. The `value` prop, the component shape, and the schema stay additive across the 0.x line.

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
| `flows?` | `Flow[]` | `{ id, label?, edges, duration, delay, color? }` (rendering: `0.5.0`) |

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
| **`0.2.0`** | Read-only `<DiagramStudio>` React renderer — you are here | bare `@inkin/core` root entry (React surface), `@inkin/core/styles.css` | ✅ shipped |
| `0.3.0` | Core editing (drag, connect, delete, inline label) | `onChange` prop; root entry grows; schema subpath stable | planned |
| `0.4.0` | Editor chrome (InspectorPanel, Palette, ui primitives) | root entry grows | planned |
| `0.5.0` | Flow animation (CSS `offset-path` tokens) | root entry grows | planned |
| `0.6.0` | Mermaid bidirectional bridge | `@inkin/core/mermaid` subpath added | planned |
| `1.0.0` | Stable — schema and root API frozen, semver guarantee begins | polish only | planned |

Post-stable: undo/redo, copy/paste, PNG export, flow-editor UI, `layout="elk"`, custom node/edge type registry.

## Security

To report a security vulnerability, please use the [private vulnerability reporting feature](https://github.com/kartikeya-27/inkin/security/advisories/new) on the GitHub repository. Do **not** open a public issue for security-sensitive reports.

## License

[MIT](./LICENSE)
