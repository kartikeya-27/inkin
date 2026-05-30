import type { StateCreator } from 'zustand'
// biome-ignore lint/correctness/noUnusedImports: type-only ref completes the slices-pattern triangle (edit.ts ↔ index.tsx).
import type { EditorStore } from './index'

/**
 * Inline-edit slice — empty in this commit, filled in Phase 4.
 *
 * The factory adopts the `StateCreator` signature now (rather than the
 * Phase-3-and-earlier `() => Slice` shape) so the store composition in
 * `./index.tsx` already threads `set` / `get` / `store` through every
 * slice. Phase 4 then implements the real state without touching the
 * composition layer.
 */

// Truly-empty record (not `Record<string, never>`, which adds an index
// signature that breaks intersections with the real slices). Phase 4
// replaces this with a real interface.
export type EditSlice = Record<never, never>

export const createEditSlice: StateCreator<EditorStore, [], [], EditSlice> = () => ({})
