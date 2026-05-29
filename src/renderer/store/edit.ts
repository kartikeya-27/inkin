/**
 * Inline-edit slice — empty in 0.2.0.
 *
 * In 0.3.0 (editing) this will hold:
 *   - editingTarget: { kind: 'node'|'edge'|'cluster', id: string, field: 'label'|'sublabel' } | null
 *   - draftText: string
 *   - beginEdit(target), updateDraft(text), commitEdit(), cancelEdit()
 *
 * Only one inline edit can be active at a time (commit-on-blur semantics);
 * cleanly captured by a single nullable `editingTarget` rather than per-node
 * boolean flags scattered across components.
 *
 * See selection.ts for the rationale behind shipping the empty stub now.
 */

export type EditSlice = Record<string, never>

export const createEditSlice = (): EditSlice => ({})
