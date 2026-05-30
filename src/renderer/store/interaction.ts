import type { StateCreator } from 'zustand'
import type { EditorStore } from './index'

/**
 * Interaction slice — still empty in 0.3.0.
 *
 * Lands in 0.4.0 with the Palette / Inspector chrome:
 *   - mode: 'idle' | 'placing-node' | 'placing-cluster'
 *   - hoveredNodeId / hoveredEdgeId / hoveredClusterId
 *
 * 0.3.0's canvas-only editing surface drives interaction state through
 * xyflow directly (drag mode is owned by xyflow's local store; we don't
 * mirror it). Selection + inline-edit are enough for the Patch-driven
 * flow this release exposes.
 *
 * The slice factory adopts the `StateCreator` signature now so 0.4.0 can
 * fill in state and actions without restructuring how the store is
 * composed in `./index.tsx`.
 */

// Truly-empty record (not `Record<string, never>`, which adds an index
// signature that breaks intersections with the real slices).
export type InteractionSlice = Record<never, never>

export const createInteractionSlice: StateCreator<
  EditorStore,
  [],
  [],
  InteractionSlice
> = () => ({})
