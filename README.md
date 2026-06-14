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

## License

[MIT](https://github.com/kartikeya-27/inkin/blob/main/LICENSE) © kartikeya
