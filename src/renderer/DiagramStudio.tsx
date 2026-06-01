'use client'

import { ReactFlowProvider } from '@xyflow/react'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Diagram, DiagramInput } from '../schema/types'
import { buildArrowKeyNudger, useKeymap } from './a11y'
import styles from './DiagramStudio.module.css'
import { EditingProvider, useFlowSync } from './editing'
import { type ToSvgOptions, toSvg } from './export/svg'
import { GraphRenderer } from './GraphRenderer'
import { InspectorPanel, type InspectorPosition } from './inspector'
import { cn } from './lib/cn'
import { Palette, type PalettePosition } from './palette'
import { InkinStoreProvider } from './store'
import type { InkinThemeName } from './themes'

/**
 * The public inkin React component — drop-in editable React diagrams from a
 * typed Diagram schema.
 *
 * **0.3.0 (this commit):** core editing. Omit `onChange` for byte-for-byte
 * 0.2.0 read-only behavior (pan/zoom, no drag/select/connect). Provide
 * `onChange` for editable mode: drag-to-move, drag-handle-to-connect,
 * Delete-key cascade removal, and inline label editing (Phase 9 lands the
 * `<EditableLabel>` primitive — this commit gates the canvas behavior on
 * the prop). No Inspector / Palette — those land in 0.4.0.
 *
 * Composition:
 *
 *   <DiagramStudio>
 *     <wrapper data-inkin-theme="dark|light">
 *       <InkinStoreProvider>           ← Zustand: selection + inline-edit state
 *         <ReactFlowProvider>          ← xyflow's required provider
 *           <DiagramStudioInner>       ← calls useFlowSync, branches on parseError
 *         </ReactFlowProvider>
 *       </InkinStoreProvider>
 *     </wrapper>
 *   </DiagramStudio>
 *
 * The provider split (outer DiagramStudio mounts providers; inner component
 * runs the hook) keeps Phase 11's keymap and Phase 10's EditableLabel free
 * to call `useEditorStore` without prop-drilling. The providers are stable
 * across renders so the wrapper div + ref-based SVG export remain mounted
 * even when `value` parse fails.
 *
 * SSR: declared `'use client'` because xyflow accesses `window`/`document` at
 * import time. Next.js App Router consumers must dynamic-import without SSR:
 *
 *   const DiagramStudio = dynamic(
 *     () => import('@inkin/core').then((m) => m.DiagramStudio),
 *     { ssr: false },
 *   )
 *
 * Runtime validation: `useFlowSync` re-validates `value` via `safeParse()` on
 * every reference change. If validation fails, an inline error panel renders
 * the field-path-precise issues — no blank canvas, no console-only failure.
 * Defense in depth: every patch produced by the editor also re-validates
 * before `onChange` fires, so a bug in the internal reducer can't escape an
 * invalid Diagram to the consumer.
 */

export interface DiagramStudioProps {
  /**
   * The diagram to render. Accepts the **input** shape (`DiagramInput`) — the
   * object literal you'd hand to `parse()` directly, with defaulted fields
   * like `Node.shape` and `Edge.style` left out. A parsed `Diagram` is also
   * accepted (output is structurally assignable to input). Validation happens
   * internally on every reference change.
   */
  readonly value: DiagramInput
  /**
   * Editing toggle. Omit for read-only (0.2.0 behavior). Provide for
   * editable mode — drag-to-move, drag-handle-to-connect, Delete-key
   * removal with cascade, inline label editing all turn on. The callback
   * receives the parsed-and-validated next `Diagram`; consumers update
   * their state (and any persistence layer) inside this callback. The
   * schema is the single source of truth: the editor never holds
   * independent state.
   */
  readonly onChange?: (next: Diagram) => void
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
  /**
   * Inspector panel position. New in 0.4.0. Defaults:
   *   - `'right'` when `onChange` is provided (editable mode)
   *   - `'off'` when read-only (no `onChange`)
   *
   * Explicit `'right'` or `'left'` is honored only in editable mode; in
   * read-only mode the panel cannot mount because no `EditingProvider`
   * exists, and a one-time `console.warn` surfaces the misconfiguration.
   */
  readonly inspector?: InspectorPosition | 'off'
  /**
   * Palette toolbar position. New in 0.4.0. Same defaults as `inspector`:
   * `'left'` when editable, `'off'` when read-only. Same warning behavior
   * when explicitly set in read-only mode.
   */
  readonly palette?: PalettePosition | 'off'
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

interface DiagramStudioInnerProps {
  readonly value: DiagramInput
  readonly layout: 'auto' | 'manual'
  readonly minimap: boolean
  readonly controls: boolean
  readonly onChange?: (next: Diagram) => void
  /**
   * Outer wrapper ref — passed down so the Phase 11 keymap can attach its
   * keydown handler. The wrapper itself is rendered by the outer
   * DiagramStudio (for the data-inkin-theme attribute + SVG export ref).
   */
  readonly wrapperRef: React.RefObject<HTMLDivElement | null>
  /**
   * Resolved Inspector position (defaults already applied by the outer
   * DiagramStudio). `'off'` means do not mount the panel.
   */
  readonly inspector: InspectorPosition | 'off'
  /** Resolved Palette position. `'off'` means do not mount the toolbar. */
  readonly palette: PalettePosition | 'off'
}

/**
 * Inner component — runs `useFlowSync` (must be inside the providers from
 * `DiagramStudio` so future phases that read the editor store via
 * `useEditorStore` work). Branches on `parseError` to render either the
 * canvas or the inline error panel.
 */
function DiagramStudioInner({
  value,
  layout,
  minimap,
  controls,
  onChange,
  wrapperRef,
  inspector,
  palette,
}: DiagramStudioInnerProps) {
  const sync = useFlowSync({
    value,
    layout,
    // `exactOptionalPropertyTypes` requires we omit `onChange` from the
    // options object entirely when undefined — passing `onChange: undefined`
    // would be a type error.
    ...(onChange !== undefined && { onChange }),
  })

  if (sync.parseError !== null) {
    return (
      <div className={styles.error} role="alert">
        <div className={styles.errorTitle}>inkin: invalid Diagram</div>
        <ul className={styles.errorList}>
          {sync.parseError.issues.map((issue) => (
            <li key={`${issue.path}::${issue.message}`}>
              <code className={styles.errorPath}>{issue.path}</code>
              {' — '}
              {issue.message}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const canvas = (
    <div className={styles.canvasArea}>
      {/*
        KeymapMount must be a child of EditingProvider so its
        `useEditingActions()` call sees the actions context (used by the
        Enter keybinding to start an inline edit). It returns null — its
        only side-effect is attaching the keydown handler in `useKeymap`.
        In read-only mode (no provider mounted below) the keymap still
        mounts but `enabled: false` makes it a no-op.
      */}
      <KeymapMount
        wrapperRef={wrapperRef}
        enabled={sync.isEditable}
        parsedDiagram={sync.parsedDiagram}
        dispatchMoveNode={sync.dispatchMoveNode}
      />
      <GraphRenderer
        nodes={sync.nodes}
        edges={sync.edges}
        showMinimap={minimap}
        showControls={controls}
        editable={sync.isEditable}
        onNodesChange={sync.onNodesChange}
        onEdgesChange={sync.onEdgesChange}
        onConnect={sync.onConnect}
        onNodesDelete={sync.onNodesDelete}
        onEdgesDelete={sync.onEdgesDelete}
        onNodeDragStop={sync.onNodeDragStop}
        onPaneClick={sync.onPaneClick}
      />
    </div>
  )

  // Build the chrome+canvas tree as flex siblings so the panels reserve
  // space instead of overlaying the canvas. The earlier overlay model
  // (Decision #6 in the original plan) hid the right-most node and
  // edge labels behind the panels in default state — flex reserves real
  // space so every node + label stays visible.
  const showPalette = sync.isEditable && palette !== 'off'
  const showInspector = sync.isEditable && inspector !== 'off' && sync.parsedDiagram !== null
  const paletteOnTop = showPalette && palette === 'top'

  const innerRow = (
    <div className={styles.contentRow}>
      {showPalette && palette === 'left' && <Palette position={palette} />}
      {showInspector && inspector === 'left' && sync.parsedDiagram !== null && (
        <InspectorPanel diagram={sync.parsedDiagram} position={inspector} />
      )}
      {canvas}
      {showInspector && inspector === 'right' && sync.parsedDiagram !== null && (
        <InspectorPanel diagram={sync.parsedDiagram} position={inspector} />
      )}
    </div>
  )

  const layoutContent = paletteOnTop ? (
    <div className={styles.layoutColumn}>
      <Palette position={palette} />
      {innerRow}
    </div>
  ) : (
    <div className={styles.layoutRow}>{innerRow}</div>
  )

  // EditingContext is mounted ONLY in editable mode — its presence is the
  // signal that BaseNode / LabeledEdge use to decide between an
  // <EditableLabel> (editable) and a static <div> (read-only). The 0.4.0
  // Inspector + Palette mount inside the provider too so they can consume
  // EditorActionsContext (sibling to EditingContext).
  if (!sync.isEditable) return layoutContent
  return (
    <EditingProvider
      dispatchSetField={sync.dispatchSetField}
      dispatchAddNode={sync.dispatchAddNode}
      dispatchAddCluster={sync.dispatchAddCluster}
      dispatchAssignCluster={sync.dispatchAssignCluster}
    >
      {layoutContent}
    </EditingProvider>
  )
}

/**
 * Mounts the keyboard a11y layer. Lives as a real child component (not a
 * hook call at the top of DiagramStudioInner) so its `useEditingActions()`
 * call resolves against the EditingProvider above it — without this seam,
 * the keymap would see a null editing context and Enter→inline-edit would
 * silently no-op. Renders nothing.
 */
interface KeymapMountProps {
  readonly wrapperRef: React.RefObject<HTMLDivElement | null>
  readonly enabled: boolean
  readonly parsedDiagram: Diagram | null
  readonly dispatchMoveNode: (nodeId: string, position: { x: number; y: number }) => void
}

function KeymapMount({ wrapperRef, enabled, parsedDiagram, dispatchMoveNode }: KeymapMountProps) {
  const nudgeNode = useMemo(
    () => buildArrowKeyNudger({ parsedDiagram, dispatchMoveNode }),
    [parsedDiagram, dispatchMoveNode],
  )
  const getNodeLabel = useMemo(
    () => (id: string) => parsedDiagram?.nodes.find((n) => n.id === id)?.label ?? null,
    [parsedDiagram],
  )
  useKeymap({ target: wrapperRef, enabled, dispatchMoveNode: nudgeNode, getNodeLabel })
  return null
}

export const DiagramStudio = forwardRef<DiagramStudioRef, DiagramStudioProps>(
  function DiagramStudio(
    {
      value,
      onChange,
      theme = 'dark',
      layout = 'auto',
      minimap = false,
      controls = true,
      inspector: inspectorProp,
      palette: paletteProp,
      className,
    },
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const isEditable = onChange !== undefined

    // Default-derive: chrome shows by default in editable mode, hides in
    // read-only mode. Consumers opt out per-panel via 'off'.
    const inspector: InspectorPosition | 'off' = inspectorProp ?? (isEditable ? 'right' : 'off')
    const palette: PalettePosition | 'off' = paletteProp ?? (isEditable ? 'left' : 'off')

    // One-time warning when a consumer explicitly mounts chrome but didn't
    // supply onChange — the panels can't function (no EditingProvider, no
    // dispatcher verbs) and silently dropping them would be confusing.
    // Tracked via ref so the warning fires once per mounted instance, not
    // on every render.
    const warnedRef = useRef(false)
    const explicitlyMisconfigured =
      !isEditable &&
      ((inspectorProp !== undefined && inspectorProp !== 'off') ||
        (paletteProp !== undefined && paletteProp !== 'off'))
    useEffect(() => {
      if (explicitlyMisconfigured && !warnedRef.current) {
        warnedRef.current = true
        console.warn(
          '[inkin] DiagramStudio: `inspector` / `palette` props have no effect without `onChange` (read-only mode). Provide an onChange callback to enable the editor chrome, or remove the prop.',
        )
      }
    }, [explicitlyMisconfigured])

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

    return (
      <div ref={wrapperRef} data-inkin-theme={theme} className={cn(styles.root, className)}>
        <InkinStoreProvider>
          <ReactFlowProvider>
            <DiagramStudioInner
              value={value}
              layout={layout}
              minimap={minimap}
              controls={controls}
              wrapperRef={wrapperRef}
              inspector={inspector}
              palette={palette}
              {...(onChange !== undefined && { onChange })}
            />
          </ReactFlowProvider>
        </InkinStoreProvider>
      </div>
    )
  },
)
