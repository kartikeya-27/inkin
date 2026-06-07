import { useEdges, useNodes, useViewport } from '@xyflow/react'
import { useEffect, useLayoutEffect, useState } from 'react'
import type { Flow } from '../../schema/types'
import { composeFlowPath } from './compose-path'
import styles from './FlowLayer.module.css'

/**
 * `<FlowLayer>` — the SVG overlay that renders one animated token per
 * `Flow` defined in the consumer's diagram. New in 0.5.0.
 *
 * Mount point: the last child of `<ReactFlow>` in `GraphRenderer.tsx`.
 * Children of `<ReactFlow>` render at the React Flow root level
 * (siblings to `.react-flow__viewport`), not inside the panned/zoomed
 * viewport. This component reads xyflow's current viewport via
 * `useViewport()` and applies the same `transform: translate(x, y)
 * scale(zoom)` to its own SVG root with `transform-origin: 0 0`,
 * mirroring xyflow's coordinate system 1:1.
 *
 * Path source (Phase 10 architecture decision): rather than re-compute
 * source/target points and call `getSmoothStepPath` ourselves, we read
 * each edge's `d` attribute straight off xyflow's already-rendered
 * `.react-flow__edge[data-id="..."] > path` element. xyflow's internal
 * handle-bounds math (handle width, handle offset relative to node,
 * node-vs-rendered-height differences) is the source of truth for edge
 * geometry — re-implementing it produced tokens 6-12px off the visible
 * edges (Phase 10 visual review). Reading the d attribute strings the
 * engine has already committed is strictly correct: tokens align
 * pixel-perfectly with the visible edges.
 *
 * `pointer-events: none` on the SVG root — the layer is decorative and
 * must never intercept clicks meant for nodes / edges / the canvas
 * pane underneath.
 *
 * Defensive resolution: if any edge in a flow's `edges` doesn't have a
 * rendered `<path>` with a non-empty `d` attribute, that flow is
 * skipped this tick. A one-time `console.warn` per flow id surfaces
 * persistent misconfigurations (`superRefine` already catches the
 * common case at parse time) without spamming consumers during normal
 * render churn.
 */

const warnedFlowIds = new Set<string>()

function warnOnceUnresolved(flowId: string): void {
  if (warnedFlowIds.has(flowId)) return
  warnedFlowIds.add(flowId)
  console.warn(
    `[inkin] flow "${flowId}" could not be resolved to a renderable path — one or more referenced edges aren't currently rendered by xyflow. The flow will be skipped this render. (This warning fires once per flow id per process.)`,
  )
}

/**
 * Test-only: reset the once-per-process warning set so a test suite
 * can exercise the warning path multiple times.
 */
export function __resetFlowWarnings(): void {
  warnedFlowIds.clear()
}

export interface FlowLayerProps {
  /**
   * The consumer's flow definitions, read from `diagram.flows` by
   * `DiagramStudioInner`. Optional — when absent or empty the layer
   * renders nothing.
   */
  readonly flows?: readonly Flow[] | undefined
}

/**
 * Read xyflow's currently-rendered `d` attribute for a single edge id.
 * Uses `CSS.escape` so flow consumer-supplied edge ids with special
 * characters (e.g. `req->in`) don't break the selector.
 */
function readEdgePath(edgeId: string): string | null {
  // `CSS.escape` is available in all Playwright-targeted engines and in
  // jsdom 22+. Guarded for SSR safety even though FlowLayer is mounted
  // under `<ReactFlowProvider>` which is itself client-only.
  if (typeof document === 'undefined' || typeof CSS === 'undefined') return null
  const el = document.querySelector(
    `.react-flow__edge[data-id="${CSS.escape(edgeId)}"] path.react-flow__edge-path`,
  )
  // Fall back to the first `<path>` in the edge group if the specific
  // class isn't present (xyflow may rename it across versions; the
  // `react-flow__edge-path` class is the documented one as of v12 but
  // checking the structural fallback is cheap insurance).
  const path =
    el ?? document.querySelector(`.react-flow__edge[data-id="${CSS.escape(edgeId)}"] path`)
  const d = path?.getAttribute('d')
  if (d === null || d === undefined || d.length === 0) return null
  return d
}

export function FlowLayer({ flows }: FlowLayerProps) {
  const xyNodes = useNodes()
  const xyEdges = useEdges()
  const { x, y, zoom } = useViewport()

  // composedByFlow: flow.id → concatenated offset-path string.
  // Updated in `useLayoutEffect` after every render so xyflow's edges
  // have committed their `d` attributes before we read them.
  const [composedByFlow, setComposedByFlow] = useState<ReadonlyMap<string, string>>(() => new Map())

  // `useLayoutEffect` runs synchronously after DOM commit but before
  // paint, so we read xyflow's edge `<path>` `d` attributes in the same
  // frame they're written — no flicker, no stale paths. The effect's
  // deps cover the signals that drive edge geometry change:
  //   - `flows`: the consumer's flow definitions themselves changed.
  //   - `xyNodes` / `xyEdges`: xyflow's node/edge arrays have a new
  //     reference, meaning xyflow has re-rendered edges (any node move,
  //     any add/remove). We read their lengths in the transitional
  //     guard below to ALSO satisfy the linter that these deps are
  //     used, not just signal carriers.
  // Viewport pan/zoom (`x`/`y`/`zoom`) is NOT in the dep list — viewport
  // changes don't alter the `d` strings (they're in flow-coord space);
  // they only shift the SVG's outer transform, which is set inline in
  // the JSX below and re-reads naturally on every render.
  useLayoutEffect(() => {
    if (flows === undefined || flows.length === 0 || xyEdges.length === 0 || xyNodes.length === 0) {
      if (composedByFlow.size !== 0) setComposedByFlow(new Map())
      return
    }
    const next = new Map<string, string>()
    for (const flow of flows) {
      const segments: string[] = []
      let allResolved = true
      for (const edgeId of flow.edges) {
        const d = readEdgePath(edgeId)
        if (d === null) {
          allResolved = false
          break
        }
        segments.push(d)
      }
      if (!allResolved) continue
      const composed = composeFlowPath(segments)
      if (composed !== null) next.set(flow.id, composed)
    }
    // Avoid a setState (and re-render) when nothing changed by value.
    if (next.size !== composedByFlow.size) {
      setComposedByFlow(next)
      return
    }
    for (const [k, v] of next) {
      if (composedByFlow.get(k) !== v) {
        setComposedByFlow(next)
        return
      }
    }
    // Otherwise: identical map, no setState.
  }, [flows, xyNodes, xyEdges, composedByFlow])

  // Once per flow id: if `flows` is set and committed for at least one
  // render cycle yet `composedByFlow` still has no entry for it, warn.
  // Deferred via `useEffect` (not LayoutEffect) so the very first render
  // — when state is still empty — doesn't fire a spurious warning.
  useEffect(() => {
    if (flows === undefined) return
    for (const flow of flows) {
      if (!composedByFlow.has(flow.id)) warnOnceUnresolved(flow.id)
    }
  }, [flows, composedByFlow])

  if (flows === undefined || flows.length === 0) return null
  if (composedByFlow.size === 0) return null

  return (
    <svg
      className={styles.root}
      style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
      data-testid="inkin-flow-layer"
      aria-hidden="true"
    >
      <title>Animated data-flow tokens</title>
      {flows.map((flow) => {
        const d = composedByFlow.get(flow.id)
        if (d === undefined) return null
        const color = flow.color ?? 'var(--inkin-accent-primary)'
        return (
          <circle
            key={flow.id}
            className={styles.flowToken}
            data-testid={`inkin-flow-token-${flow.id}`}
            data-flow-id={flow.id}
            r="6"
            cx="0"
            cy="0"
            style={
              {
                // Three custom properties drive the CSS animation:
                //   - `--inkin-flow-path` → the composed offset-path
                //   - `--inkin-flow-duration` → per-flow loop duration
                //   - `--inkin-flow-delay`    → per-flow start offset
                // The `.flowToken` rule reads all three so multiple
                // flows share one `@keyframes flowTraverse` definition
                // while each having independent timing.
                '--inkin-flow-path': `path('${d}')`,
                '--inkin-flow-duration': `${flow.duration}ms`,
                '--inkin-flow-delay': `${flow.delay}ms`,
                fill: color,
                color, // for `currentColor` in the drop-shadow filter
              } as React.CSSProperties
            }
          />
        )
      })}
    </svg>
  )
}
