/**
 * `src/renderer/flows` — the 0.5.0 flow-animation overlay. Internal to
 * the renderer; not re-exported from `src/index.ts`. `<FlowLayer>` is
 * the only component; `composeFlowPath` is the pure path-string helper
 * its DOM-read effect calls per flow.
 *
 * Public surface (within the renderer):
 *   - `FlowLayer`, `FlowLayerProps` — the SVG overlay component.
 *   - `composeFlowPath` — pure string-concatenation helper.
 *   - `__resetFlowWarnings` — test-only escape hatch for the once-per-
 *     process `console.warn` flag set inside `FlowLayer`.
 */

export { composeFlowPath } from './compose-path'
export { __resetFlowWarnings, FlowLayer, type FlowLayerProps } from './FlowLayer'
