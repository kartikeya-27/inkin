/**
 * Selection slice — empty in 0.2.0.
 *
 * In 0.3.0 (editing release) this will hold:
 *   - selectedNodeIds: ReadonlySet<string>
 *   - selectedEdgeIds: ReadonlySet<string>
 *   - selectedClusterIds: ReadonlySet<string>
 *   - setSelection({...}), toggleNode(id), clearSelection(), etc.
 *
 * The scaffolding exists in 0.2.0 so the store-provider machinery is in place
 * and multi-instance isolation is verified end-to-end (two `<DiagramStudio>`
 * instances get isolated stores). Filling the slice in 0.3.0 is a fill-in-the-
 * blanks operation, not a refactor of how the store is mounted or consumed.
 */

export type SelectionSlice = Record<string, never>

export const createSelectionSlice = (): SelectionSlice => ({})
