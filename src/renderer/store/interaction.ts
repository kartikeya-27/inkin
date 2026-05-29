/**
 * Interaction slice — empty in 0.2.0.
 *
 * In 0.3.0 (editing) this will hold:
 *   - mode: 'idle' | 'dragging' | 'placing-node' | 'placing-cluster'
 *   - hoveredNodeId / hoveredEdgeId / hoveredClusterId
 *   - dragInfo (target node id + start/current positions, when mid-drag)
 *   - setMode(mode), beginDrag(id, pos), updateDrag(pos), endDrag(), etc.
 *
 * See selection.ts for the rationale behind shipping the empty stub now.
 */

export type InteractionSlice = Record<string, never>

export const createInteractionSlice = (): InteractionSlice => ({})
