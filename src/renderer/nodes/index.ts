import type { NodeTypes } from '@xyflow/react'
import { RectNode } from './RectNode'
import { TerminalNode } from './TerminalNode'

/**
 * `src/renderer/nodes` — schema-node renderers and the xyflow `nodeTypes` map.
 *
 * `nodeTypes` is a partial map (cluster is registered separately by the
 * clusters module). DiagramStudio composes the full map in Phase 9.
 *
 * Adding a new node shape:
 *   1. Add the enum value to `NodeShape` in `src/schema/types.ts`.
 *   2. Create `NewShape.tsx` + `NewShape.module.css` in this folder.
 *   3. Register it in `nodeTypes` below under its enum key.
 *   4. Update translate.ts if any special data mapping is needed.
 */

export type { BaseNodeProps } from './BaseNode'
export { BaseNode } from './BaseNode'
export type { RectNodeType } from './RectNode'
export { RectNode } from './RectNode'
export type { TerminalNodeType } from './TerminalNode'
export { TerminalNode } from './TerminalNode'

/** Schema-node renderers, partial map (cluster lives in clusters/index.ts). */
export const nodeTypes: NodeTypes = {
  rect: RectNode,
  terminal: TerminalNode,
}
