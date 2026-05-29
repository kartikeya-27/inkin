'use client'

import { ReactFlowProvider } from '@xyflow/react'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { dagreLayout } from '../schema/layout'
import type { Diagram } from '../schema/types'
import { safeParse } from '../schema/validate'
import styles from './DiagramStudio.module.css'
import { type ToSvgOptions, toSvg } from './export/svg'
import { GraphRenderer } from './GraphRenderer'
import { cn } from './lib/cn'
import { InkinStoreProvider } from './store'
import type { InkinThemeName } from './themes'
import { translate } from './translate'

/**
 * The public inkin React component — drop-in editable React diagrams from a
 * typed Diagram schema.
 *
 * 0.2.0: READ-ONLY renderer. Pan and zoom enabled (xyflow defaults), but no
 * drag-to-move, no edge editing, no inline label edits, no inspector, no
 * palette. Editing affordances land in 0.3.0; the API surface stays additive.
 *
 * Composition:
 *
 *   <DiagramStudio>
 *     <wrapper data-inkin-theme="dark|light">
 *       <InkinStoreProvider>             ← Zustand store for editor-transient state (empty slices in 0.2.0)
 *         <ReactFlowProvider>            ← xyflow's required provider
 *           <GraphRenderer ... />        ← <ReactFlow nodes edges> + Background + Controls + optional MiniMap
 *         </ReactFlowProvider>
 *       </InkinStoreProvider>
 *     </wrapper>
 *   </DiagramStudio>
 *
 * SSR: declared `'use client'` because xyflow accesses `window`/`document` at
 * import time. Next.js App Router consumers must dynamic-import without SSR:
 *
 *   const DiagramStudio = dynamic(
 *     () => import('@inkin/core').then((m) => m.DiagramStudio),
 *     { ssr: false },
 *   )
 *
 * Runtime validation: every render parses `value` via `safeParse()` (defensive
 * against `as Diagram` casts and AI-generated input). If validation fails, an
 * inline error panel renders the field-path-precise issues — no blank canvas,
 * no console-only failure. Cost: one zod parse per `value` reference change.
 */

export interface DiagramStudioProps {
  /** The diagram to render. Must conform to the inkin schema (see `@inkin/core/schema`). */
  readonly value: Diagram
  /** Visual theme — reflected as `data-inkin-theme` on the wrapper. Default `'dark'`. */
  readonly theme?: InkinThemeName
  /**
   * Layout strategy. `'auto'` (default) runs dagre on nodes without explicit
   * positions. `'manual'` trusts the diagram's positions as-is — fall back
   * to `(0, 0)` for any unpositioned node and emits a one-time console warning.
   */
  readonly layout?: 'auto' | 'manual'
  /** Show the xyflow minimap overlay. Default `false`. */
  readonly minimap?: boolean
  /** Show the xyflow viewport controls (zoom in/out, fit-view). Default `true`. */
  readonly controls?: boolean
  /** Additional CSS class for the wrapper element. */
  readonly className?: string | undefined
}

/**
 * Imperative handle returned by the `ref` prop. Lets consumers trigger SVG
 * export from outside the component (e.g. a "Download SVG" button in their
 * own toolbar).
 */
export interface DiagramStudioRef {
  /** Serialize the rendered diagram to an SVG string. See {@link ToSvgOptions}. */
  toSvg(options?: ToSvgOptions): Promise<string>
}

export const DiagramStudio = forwardRef<DiagramStudioRef, DiagramStudioProps>(
  function DiagramStudio(
    { value, theme = 'dark', layout = 'auto', minimap = false, controls = true, className },
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(
      ref,
      () => ({
        toSvg: (options) => {
          if (wrapperRef.current === null) {
            return Promise.reject(new Error('DiagramStudio.toSvg(): component is not mounted yet.'))
          }
          return toSvg(wrapperRef.current, options)
        },
      }),
      [],
    )

    const parseResult = useMemo(() => safeParse(value), [value])

    const translated = useMemo(() => {
      if (!parseResult.success) return null
      const positioned = layout === 'auto' ? dagreLayout.layout(parseResult.data) : parseResult.data
      return translate(positioned)
    }, [parseResult, layout])

    return (
      <div ref={wrapperRef} data-inkin-theme={theme} className={cn(styles.root, className)}>
        {parseResult.success && translated !== null ? (
          <InkinStoreProvider>
            <ReactFlowProvider>
              <GraphRenderer
                nodes={translated.nodes}
                edges={translated.edges}
                showMinimap={minimap}
                showControls={controls}
              />
            </ReactFlowProvider>
          </InkinStoreProvider>
        ) : (
          <div className={styles.error} role="alert">
            <div className={styles.errorTitle}>inkin: invalid Diagram</div>
            {!parseResult.success && (
              <ul className={styles.errorList}>
                {parseResult.error.issues.map((issue) => (
                  <li key={`${issue.path}::${issue.message}`}>
                    <code className={styles.errorPath}>{issue.path}</code>
                    {' — '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  },
)
