# inkin

A framework-agnostic typed schema for editable React diagrams.

> **You are here**: `0.1.0` — schema kernel only. No React surface yet; the editable `<DiagramStudio>` component lands in `0.2.0`. See [the release roadmap](#release-roadmap) below.

## What this gives you (today, at 0.1.0)

- A **zod 4** schema for graph-shaped diagrams (nodes, edges, optional clusters and animated flows)
- A `parse()` validator with field-path-precise errors that AI agents and humans can self-correct from
- An auto-layout function powered by `@dagrejs/dagre` (the maintained dagre fork) behind a pluggable `LayoutEngine` interface
- A **JSON Schema Draft 2020-12 export** ready to drop into OpenAI / Anthropic / Gemini tool-use APIs
- Zero React, zero DOM, zero CSS — safe in Node, edge runtimes, Bun, Deno, and the browser

> **Why a typed JSON schema instead of Mermaid / PlantUML / D2 syntax?** Text-based diagram DSLs force AI agents to emit valid grammar — one misplaced bracket and the whole diagram fails silently. `inkin`'s zod-validated JSON shape returns **token-isolated field-path errors** (`diagram.nodes[3].id — Required`) that agents can self-correct in a single round, instead of regenerating from scratch. Same advantage applies to human authoring: an autocomplete IDE catches mistakes at the keystroke level, not after rendering.

## Install

```bash
pnpm add inkin
# or: npm install inkin / yarn add inkin
```

## Quick start

```ts
import { parse, layout, type Diagram } from 'inkin/schema'

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

In `0.1.0`, **`inkin/schema` is the only public entry** — the bare `import 'inkin'` form has no export yet. This is intentional: the package ships *only* the framework-agnostic kernel right now, and the subpath name reflects exactly what you're importing. From `0.2.0` onward, the bare `import 'inkin'` will be added pointing at the React `<DiagramStudio>` component; `inkin/schema` remains the framework-agnostic kernel forever. Zero breaking changes between `0.1.0` and `0.2.0`.

## AI tool-use

```ts
import { diagramJsonSchema, parse } from 'inkin/schema'

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

For tools that prefer fetching the schema as a static file rather than importing it, the same content ships as `inkin/diagram.schema.json`:

```ts
import schema from 'inkin/diagram.schema.json' with { type: 'json' }
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
import { layout, createDagreLayout, type LayoutEngine } from 'inkin/schema'

const myLayout = createDagreLayout({ direction: 'TB', nodesep: 30, ranksep: 60 })
const positioned = layout(draft, myLayout)

// or roll your own engine for elkjs, hand-positioning, etc.
const noop: LayoutEngine = { layout: (d) => d }
```

## Release roadmap

| Version | Headline | Status |
|---|---|---|
| **`0.1.0`** | Schema kernel (AI-ready) — you are here | ✅ shipped |
| `0.2.0` | Read-only `<DiagramStudio>` React renderer (nodes, edges, clusters, themes, pan/zoom, SVG export) | planned |
| `0.3.0` | Core editing (drag-to-move, connect, delete, inline label editing) | planned |
| `0.4.0` | Editor chrome (InspectorPanel, Palette, ui primitives) | planned |
| `0.5.0` | Flow animation (CSS `offset-path` token rendering) | planned |
| `0.6.0` | Mermaid bidirectional bridge (`inkin/mermaid`) | planned |
| `1.0.0` | Stable — schema freeze, semver guarantee | planned |

Post-stable: undo/redo, copy/paste, PNG export, flow-editor UI, `layout="elk"`, custom node/edge type registry.

## Security

To report a security vulnerability, please use the [private vulnerability reporting feature](https://github.com/kartikeya-27/inkin/security/advisories/new) on the GitHub repository. Do **not** open a public issue for security-sensitive reports.

## License

[MIT](./LICENSE)
