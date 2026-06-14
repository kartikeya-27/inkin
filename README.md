<div align="center">

# inkin

**Editable React diagrams from a typed schema.**
Render a validated `Diagram`, edit it in the browser, round-trip it to Mermaid — all from one component.

[![npm version](https://img.shields.io/npm/v/@inkin/core.svg)](https://www.npmjs.com/package/@inkin/core)
[![Node versions](https://img.shields.io/node/v/@inkin/core.svg)](https://www.npmjs.com/package/@inkin/core)
[![Types](https://img.shields.io/npm/types/@inkin/core.svg)](https://www.npmjs.com/package/@inkin/core)
[![License](https://img.shields.io/npm/l/@inkin/core.svg)](https://github.com/kartikeya-27/inkin/blob/main/LICENSE)

</div>

```bash
pnpm add @inkin/core          # or: npm install @inkin/core
```

> `react` and `react-dom` (>=18) are peer dependencies. Everything else is bundled.

## Why inkin?

Text diagram languages (Mermaid, PlantUML, D2) make you emit valid grammar — one stray
bracket and the diagram fails silently. inkin's diagram is a **zod-validated JSON object**,
so it fails *loudly* with field-path-precise errors (`nodes[3].id — Required`) that a human
or an AI agent can fix in one pass. That same validated shape powers a drop-in React canvas
you can pan, edit, and export — and a framework-agnostic core that runs anywhere.

## Quickstart

**Render** — one component, one stylesheet:

```tsx
import { DiagramStudio } from '@inkin/core'
import '@inkin/core/styles.css'

<div style={{ width: '100%', height: 600 }}>
  <DiagramStudio
    value={{
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'Start' }, { id: 'b', label: 'End', shape: 'terminal' }],
      edges: [{ from: 'a', to: 'b', label: 'go' }],
    }}
  />
</div>
```

**Edit** — supply `onChange`; the same component becomes an editor (drag, connect, rename, delete):

```tsx
const [diagram, setDiagram] = useState(initial)
<DiagramStudio value={diagram} onChange={setDiagram} />
```

**Convert** — round-trip Mermaid, with zero React in the path:

```ts
import { fromMermaid, toMermaid } from '@inkin/core/mermaid'

const diagram = fromMermaid('flowchart LR\n  A[Start] --> B[End]')
const text = toMermaid(diagram)
```

## Features

| | |
|---|---|
| **Drop-in canvas** | `<DiagramStudio>` with pan/zoom, minimap, controls, dark + light themes, SVG export |
| **In-place editing** | Drag, connect, inline-rename, delete-with-cascade — enabled by passing `onChange` |
| **Editor chrome** | Contextual Inspector + Palette toolbar auto-mount in edit mode; opt out per panel |
| **Mermaid bridge** | `fromMermaid` / `toMermaid` for `flowchart`, `graph`, and `stateDiagram` |
| **Flow animation** | Tokens loop along edge paths; per-flow color/timing; respects reduced-motion |
| **Typed schema** | zod 4 model + `parse()` with field-path errors; pluggable dagre auto-layout |
| **AI-ready** | JSON Schema (Draft 2020-12) export for LLM tool-use APIs |

## Imports

Pick only what you need — the schema and Mermaid subpaths pull in **no React, DOM, or CSS**.

| Import | Provides | React? |
|---|---|---|
| `@inkin/core` | `<DiagramStudio>` — the editable canvas | Yes |
| `@inkin/core/styles.css` | Theme + editor-chrome styles | — |
| `@inkin/core/schema` | `parse()`, types, dagre layout, JSON Schema | No |
| `@inkin/core/mermaid` | `fromMermaid` / `toMermaid` | No |

## How it compares

| Feature | inkin | Mermaid | React Flow | Excalidraw | D2 |
|---|:--:|:--:|:--:|:--:|:--:|
| Typed / validated schema | ✅ | ❌ | ❌ | ❌ | ❌ |
| Drop-in React component | ✅ | ❌ | low-level | ✅ | ❌ |
| In-browser editing | ✅ | ❌ | DIY | ✅ | ❌ |
| Auto-layout | ✅ | ✅ | DIY | ❌ | ✅ |
| Mermaid import + export | ✅ | native | ❌ | ❌ | ❌ |
| Animated data-flow | ✅ | limited | DIY | ❌ | ❌ |
| AI tool-use JSON Schema | ✅ | ❌ | ❌ | ❌ | ❌ |
| Field-path error messages | ✅ | ❌ | n/a | n/a | ❌ |
| SVG export | ✅ | ✅ | DIY | ✅ | ✅ |
| Framework-agnostic core | ✅ | ✅ | ❌ | ❌ | ✅ |

---

## Contents

- [`<DiagramStudio>` props](#diagramstudio-props)
- [Editing](#editing)
- [SVG export](#svg-export)
- [Next.js App Router](#nextjs-app-router)
- [Flow animation](#flow-animation)
- [Schema API](#schema-api)
- [Mermaid bridge](#mermaid-bridge)
- [Validation errors](#validation-errors)
- [Custom layout](#custom-layout)
- [Theming](#theming)
- [AI tool-use](#ai-tool-use)
- [Security](#security)

## `<DiagramStudio>` props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `DiagramInput` | _required_ | The diagram to render — the unparsed object you'd hand to `parse()`. Defaulted fields (`Node.shape`, `Edge.style`) may be omitted. Re-validated on every reference change; failures render an inline error panel, not a blank canvas. |
| `onChange` | `(next: Diagram) => void` | — | Supply to enable editing (drag / connect / delete / inline edit). Receives the parsed-and-validated next `Diagram`. Omit for read-only. |
| `theme` | `'dark' \| 'light'` | `'dark'` | Reflected as `data-inkin-theme` on the wrapper; all tokens are scoped to it. |
| `layout` | `'auto' \| 'manual'` | `'auto'` | `'auto'` runs dagre on any node without a `position`; `'manual'` trusts the diagram as-is. |
| `minimap` | `boolean` | `false` | Show the minimap overlay. |
| `controls` | `boolean` | `true` | Show viewport controls (zoom, fit-view). |
| `inspector` | `'right' \| 'left' \| 'off'` | `'right'` (editable) | Contextual editor panel position. Fields per selection: label / sublabel / shape / cluster. |
| `palette` | `'left' \| 'top' \| 'off'` | `'left'` (editable) | Creation toolbar position. Tools: Add Node, Add Cluster. |
| `className` | `string` | — | Appended to the wrapper element. |
| `ref` | `Ref<DiagramStudioRef>` | — | Imperative handle exposing `toSvg(options?)`. |

> The wrapper needs explicit width **and** height — xyflow measures the parent on first mount.
> A `0` dimension before CSS applies logs a harmless one-shot `[React Flow] error#004`.

## Editing

Passing `onChange` turns the read-only canvas into a full editor:

```tsx
const [diagram, setDiagram] = useState<DiagramInput>(initial)
<DiagramStudio value={diagram} onChange={(next) => setDiagram(next)} />
```

- **Drag** a node to move it; children stay inside their cluster.
- **Drag from a handle** to another node to create a labeled edge (parallel edges get ids like `a->b#2`).
- **Drag a node into a cluster** to reassign it.
- **Delete / Backspace** removes a node with all incident edges (cascade) and prunes referencing flows.
- **Double-click** any label / sublabel / edge label to edit inline (Enter or blur commits, Esc cancels).
- **Tab** to focus, **arrows** to nudge 10 px, **Shift-click** to multi-select.
- **Inspector + Palette** auto-mount; opt out with `inspector="off"` / `palette="off"`.

Every edit flows through a pure schema reducer and is re-validated before `onChange` fires —
an invalid diagram can never escape the editor.

## SVG export

```tsx
import { useRef } from 'react'
import { DiagramStudio, type DiagramStudioRef } from '@inkin/core'

const ref = useRef<DiagramStudioRef>(null)
// ...
<DiagramStudio ref={ref} value={diagram} />
<button onClick={async () => { const svg = await ref.current?.toSvg() }}>Download SVG</button>
```

## Next.js App Router

`<DiagramStudio>` is client-only and ships `'use client'`, so it works in the App Router by
default. If you import it from a Server Component, dynamic-import without SSR:

```tsx
import dynamic from 'next/dynamic'
const DiagramStudio = dynamic(
  () => import('@inkin/core').then((m) => m.DiagramStudio),
  { ssr: false },
)
```

## Flow animation

Declare a `flows?: Flow[]` field and one animated token traces each flow's composed path
through the listed edges — pure CSS `offset-path`, no animation library, no new prop.

```ts
flows: [
  { id: 'request', edges: ['req-in', 'req-svc', 'svc-db'], duration: 6500 },
  { id: 'queue-drain', edges: ['wkr-db'], duration: 6500, delay: 3250 },
]
```

| `Flow` field | Type | Default | Notes |
|---|---|---|---|
| `id` | `string` | _required_ | Schema-unique identifier. |
| `edges` | `string[]` (≥1) | _required_ | Ordered edge ids. Each must resolve to an `Edge` (explicit `id` or `${from}->${to}`). Adjacent edges trace as one smooth path. |
| `duration` | `number` (ms) | `7000` | One full loop time. |
| `delay` | `number` (ms) | `0` | Offset before the first iteration — stagger parallel flows. |
| `color` | `string` | `var(--inkin-accent-primary)` | Any CSS color or `var(...)`; drives fill + glow. |
| `label` | `string` | — | Schema-only; reserved for a future flow editor. |

Respects `prefers-reduced-motion: reduce` (token shown static, in position). Token radius is
themeable via `--inkin-flow-token-radius` (default `6px`). Deleting a referenced edge prunes
it from the flow; an emptied flow is removed.

## Schema API

The framework-agnostic kernel at `@inkin/core/schema` — zero React, DOM, or CSS:

```ts
import { parse, safeParse, layout, type Diagram } from '@inkin/core/schema'

const draft = parse({
  schemaVersion: 1,
  nodes: [{ id: 'a', label: 'Pending' }, { id: 'b', label: 'Done', shape: 'terminal' }],
  edges: [{ from: 'a', to: 'b', label: 'finish' }],
})
const positioned = layout(draft)   // every node gets a dagre position
```

`@inkin/core` re-exports the essentials (`Diagram`, `parse`, `safeParse`,
`InkinValidationError`, `ValidationIssue`) for convenience. The `Diagram` shape:

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` (literal) | Tied to package MAJOR. |
| `nodes` | `Node[]` | `{ id, label, sublabel?, position?, cluster?, shape }` |
| `edges` | `Edge[]` | `{ id?, from, to, label?, style }` |
| `clusters?` | `Cluster[]` | `{ id, label, parent? }` |
| `flows?` | `Flow[]` | `{ id, label?, edges, duration, delay, color? }` |

`shape` is `'rect' | 'terminal'`; `style` is `'solid' | 'dashed'`. Both have defaults.

## Mermaid bridge

Two pure functions at `@inkin/core/mermaid` (no React / DOM; zero bytes if unimported):

```ts
import { fromMermaid, toMermaid } from '@inkin/core/mermaid'

const result = fromMermaid(`flowchart LR
  browser[Browser] --> api[API Gateway]
  api -.-> web[Web Service]
  web --> db[(Database)]`)

if (result.ok) render(result.diagram)   // validated inkin Diagram
else console.warn(result.issues)        // field-path-precise syntax errors

const text = toMermaid(diagram)                      // 'flowchart TB\n…'
const lr   = toMermaid(diagram, { direction: 'LR' }) // TB | BT | LR | RL
```

`fromMermaid` is **best-effort**: well-formed input that uses features outside inkin's subset
(styling, click handlers, notes, exotic shapes, nested clusters) degrades with a one-time
`console.warn` rather than failing — only malformed input returns `{ ok: false, issues }`.

**Supported:** `flowchart` / `graph` (all directions), `stateDiagram` / `stateDiagram-v2`,
rect (`A[..]`) and terminal (`A((..))`, `[(..)]`) nodes, solid (`-->`) and dashed (`-.->`)
edges, edge labels, and `subgraph` / compound `state` → clusters. **Not imported:** `classDef`
/ `style` / `linkStyle`, `click` / `href`, `note`, per-subgraph `direction`. Round-trip is
semantic, not byte-identical; animated `flows` have no Mermaid equivalent and drop on export.

> Uses the Mermaid grammar as its syntactic spec; round-trip fixtures adapted from Mermaid's
> own parser tests. Mermaid is MIT-licensed (© 2015 Knut Sveidqvist and contributors). The
> parser, converter, and emitter are original to inkin.

## Validation errors

`parse()` throws `InkinValidationError` with a multi-line message and a structured `issues[]`:

```
inkin: invalid Diagram
  - diagram.nodes[3].id — Required
  - diagram.edges[1].from — edge.from references unknown node id "noep"
```

Each issue has `path` and `message`. Use `safeParse()` to avoid throwing. When `<DiagramStudio>`
receives an invalid `value`, it renders these same errors inline as a `role="alert"` panel.

## Custom layout

```ts
import { layout, createDagreLayout, type LayoutEngine } from '@inkin/core/schema'

const positioned = layout(draft, createDagreLayout({ direction: 'TB', nodesep: 30, ranksep: 60 }))

const noop: LayoutEngine = { layout: (d) => d }   // or roll your own (elkjs, hand-positioning)
```

## Theming

`@inkin/core/styles.css` defines every color, border, radius, and font as a `--inkin-*` custom
property scoped to `[data-inkin-theme="dark"|"light"]`. Override to rebrand without forking:

```css
[data-inkin-theme='dark'] {
  --inkin-accent-primary: #ff00aa;
  --inkin-bg-node: #1a0d22;
}
```

The theme attribute lives on the wrapper, so two instances can use different themes side by side.

## AI tool-use

```ts
import { diagramJsonSchema, parse } from '@inkin/core/schema'

const tool = { name: 'create_diagram', input_schema: diagramJsonSchema }  // OpenAI / Anthropic / Gemini
const diagram = parse(model.output)   // throws field-path issues; agent self-corrects in one round
```

The schema also ships as a static file at `@inkin/core/diagram.schema.json` for fetch-based tools.

## Security

Report vulnerabilities via [private vulnerability reporting](https://github.com/kartikeya-27/inkin/security/advisories/new).
Please do **not** open a public issue for security-sensitive reports.

## License

[MIT](https://github.com/kartikeya-27/inkin/blob/main/LICENSE) © kartikeya
