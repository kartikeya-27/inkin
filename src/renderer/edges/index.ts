import type { EdgeTypes } from '@xyflow/react'
import { LabeledEdge } from './LabeledEdge'

/**
 * `src/renderer/edges` — schema-edge renderers and the xyflow `edgeTypes` map.
 *
 * 0.2.0 has exactly one edge type: `labeled` (handles both solid and dashed
 * styles based on data.style, with an optional midpoint label). The map
 * key matches the `type: 'labeled'` value set by translate.ts on every
 * xyflow edge it emits.
 */

export type { LabeledEdgeType } from './LabeledEdge'
export { LabeledEdge } from './LabeledEdge'

export const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
}
