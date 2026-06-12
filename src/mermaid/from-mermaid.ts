/**
 * `fromMermaid` — convert Mermaid source text into an inkin `Diagram`.
 * Phase 6 of the 0.6.0 plan.
 *
 * Pipeline:
 *   1. Detect the diagram kind from the header keyword
 *      (`flowchart` / `graph` → flowchart; `stateDiagram[-v2]` → state).
 *   2. Run the matching parser (Phases 3-5).
 *   3. Convert the AST into a `DiagramInput` via the mapping tables
 *      (`mapping.ts`), collecting one warning message per lossy /
 *      dropped feature kind.
 *   4. `safeParse` the result (defense-in-depth — a converter bug can
 *      never emit an invalid Diagram to the caller).
 *   5. Emit every collected warning via `console.warn`, deduped so a
 *      diagram with 30 diamonds warns once, not 30 times.
 *
 * Contract (locked decision): out-of-scope-but-well-formed Mermaid is a
 * BEST-EFFORT import — dropped / degraded with a `console.warn`, the
 * parse still succeeds. Only malformed input (`syntax` issues) fails
 * with `{ ok: false, issues }`.
 *
 * Attribution: the Mermaid grammar is the syntactic spec
 * (mermaid-js/mermaid HEAD `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`,
 * MIT). Converter + mapping decisions are inkin's own.
 */

import type { Diagram as DiagramType } from '../schema/types'
import { safeParse } from '../schema/validate'
import { EDGE_STYLE_MAP, SHAPE_MAP, STATE_TYPE_MAP } from './mapping'
import type {
  EdgeStatement,
  FlowchartAst,
  FlowchartStatement,
  ParseIssue,
  StateDiagramAst,
  StateStatement,
  SubgraphStatement,
} from './parser/ast'
import { parseFlowchart } from './parser/flowchart'
import { parseStateDiagram } from './parser/state'
import { Tokenizer } from './parser/tokenizer'

/** Reserved sentinel ids for state-diagram `[*]` markers (kept in sync
 * with `state.ts`). */
const START_SENTINEL = '__start__'
const END_SENTINEL = '__end__'

export type FromMermaidResult =
  | { readonly ok: true; readonly diagram: DiagramType }
  | { readonly ok: false; readonly issues: readonly ParseIssue[] }

/** Mutable node accumulator before it becomes a schema `Node`. */
interface NodeAcc {
  id: string
  label: string
  shape: 'rect' | 'terminal'
  cluster?: string
  /** Whether the label/shape came from an explicit declaration (vs a
   * bare reference). Explicit declarations win on merge. */
  explicit: boolean
}

interface EdgeAcc {
  from: string
  to: string
  style: 'solid' | 'dashed'
  label?: string
}

interface ClusterAcc {
  id: string
  label: string
}

/**
 * Convert Mermaid source text into an inkin `Diagram`.
 *
 * @param text Mermaid `flowchart` / `graph` or `stateDiagram[-v2]`
 *   source.
 * @returns `{ ok: true, diagram }` on success (possibly after a
 *   best-effort degrade with `console.warn`s), or `{ ok: false, issues }`
 *   when the input is malformed.
 */
export function fromMermaid(text: string): FromMermaidResult {
  const kind = detectKind(text)
  if (kind === null) {
    return {
      ok: false,
      issues: [
        {
          kind: 'syntax',
          message:
            'Unrecognized diagram header. The inkin Mermaid bridge supports `flowchart` / `graph` and `stateDiagram` / `stateDiagram-v2`.',
          position: { line: 1, column: 1 },
        },
      ],
    }
  }

  const warnings: string[] = []

  if (kind === 'flowchart') {
    const parsed = parseFlowchart(new Tokenizer(text))
    if (!parsed.ok) return { ok: false, issues: parsed.issues }
    for (const w of parsed.warnings) warnings.push(w.message)
    const diagramInput = convertFlowchart(parsed.value, warnings)
    return finalize(diagramInput, warnings)
  }

  const parsed = parseStateDiagram(new Tokenizer(text))
  if (!parsed.ok) return { ok: false, issues: parsed.issues }
  for (const w of parsed.warnings) warnings.push(w.message)
  const diagramInput = convertState(parsed.value, warnings)
  return finalize(diagramInput, warnings)
}

/** Detect the diagram kind from the first meaningful token. Returns
 * `null` for an unrecognized header. */
function detectKind(text: string): 'flowchart' | 'stateDiagram' | null {
  const t = new Tokenizer(text)
  // Skip leading blanks / comments.
  while (true) {
    const peek = t.peek()
    if (peek.kind === 'NEWLINE' || peek.kind === 'SEMI' || peek.kind === 'COMMENT') {
      t.next()
      continue
    }
    break
  }
  const head = t.peek()
  if (head.kind === 'KW_FLOWCHART') return 'flowchart'
  if (head.kind === 'KW_STATEDIAGRAM') return 'stateDiagram'
  return null
}

/** Run safeParse and emit collected warnings (deduped). */
function finalize(diagramInput: unknown, warnings: string[]): FromMermaidResult {
  const result = safeParse(diagramInput)
  if (!result.success) {
    // A converter bug produced an invalid Diagram — surface the
    // validation issues as syntax issues so the caller sees them.
    return {
      ok: false,
      issues: result.error.issues.map((iss) => ({
        kind: 'syntax' as const,
        message: `internal: converted diagram failed validation — ${iss.path}: ${iss.message}`,
        position: { line: 1, column: 1 },
      })),
    }
  }
  emitWarnings(warnings)
  return { ok: true, diagram: result.data }
}

/** Emit each distinct warning message once via `console.warn`. */
function emitWarnings(warnings: readonly string[]): void {
  const seen = new Set<string>()
  for (const w of warnings) {
    if (seen.has(w)) continue
    seen.add(w)
    console.warn(`[inkin] fromMermaid: ${w}`)
  }
}

// ============================================================================
// Flowchart → Diagram
// ============================================================================

function convertFlowchart(ast: FlowchartAst, warnings: string[]): unknown {
  const nodes = new Map<string, NodeAcc>()
  const edges: EdgeAcc[] = []
  const clusters: ClusterAcc[] = []

  if (ast.direction !== 'TB') {
    warnings.push(
      `Diagram direction \`${ast.direction}\` isn't stored on the inkin Diagram — set layout direction at render time via \`createDagreLayout({ direction })\`.`,
    )
  }

  walkFlowchartStatements(ast.statements, undefined, nodes, edges, clusters, warnings)

  return assembleDiagram(nodes, edges, clusters)
}

function walkFlowchartStatements(
  statements: readonly FlowchartStatement[],
  cluster: string | undefined,
  nodes: Map<string, NodeAcc>,
  edges: EdgeAcc[],
  clusters: ClusterAcc[],
  warnings: string[],
): void {
  for (const stmt of statements) {
    if (stmt.kind === 'vertex') {
      const mapping = SHAPE_MAP[stmt.shape]
      if (mapping.lossy) {
        warnings.push(
          `Mermaid ${mapping.mermaidName} shape isn't representable in inkin; mapped to \`${mapping.shape}\`.`,
        )
      }
      upsertNode(nodes, {
        id: stmt.id,
        label: stmt.label ?? stmt.id,
        shape: mapping.shape,
        explicit: stmt.label !== undefined || stmt.shape !== 'rect',
        ...(cluster !== undefined && { cluster }),
      })
    } else if (stmt.kind === 'edge') {
      edges.push(convertEdge(stmt, warnings))
    } else if (stmt.kind === 'subgraph') {
      convertSubgraph(stmt, nodes, edges, clusters, warnings)
    }
  }
}

function convertSubgraph(
  sg: SubgraphStatement,
  nodes: Map<string, NodeAcc>,
  edges: EdgeAcc[],
  clusters: ClusterAcc[],
  warnings: string[],
): void {
  clusters.push({ id: sg.id, label: sg.label ?? sg.id })
  // Children of the subgraph get `cluster: sg.id`. Edges inside the
  // subgraph are plain edges (inkin edges don't carry a cluster).
  walkFlowchartStatements(sg.statements, sg.id, nodes, edges, clusters, warnings)
}

function convertEdge(stmt: EdgeStatement, warnings: string[]): EdgeAcc {
  const mapping = EDGE_STYLE_MAP[stmt.style]
  if (mapping.lossy) {
    warnings.push(
      `Mermaid ${mapping.mermaidName} edge style isn't representable in inkin; mapped to \`${mapping.style}\`.`,
    )
  }
  if (!stmt.hasArrow) {
    warnings.push(
      'Mermaid no-arrow edges (`---`, `-.-`, `===`) lose their no-arrowhead semantic — inkin always renders a target arrowhead.',
    )
  }
  return {
    from: stmt.from,
    to: stmt.to,
    style: mapping.style,
    ...(stmt.label !== undefined && { label: stmt.label }),
  }
}

// ============================================================================
// State diagram → Diagram
// ============================================================================

function convertState(ast: StateDiagramAst, warnings: string[]): unknown {
  const nodes = new Map<string, NodeAcc>()
  const edges: EdgeAcc[] = []
  const clusters: ClusterAcc[] = []

  if (ast.direction !== 'TB') {
    warnings.push(
      `Diagram direction \`${ast.direction}\` isn't stored on the inkin Diagram — set layout direction at render time via \`createDagreLayout({ direction })\`.`,
    )
  }

  walkStateStatements(ast.statements, undefined, nodes, edges, clusters, warnings)

  // Materialize the start/end sentinels referenced by any transition
  // (they don't appear as state declarations).
  ensureSentinels(nodes, edges)

  return assembleDiagram(nodes, edges, clusters)
}

function walkStateStatements(
  statements: readonly StateStatement[],
  cluster: string | undefined,
  nodes: Map<string, NodeAcc>,
  edges: EdgeAcc[],
  clusters: ClusterAcc[],
  warnings: string[],
): void {
  for (const stmt of statements) {
    if (stmt.kind === 'state') {
      const mapping = STATE_TYPE_MAP[stmt.type]
      if (mapping.lossy) {
        warnings.push(
          `Mermaid ${mapping.mermaidName} isn't representable in inkin; mapped to \`${mapping.shape}\`.`,
        )
      }
      upsertNode(nodes, {
        id: stmt.id,
        label: stmt.label ?? stmt.id,
        shape: mapping.shape,
        explicit: stmt.label !== undefined || stmt.type !== 'normal',
        ...(cluster !== undefined && { cluster }),
      })
    } else if (stmt.kind === 'transition') {
      edges.push({
        from: stmt.from,
        to: stmt.to,
        style: 'solid',
        ...(stmt.description !== undefined && { label: stmt.description }),
      })
    } else if (stmt.kind === 'compound') {
      clusters.push({ id: stmt.id, label: stmt.id })
      walkStateStatements(stmt.statements, stmt.id, nodes, edges, clusters, warnings)
    }
  }
}

/** Ensure a Node exists for every `[*]` sentinel referenced by a
 * transition. Mermaid renders these as filled circles; inkin uses a
 * terminal node with an empty label. */
function ensureSentinels(nodes: Map<string, NodeAcc>, edges: readonly EdgeAcc[]): void {
  const referenced = new Set<string>()
  for (const e of edges) {
    if (e.from === START_SENTINEL || e.from === END_SENTINEL) referenced.add(e.from)
    if (e.to === START_SENTINEL || e.to === END_SENTINEL) referenced.add(e.to)
  }
  for (const id of referenced) {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: '', shape: 'terminal', explicit: true })
    }
  }
}

// ============================================================================
// Shared assembly
// ============================================================================

/**
 * Upsert a node accumulator. Explicit declarations (those with a label
 * or a non-default shape) win over bare references; a bare reference
 * never overwrites an explicit declaration's label/shape. Cluster
 * membership is set whenever it's provided.
 */
function upsertNode(
  nodes: Map<string, NodeAcc>,
  next: {
    id: string
    label: string
    shape: 'rect' | 'terminal'
    explicit: boolean
    cluster?: string
  },
): void {
  const existing = nodes.get(next.id)
  if (existing === undefined) {
    nodes.set(next.id, {
      id: next.id,
      label: next.label,
      shape: next.shape,
      explicit: next.explicit,
      ...(next.cluster !== undefined && { cluster: next.cluster }),
    })
    return
  }
  // Merge into the existing accumulator.
  if (next.explicit) {
    existing.label = next.label
    existing.shape = next.shape
    existing.explicit = true
  }
  if (next.cluster !== undefined) existing.cluster = next.cluster
}

/** Build the final `DiagramInput` object from the accumulators. Assigns
 * explicit ids to parallel edges (same from→to pair) so the schema's
 * id-uniqueness refinement is satisfied. */
function assembleDiagram(
  nodes: Map<string, NodeAcc>,
  edges: readonly EdgeAcc[],
  clusters: readonly ClusterAcc[],
): unknown {
  const nodeArray = [...nodes.values()].map((n) => ({
    id: n.id,
    label: n.label,
    shape: n.shape,
    ...(n.cluster !== undefined && { cluster: n.cluster }),
  }))

  // Detect parallel edges and assign disambiguating ids.
  const pairCounts = new Map<string, number>()
  for (const e of edges) {
    const key = `${e.from}->${e.to}`
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
  }
  const pairSeen = new Map<string, number>()
  const edgeArray = edges.map((e) => {
    const key = `${e.from}->${e.to}`
    const total = pairCounts.get(key) ?? 1
    let id: string | undefined
    if (total > 1) {
      const n = (pairSeen.get(key) ?? 0) + 1
      pairSeen.set(key, n)
      id = n === 1 ? key : `${key}#${n}`
    }
    return {
      ...(id !== undefined && { id }),
      from: e.from,
      to: e.to,
      style: e.style,
      ...(e.label !== undefined && { label: e.label }),
    }
  })

  const diagram: Record<string, unknown> = {
    schemaVersion: 1,
    nodes: nodeArray,
    edges: edgeArray,
  }
  if (clusters.length > 0) {
    diagram.clusters = clusters.map((c) => ({ id: c.id, label: c.label }))
  }
  return diagram
}
