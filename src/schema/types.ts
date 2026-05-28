import { z } from 'zod'

/**
 * Inkin Diagram schema (v1).
 *
 * Single flat graph topology — no `kind` discriminator. Covers state machines,
 * architecture diagrams, and flow diagrams; they share topology and differ only
 * in styling. Sequence and timeline diagrams (if they ever ship) get their own
 * components and schemas in a future MAJOR release, never a fake union with this.
 */

export const Position = z.object({
  x: z
    .number()
    .describe('Horizontal coordinate in canvas units (pixels at zoom=1), top-left origin.'),
  y: z
    .number()
    .describe('Vertical coordinate in canvas units (pixels at zoom=1), top-left origin.'),
})
export type Position = z.infer<typeof Position>

export const NodeShape = z
  .enum(['rect', 'terminal'])
  .describe(
    "Visual shape: 'rect' is the default rectangle; 'terminal' is a double-stroked rect typically used for state-machine end states. Visual only — no semantic meaning.",
  )
export type NodeShape = z.infer<typeof NodeShape>

export const EdgeStyle = z
  .enum(['solid', 'dashed'])
  .describe(
    "Edge line styling: 'solid' for direct/sync flows, 'dashed' for async/optional/soft connections.",
  )
export type EdgeStyle = z.infer<typeof EdgeStyle>

export const Node = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      'Unique identifier for this node within the diagram. Referenced by edges and clusters. Non-empty.',
    ),
  label: z
    .string()
    .describe(
      'Primary display text shown inside the node. Required (empty string is allowed for intentionally-blank nodes).',
    ),
  /** Optional monospace subtitle rendered under the main label. */
  sublabel: z
    .string()
    .optional()
    .describe(
      "Optional secondary text rendered below the label in monospace. Use for type annotations or runtime details (e.g., 'Tokio · 50ms', 'PyO3', 'Redis').",
    ),
  /** Omit for auto-layout via the configured LayoutEngine. */
  position: Position.optional().describe(
    'Explicit canvas coordinates. Omit to let the layout engine auto-position. User-provided positions are always preserved.',
  ),
  /** Id of the cluster this node belongs to (must match an existing Cluster.id). */
  cluster: z
    .string()
    .optional()
    .describe(
      'Optional cluster id this node belongs to. Must match an existing Cluster.id in the diagram.',
    ),
  /** Visual shape only — `terminal` is a double-stroked rect, not a state-machine semantic. */
  shape: NodeShape.default('rect').describe("Visual shape of the node. Defaults to 'rect'."),
})
export type Node = z.infer<typeof Node>

export const Edge = z.object({
  /** Optional explicit id; auto-derived from `${from}->${to}` if absent. Required if a Flow references this edge. */
  id: z
    .string()
    .optional()
    .describe(
      'Optional explicit identifier. If omitted, the id is derived from the source and target node ids joined by "->" (for example, an edge from "a" to "b" gets id "a->b"). Required to be explicit when multiple edges connect the same node pair (parallel edges) or when a Flow references this edge.',
    ),
  from: z
    .string()
    .describe('Id of the source node. Must match an existing Node.id in the diagram.'),
  to: z.string().describe('Id of the target node. Must match an existing Node.id in the diagram.'),
  label: z
    .string()
    .optional()
    .describe(
      'Optional text rendered on the edge midpoint, typically describing the transition or relationship (e.g., "acquire GIL", "HTTPS", "success").',
    ),
  style: EdgeStyle.default('solid').describe("Edge line styling. Defaults to 'solid'."),
})
export type Edge = z.infer<typeof Edge>

export const Cluster = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      'Unique identifier for this cluster. Referenced by nodes via Node.cluster and by other clusters via parent.',
    ),
  label: z
    .string()
    .describe(
      'Display text shown at the top of the cluster border (e.g., "python layer", "rust core").',
    ),
  /**
   * Schema accepts `parent` from 0.1.0 onward. Renderers from 0.2.0 through 1.0.0
   * ignore it and flatten with one console warning. Nested cluster rendering lands
   * in 1.2.0 behind `layout="elk"`.
   */
  parent: z
    .string()
    .optional()
    .describe(
      'Optional id of a parent cluster for nesting. Must match an existing Cluster.id. Schema accepts nesting from 0.1.0 but renderers flatten it (with a console warning) until 1.2.0.',
    ),
})
export type Cluster = z.infer<typeof Cluster>

export const Flow = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      'Unique identifier for this flow. Used to reference the flow from the editor UI in 1.1.0.',
    ),
  /** Optional caption — schema-only in 0.5.0; rendered by the flow-editor UI in 1.1.0. */
  label: z
    .string()
    .optional()
    .describe(
      'Optional human-readable caption for the flow. Schema-only in 0.5.0; rendered by the flow-editor UI in 1.1.0.',
    ),
  /** Ordered list of edge ids the animated token traverses. */
  edges: z
    .array(z.string())
    .min(1)
    .describe(
      'Ordered list of edge ids the animated token traverses. Each id must match either an explicit Edge.id or the auto-derived form (source and target node ids joined by "->"). Minimum one edge.',
    ),
  /** Milliseconds per full loop. */
  duration: z
    .number()
    .positive()
    .default(7000)
    .describe('Milliseconds per full animation loop. Default 7000 (7 seconds).'),
  /** Milliseconds offset, for staggering parallel flows. */
  delay: z
    .number()
    .default(0)
    .describe('Milliseconds offset for staggering parallel flows. Default 0.'),
  /** CSS color string or `var(--inkin-...)` token. Defaults to theme primary. */
  color: z
    .string()
    .optional()
    .describe(
      "Optional CSS color string or CSS custom-property reference (e.g., 'var(--inkin-accent-primary)'). Defaults to the active theme's primary color.",
    ),
})
export type Flow = z.infer<typeof Flow>

/**
 * The Diagram contract. `schemaVersion: 1` is tied to the package MAJOR — a
 * `schemaVersion: 2` would ship together with `inkin@2.0.0` and a `migrate()` helper.
 */
export const Diagram = z
  .object({
    schemaVersion: z
      .literal(1)
      .describe(
        'Schema version. Must be the literal 1 in this release. Tied to the package MAJOR — `schemaVersion: 2` will only ship with inkin@2.0.0.',
      ),
    nodes: z.array(Node).describe('Nodes in the diagram. Order is not significant for rendering.'),
    edges: z
      .array(Edge)
      .describe('Edges connecting nodes. Order is not significant for rendering.'),
    clusters: z
      .array(Cluster)
      .optional()
      .describe(
        'Optional subgraph clusters. Nodes reference clusters by Cluster.id via Node.cluster.',
      ),
    flows: z
      .array(Flow)
      .optional()
      .describe(
        'Optional animated data-flow definitions. Each flow declares an ordered sequence of edge ids the animated token traverses.',
      ),
  })
  .superRefine((diagram, ctx) => {
    // --- id uniqueness checks --------------------------------------------------
    const nodeIds = new Set<string>()
    diagram.nodes.forEach((node, idx) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', idx, 'id'],
          message: `duplicate node id "${node.id}" (also seen earlier in the nodes array)`,
        })
      }
      nodeIds.add(node.id)
    })

    const clusterIds = new Set<string>()
    diagram.clusters?.forEach((cluster, idx) => {
      if (clusterIds.has(cluster.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['clusters', idx, 'id'],
          message: `duplicate cluster id "${cluster.id}"`,
        })
      }
      clusterIds.add(cluster.id)
    })

    // Build the canonical edge-id set (explicit ids OR auto-derived `${from}->${to}`)
    const edgeIds = new Set<string>()
    const autoEdgeId = (e: Edge) => e.id ?? `${e.from}->${e.to}`
    diagram.edges.forEach((edge, idx) => {
      const id = autoEdgeId(edge)
      if (edgeIds.has(id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', idx, edge.id ? 'id' : 'from'],
          message: edge.id
            ? `duplicate edge id "${edge.id}"`
            : `duplicate edge "${id}" — give the edge an explicit \`id\` to disambiguate parallel edges`,
        })
      }
      edgeIds.add(id)
    })

    diagram.flows?.forEach((flow, idx) => {
      const flowIds = new Set<string>()
      flow.edges.forEach((eid, eidx) => {
        if (flowIds.has(eid)) {
          ctx.addIssue({
            code: 'custom',
            path: ['flows', idx, 'edges', eidx],
            message: `flow "${flow.id}" lists edge "${eid}" twice — flows must be a unique ordered sequence`,
          })
        }
        flowIds.add(eid)
      })
    })

    // --- reference integrity checks --------------------------------------------
    diagram.edges.forEach((edge, idx) => {
      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', idx, 'from'],
          message: `edge.from references unknown node id "${edge.from}"`,
        })
      }
      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', idx, 'to'],
          message: `edge.to references unknown node id "${edge.to}"`,
        })
      }
    })

    diagram.nodes.forEach((node, idx) => {
      if (node.cluster && !clusterIds.has(node.cluster)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', idx, 'cluster'],
          message: `node references unknown cluster id "${node.cluster}"`,
        })
      }
    })

    diagram.clusters?.forEach((cluster, idx) => {
      if (cluster.parent && !clusterIds.has(cluster.parent)) {
        ctx.addIssue({
          code: 'custom',
          path: ['clusters', idx, 'parent'],
          message: `cluster.parent references unknown cluster id "${cluster.parent}"`,
        })
      }
      if (cluster.parent === cluster.id) {
        ctx.addIssue({
          code: 'custom',
          path: ['clusters', idx, 'parent'],
          message: `cluster "${cluster.id}" cannot be its own parent`,
        })
      }
    })

    diagram.flows?.forEach((flow, idx) => {
      flow.edges.forEach((eid, eidx) => {
        if (!edgeIds.has(eid)) {
          ctx.addIssue({
            code: 'custom',
            path: ['flows', idx, 'edges', eidx],
            message: `flow "${flow.id}" references unknown edge id "${eid}" — use either an explicit edge.id or the auto-derived "from->to" form`,
          })
        }
      })
    })
  })

export type Diagram = z.infer<typeof Diagram>
