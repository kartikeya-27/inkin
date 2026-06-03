import { useEdges, useNodes, useViewport } from '@xyflow/react'
import type { Flow } from '../../schema/types'
import { composeFlowPath } from './compose-path'
import styles from './FlowLayer.module.css'

/**
 * `<FlowLayer>` — the SVG overlay that renders one animated token per
 * `Flow` defined in the consumer's diagram. New in 0.5.0.
 *
 * Phase 2 (this commit): scaffold only. Renders the SVG container +
 * one static `<circle>` per resolvable flow at `offset-distance: 0%`
 * (i.e., pinned at the start of its composed path). No animation yet —
 * Phase 3 adds the `@keyframes flowTraverse` + `animation` CSS.
 *
 * Mount point: the last child of `<ReactFlow>` in `GraphRenderer.tsx`
 * (wired in Phase 4). Children of `<ReactFlow>` render at the React
 * Flow root level (siblings to `.react-flow__viewport`), not inside
 * the panned/zoomed viewport — so this component reads xyflow's
 * current viewport via `useViewport()` and applies the same
 * `transform: translate(x, y) scale(zoom)` to its own SVG root.
 * `transform-origin: 0 0` matches xyflow's convention, so flow
 * coordinates the `composeFlowPath` helper emits align 1:1 with the
 * edge paths xyflow renders inside the viewport.
 *
 * `pointer-events: none` on the SVG root — the layer is decorative
 * and must never intercept clicks meant for nodes / edges / the canvas
 * pane underneath.
 *
 * Defensive resolution: if `composeFlowPath` returns `null` for any
 * flow (transitional state where xyflow's nodes/edges arrays are
 * stale relative to the parsed diagram, or — far less likely — a
 * misconfigured flow that slipped past `superRefine`), that flow is
 * skipped this tick. A one-time `console.warn` per flow id surfaces
 * persistent misconfigurations without spamming consumers during
 * normal render churn.
 */

const warnedFlowIds = new Set<string>()

function warnOnceUnresolved(flowId: string): void {
  if (warnedFlowIds.has(flowId)) return
  warnedFlowIds.add(flowId)
  console.warn(
    `[inkin] flow "${flowId}" could not be resolved to a renderable path — one or more referenced edges or nodes are missing from xyflow's current state. The flow will be skipped this render. (This warning fires once per flow id per process.)`,
  )
}

/**
 * Test-only: reset the once-per-process warning set so a test suite
 * can exercise the warning path multiple times. Not exported from the
 * package public surface — internal to the flows folder + its tests.
 */
export function __resetFlowWarnings(): void {
  warnedFlowIds.clear()
}

export interface FlowLayerProps {
  /**
   * The consumer's flow definitions, read from `diagram.flows` by
   * `DiagramStudioInner` (wired in Phase 4). Optional — when absent or
   * empty the layer renders nothing. The component does NOT trigger a
   * remount when this prop reference changes; React's normal diffing
   * suffices.
   */
  readonly flows?: readonly Flow[] | undefined
}

export function FlowLayer({ flows }: FlowLayerProps) {
  const xyNodes = useNodes()
  const xyEdges = useEdges()
  const { x, y, zoom } = useViewport()

  if (flows === undefined || flows.length === 0) return null

  // Transitional-state guard. When xyflow's store hasn't yet populated
  // its nodes/edges (the first one or two renders after mount under the
  // controlled-state path used by `useFlowSync`), every `composeFlowPath`
  // call would resolve to `null` and we'd emit a spurious "could not be
  // resolved" warning per flow — even though the diagram is fine and the
  // next render will succeed. `superRefine` guarantees that a non-empty
  // `flows` array always references resolvable edges in the parsed
  // diagram, so an empty xyflow store is unambiguously transitional.
  // Render nothing this tick; the next render (when xyflow's store
  // commits) will produce the SVG.
  if (xyEdges.length === 0 || xyNodes.length === 0) return null

  return (
    <svg
      className={styles.root}
      style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
      data-testid="inkin-flow-layer"
      aria-hidden="true"
    >
      <title>Animated data-flow tokens</title>
      {flows.map((flow) => {
        const d = composeFlowPath({ flow, xyNodes, xyEdges })
        if (d === null) {
          warnOnceUnresolved(flow.id)
          return null
        }
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
                // Phase 2: static at the path start. Phase 3 adds the
                // `flowTraverse` animation + offset-distance 0% → 100%
                // keyframes. The `--inkin-flow-path` custom property
                // is the seam — Phase 3 references it from the
                // `animation` rule without having to re-render the
                // inline style here.
                '--inkin-flow-path': `path('${d}')`,
                '--inkin-flow-duration': `${flow.duration}ms`,
                '--inkin-flow-delay': `${flow.delay}ms`,
                fill: color,
                color, // for `currentColor` use in the drop-shadow filter
              } as React.CSSProperties
            }
          />
        )
      })}
    </svg>
  )
}
