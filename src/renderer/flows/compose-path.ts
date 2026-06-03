import {
  getSmoothStepPath,
  Position,
  type Edge as XyEdge,
  type Node as XyNode,
} from '@xyflow/react'
import type { Flow } from '../../schema/types'

/**
 * Pure helper: turn a `Flow` (schema-side: ordered edge ids + duration +
 * color) into a single continuous SVG `d` string suitable for the CSS
 * `offset-path: path(...)` of an animated `<circle>`.
 *
 * Why pure: deterministic input → output is the gate the Phase 1 test
 * suite hammers, including non-adjacent edge sequences and resolution
 * failures. `<FlowLayer>` reads xyflow's nodes/edges via hooks, calls
 * this for each flow, and memoizes on reference equality.
 *
 * Path composition strategy:
 *   1. Resolve each flow.edges[i] against `xyEdges` by id. xyflow's edge
 *      `id` is always populated post-`translate()` and matches the
 *      schema's `effectiveEdgeId` form (explicit `Edge.id` or the
 *      auto-derived `${from}->${to}`), so a plain id-keyed Map lookup
 *      covers both shapes.
 *   2. Resolve each edge's source/target xyNode by id.
 *   3. Compute the right-edge of the source node and the left-edge of
 *      the target node (the inkin convention — every rect/terminal node
 *      exposes a right source handle and a left target handle via
 *      BaseNode). Width and height come from `node.measured` when
 *      xyflow has finished its layout effect; otherwise they fall back
 *      to the same `NODE_WIDTH` / `NODE_HEIGHT_BASE` defaults
 *      `translate.ts` uses.
 *   4. Call xyflow's `getSmoothStepPath` with the same `borderRadius: 6`
 *      that `LabeledEdge` uses — guarantees the composed path follows
 *      the *exact same curve* each edge is drawn with. No visual drift
 *      between the edge stroke and the animated token's trajectory.
 *   5. Concatenate the per-edge `d` strings. The first segment stays
 *      as-is. For segments 2..N we strip the leading `M x y ` (moveto)
 *      and replace it with `L x y ` (lineto) so the path remains one
 *      continuous subpath — `offset-path` traces a continuous distance
 *      without "teleporting" between disjoint `M`s. Adjacent edges
 *      (where flow.edges[i].target === flow.edges[i+1].source) produce
 *      visually seamless transitions; non-adjacent sequences render a
 *      straight connector segment between the previous endpoint and
 *      the next start. The non-adjacent case is an artifact, not a
 *      failure — the schema allows it, the renderer represents it
 *      honestly.
 *
 * Returns `null` if any edge id doesn't resolve to an `xyEdge`, or if
 * any resolved edge's source/target node id doesn't resolve to an
 * `xyNode`. `superRefine` catches the first case at parse time, so this
 * branch is only reachable during the transitional render states where
 * xyflow's nodes/edges arrays are stale relative to the parsed diagram
 * (e.g., between a value-change and the next layout effect). `<FlowLayer>`
 * treats `null` as "skip this flow this tick" and emits a `console.warn`
 * once per flow id per process so a real misconfiguration doesn't go
 * silent.
 */

// Keep in sync with `src/renderer/translate.ts` — both modules need the
// same fallback dimensions when xyflow hasn't measured a node yet.
const NODE_WIDTH_FALLBACK = 180
const NODE_HEIGHT_FALLBACK = 60

interface NodeBounds {
  readonly position: { readonly x: number; readonly y: number }
  readonly width: number
  readonly height: number
}

function readBounds(node: XyNode): NodeBounds {
  // `node.measured.{width,height}` is populated by xyflow after its
  // dimension-measurement effect runs. Before that — on the first render
  // pass after a value change — we fall back to the same constants
  // `translate.ts` already trusts.
  const width = node.measured?.width ?? node.width ?? NODE_WIDTH_FALLBACK
  const height = node.measured?.height ?? node.height ?? NODE_HEIGHT_FALLBACK
  return { position: node.position, width, height }
}

function buildSourcePoint(node: XyNode): { x: number; y: number } {
  const { position, width, height } = readBounds(node)
  return { x: position.x + width, y: position.y + height / 2 }
}

function buildTargetPoint(node: XyNode): { x: number; y: number } {
  const { position, height } = readBounds(node)
  return { x: position.x, y: position.y + height / 2 }
}

/**
 * Strip the leading `M x y ` (moveto) command from a segment so it can
 * be appended after a previous segment as part of one continuous path.
 * Returns the input unchanged if it doesn't start with a recognized
 * `M`-prefix — that's a defensive guard against future xyflow version
 * bumps that change the path format.
 */
function asContinuation(segment: string): string {
  // Allow both `M x y` and `M x,y` separators, optional decimals + signs.
  // Capture the rest of the path after the moveto.
  const match = segment.match(/^M\s*-?\d+(?:\.\d+)?[\s,]+-?\d+(?:\.\d+)?\s*(.*)$/)
  if (match === null) return segment
  // Re-anchor with `L` so we trace a continuous line from the previous
  // segment's endpoint to this segment's start coordinates. The first
  // numeric pair from the original `M` is reconstructed by the L that
  // follows (xyflow's smooth-step paths always have an explicit second
  // command after the leading M).
  const rest = match[1] ?? ''
  // The path body after `M x y` already begins with a command (`L`, `Q`,
  // etc.) — we just need to inject the original (x, y) as the L target
  // before that command. Extract the original numbers from the moveto.
  const movetoMatch = segment.match(/^M\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*(.*)$/)
  if (movetoMatch === null) return segment
  const [, x, y, body] = movetoMatch
  return `L ${x} ${y} ${body ?? rest}`.trim()
}

export interface ComposeFlowPathOptions {
  readonly flow: Flow
  readonly xyNodes: readonly XyNode[]
  readonly xyEdges: readonly XyEdge[]
}

/**
 * The Phase 1 helper. Pure: same inputs → same output, every time.
 * Tested exhaustively in `tests/renderer/flows/compose-path.test.ts`.
 */
export function composeFlowPath(options: ComposeFlowPathOptions): string | null {
  const { flow, xyNodes, xyEdges } = options
  if (flow.edges.length === 0) return null

  const edgeById = new Map<string, XyEdge>()
  for (const edge of xyEdges) edgeById.set(edge.id, edge)

  const nodeById = new Map<string, XyNode>()
  for (const node of xyNodes) nodeById.set(node.id, node)

  const segments: string[] = []
  for (const edgeId of flow.edges) {
    const edge = edgeById.get(edgeId)
    if (edge === undefined) return null

    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)
    if (source === undefined || target === undefined) return null

    const { x: sourceX, y: sourceY } = buildSourcePoint(source)
    const { x: targetX, y: targetY } = buildTargetPoint(target)

    // borderRadius: 6 mirrors LabeledEdge.tsx — composed paths follow
    // the exact same curve the edges are drawn with.
    const [d] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition: Position.Right,
      targetX,
      targetY,
      targetPosition: Position.Left,
      borderRadius: 6,
    })
    segments.push(d)
  }

  if (segments.length === 1) return segments[0] ?? null

  const [first, ...rest] = segments
  const joined = [first ?? '', ...rest.map(asContinuation)].join(' ')
  return joined
}
