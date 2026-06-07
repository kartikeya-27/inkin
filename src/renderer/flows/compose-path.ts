/**
 * Pure helper: concatenate an ordered sequence of edge `d` strings into a
 * single continuous SVG path suitable for CSS `offset-path: path(...)`.
 *
 * Architecture decision (Phase 10): the d strings come from xyflow's
 * already-rendered `.react-flow__edge > path` elements rather than being
 * re-computed here from node/edge positions. Re-computing involves
 * xyflow's internal handle-bound math (handle width, handle offset
 * relative to node, node-vs-rendered-height differences) which we
 * deliberately don't reimplement — `getSmoothStepPath` alone doesn't
 * give the same output xyflow uses internally, so any port would drift.
 * Trusting xyflow's own rendered geometry is strictly correct and lets
 * the tokens align pixel-perfectly with the visible edges.
 *
 * The only logic this helper still owns: M-stripping. `offset-path:
 * path(...)` traces a path continuously — multiple `M` (moveto) commands
 * cause the token to "teleport" between subpaths instead of tracing one
 * continuous trajectory. We keep the first segment intact and rewrite
 * subsequent segments' leading `M x y` as `L x y` so the result is one
 * continuous subpath. Adjacent edges produce visually seamless
 * transitions; non-adjacent sequences (where flow.edges[i].target ≠
 * flow.edges[i+1].source) render a straight connector segment between
 * the previous endpoint and the next start. The non-adjacent case is an
 * artifact, not a failure — the schema allows it; the renderer
 * represents it honestly.
 */

/**
 * Strip the leading `M x y` (moveto) command from a segment so it can
 * be appended after a previous segment as part of one continuous path.
 * Returns the input unchanged if it doesn't start with a recognized
 * `M`-prefix — defensive guard against a future xyflow path format that
 * doesn't begin with `M`.
 */
function asContinuation(segment: string): string {
  // xyflow's smooth-step paths come in shapes like:
  //   "M246 93.234L266 93.234L 294,93.234Q 300,93.234 300,99.234..."
  // Allow both `M x y` and `M x,y` separators, optional decimals + signs.
  const match = segment.match(/^M\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*(.*)$/)
  if (match === null) return segment
  const [, x, y, body] = match
  // Re-anchor with `L` so we trace a continuous line from the previous
  // segment's endpoint to this segment's start coordinates, then
  // continue with the original body.
  return `L ${x} ${y} ${body ?? ''}`.trim()
}

/**
 * Concatenate edge `d` strings into one continuous SVG path.
 *
 * @param edgePathStrings Ordered xyflow edge `d` attributes — one per
 *   edge in `flow.edges`, in flow order. The caller (FlowLayer) reads
 *   these from `.react-flow__edge[data-id] > path` after xyflow commits
 *   its edges to the DOM.
 * @returns The composed `d` string, or `null` if the input is empty or
 *   any element is empty/missing (transitional render state — FlowLayer
 *   treats this as "skip this flow this tick").
 */
export function composeFlowPath(edgePathStrings: readonly string[]): string | null {
  if (edgePathStrings.length === 0) return null
  if (edgePathStrings.some((s) => s.length === 0)) return null
  if (edgePathStrings.length === 1) return edgePathStrings[0] ?? null

  const [first, ...rest] = edgePathStrings
  return [first ?? '', ...rest.map(asContinuation)].join(' ')
}
