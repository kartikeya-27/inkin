/**
 * Inspector — internal barrel.
 *
 * Not re-exported from `src/index.ts`. The panel and its sub-Fields are
 * an implementation detail of `<DiagramStudio>`'s editable chrome; the
 * only public-facing knob is the `inspector` prop on `<DiagramStudio>`
 * (Phase 8 wires it).
 */

export { ClusterFields, type ClusterFieldsProps } from './ClusterFields'
export { EdgeFields, type EdgeFieldsProps } from './EdgeFields'
export { EmptyState } from './EmptyState'
export {
  InspectorPanel,
  type InspectorPanelProps,
  type InspectorPosition,
} from './InspectorPanel'
export { NodeFields, type NodeFieldsProps } from './NodeFields'
