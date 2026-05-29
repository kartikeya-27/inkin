/**
 * `src/renderer/export` — SVG export utilities for the rendered diagram.
 *
 * 0.2.0 ships only SVG export. PNG export lands in `1.1.0` (post-stable; needs
 * canvas rasterization with text-on-path workarounds that aren't pulling weight
 * for the v0.x line). Consumers can produce a PNG today by feeding the exported
 * SVG to any rendering library of their choice.
 */

export type { ToSvgOptions } from './svg'
export { toSvg } from './svg'
