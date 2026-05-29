import { toSvg as htmlToSvg } from 'html-to-image'

/**
 * Serialize a rendered DiagramStudio viewport to an SVG string.
 *
 * Pass the DOM element of the React Flow viewport — typically obtained via
 * a ref attached to the `<DiagramStudio>` wrapper, or via `useReactFlow()`
 * inside the rendered tree. Returns a Promise that resolves to a complete
 * SVG document as a string (suitable for download as `.svg`, embedding in
 * HTML, or feeding to another serializer).
 *
 * Implementation: wraps `html-to-image`'s `toSvg`, which composes the HTML
 * node renderers + the SVG edge layer into a single SVG document via SVG
 * `<foreignObject>`. This is the canonical pattern in the React Flow
 * ecosystem because xyflow renders nodes as HTML + edges as SVG; capturing
 * both into one image requires bridging the two.
 *
 * Caveats:
 *   - The export captures the entire DOM subtree of the element, including
 *     off-screen elements. The output viewBox matches the element's
 *     bounding-box; pan/zoom state at capture time affects what's visible
 *     in the resulting SVG.
 *   - Web fonts loaded via @font-face that the consumer's site uses (but
 *     html-to-image can't inline) may fall back to system defaults in the
 *     exported SVG. Use system fonts (we do by default) to avoid this.
 *   - Returns a Promise — async because html-to-image's internal canvas
 *     pipeline is async.
 */

export interface ToSvgOptions {
  /** Width override; defaults to the element's `clientWidth`. */
  readonly width?: number
  /** Height override; defaults to the element's `clientHeight`. */
  readonly height?: number
  /**
   * Background color (CSS color string) for the SVG canvas. Defaults to
   * transparent. Pass `var(--inkin-bg-canvas)` to match the active theme,
   * but be aware that CSS variables don't resolve in the exported SVG —
   * pass a concrete color (e.g. `'#0d1117'` for dark theme).
   */
  readonly backgroundColor?: string
  /**
   * Device pixel ratio for raster fallbacks inside the SVG. Default 1.
   * Increase (e.g. 2) for crisper output on hi-DPI displays.
   */
  readonly pixelRatio?: number
}

export async function toSvg(element: HTMLElement, options: ToSvgOptions = {}): Promise<string> {
  return htmlToSvg(element, {
    ...(options.width !== undefined && { width: options.width }),
    ...(options.height !== undefined && { height: options.height }),
    ...(options.backgroundColor !== undefined && {
      backgroundColor: options.backgroundColor,
    }),
    ...(options.pixelRatio !== undefined && { pixelRatio: options.pixelRatio }),
  })
}
