/**
 * `src/renderer/flows` — the 0.5.0 flow-animation overlay. Internal to
 * the renderer; not re-exported from `src/index.ts`. `<FlowLayer>` is
 * the only component; `composeFlowPath` is the pure path-composition
 * helper its render loop calls per flow per tick.
 *
 * Public surface (within the renderer):
 *   - `FlowLayer`, `FlowLayerProps` — the SVG overlay component.
 *   - `composeFlowPath`, `ComposeFlowPathOptions` — the pure helper.
 *   - `__resetFlowWarnings` — test-only escape hatch for the once-per-
 *     process `console.warn` flag set inside `FlowLayer`.
 */

export { type ComposeFlowPathOptions, composeFlowPath } from './compose-path'
export { __resetFlowWarnings, FlowLayer, type FlowLayerProps } from './FlowLayer'
