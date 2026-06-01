import { type Diagram, type DiagramInput, DiagramStudio, type InkinThemeName } from '@inkin/core'
import { useCallback, useState } from 'react'
import { architecture } from './samples/architecture'
import { editable as initialEditable } from './samples/editable'
import { lifecycle } from './samples/lifecycle'
import { minimal } from './samples/minimal'

/**
 * Examples playground for `@inkin/core@0.4.0` — the editor-chrome release.
 *
 * Four samples wired via a header dropdown:
 *   - Minimal, Lifecycle, Architecture  — read-only (no onChange).
 *     Demonstrate that the 0.2.0 / 0.3.0 surface still works byte-for-byte
 *     after the 0.4.0 chrome additions (no Inspector/Palette render in
 *     read-only mode).
 *   - Editable playground (extended in 0.4.0) — passes onChange so the
 *     Inspector + Palette auto-mount. The playground's secondary toolbar
 *     adds two extra toggles (`inspector` / `palette`) so reviewers can
 *     watch the chrome prop semantics live: 'right'/'left'/'off' for
 *     inspector, 'left'/'top'/'off' for palette.
 */

const readOnlySamples = {
  minimal,
  lifecycle,
  architecture,
} as const

type ReadOnlyKey = keyof typeof readOnlySamples
type SampleKey = ReadOnlyKey | 'editable'

const sampleLabels: Record<SampleKey, string> = {
  minimal: 'Minimal — 3 nodes (read-only)',
  lifecycle: 'Lifecycle — state machine (read-only)',
  architecture: 'Architecture — clustered (read-only)',
  editable: 'Editable playground — drag, edit, delete, chrome',
}

export function App() {
  const [sampleKey, setSampleKey] = useState<SampleKey>('editable')
  const [theme, setTheme] = useState<InkinThemeName>('dark')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        margin: 0,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        background: theme === 'dark' ? '#0d1117' : '#f6f8fa',
        color: theme === 'dark' ? '#e6edf3' : '#1f2328',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 20px',
          borderBottom: `1px solid ${theme === 'dark' ? '#30363d' : '#d1d9e0'}`,
          fontSize: 14,
        }}
      >
        <strong>@inkin/core</strong>
        <span style={{ opacity: 0.7 }}>0.4.0 editor-chrome release</span>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          Sample
          <select
            value={sampleKey}
            onChange={(event) => {
              setSampleKey(event.target.value as SampleKey)
            }}
            style={{ padding: '4px 8px' }}
          >
            {(Object.keys(sampleLabels) as SampleKey[]).map((key) => (
              <option key={key} value={key}>
                {sampleLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Theme
          <select
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value as InkinThemeName)
            }}
            style={{ padding: '4px 8px' }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </header>
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {sampleKey === 'editable' ? (
          <EditablePlaygroundShell theme={theme} />
        ) : (
          <DiagramStudio value={readOnlySamples[sampleKey]} theme={theme} minimap controls />
        )}
      </main>
    </div>
  )
}

/**
 * Editable playground shell — keeps the current Diagram in React state,
 * surfaces a "Last action" line showing what `onChange` fired with, and
 * exposes the 0.4.0 `inspector` / `palette` prop toggles so a reviewer
 * can confirm the default-on chrome and per-panel opt-out work as
 * specified.
 *
 * Real-world persistence is a two-line change:
 *
 *   const [diagram, setDiagram] = useState<DiagramInput>(() =>
 *     JSON.parse(localStorage.getItem('inkin-diagram') ?? JSON.stringify(initialEditable)),
 *   )
 *
 *   const handleChange = (next: Diagram) => {
 *     setDiagram(next)
 *     localStorage.setItem('inkin-diagram', JSON.stringify(next))
 *   }
 *
 * Anything that can hold a JSON-serializable object works: localStorage,
 * IndexedDB, a fetch() to your backend. The schema is the wire format —
 * persist what `onChange` gives you, restore it back into `value`.
 */

type InspectorChoice = 'right' | 'left' | 'off'
type PaletteChoice = 'left' | 'top' | 'off'

function EditablePlaygroundShell({ theme }: { readonly theme: InkinThemeName }) {
  const [diagram, setDiagram] = useState<DiagramInput>(initialEditable)
  const [lastAction, setLastAction] = useState<string>('—')
  const [onChangeCount, setOnChangeCount] = useState<number>(0)
  const [inspector, setInspector] = useState<InspectorChoice>('right')
  const [palette, setPalette] = useState<PaletteChoice>('left')

  const handleChange = useCallback((next: Diagram) => {
    setDiagram(next)
    setLastAction(summarizeDiagram(next))
    setOnChangeCount((c) => c + 1)
  }, [])

  const reset = useCallback(() => {
    setDiagram(initialEditable)
    setLastAction('reset to initial sample')
    setOnChangeCount(0)
  }, [])

  return (
    <>
      <div
        data-testid="editable-status"
        data-onchange-count={onChangeCount}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 20px',
          borderBottom: `1px solid ${theme === 'dark' ? '#30363d' : '#d1d9e0'}`,
          fontSize: 13,
          opacity: 0.85,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <strong>{diagram.nodes.length}</strong> nodes,{' '}
          <strong>{diagram.edges.length}</strong> edges
        </span>
        <span>
          onChange fired <strong data-testid="onchange-count">{onChangeCount}</strong>
          {onChangeCount === 1 ? ' time' : ' times'}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Inspector
          <select
            data-testid="inspector-select"
            value={inspector}
            onChange={(event) => {
              setInspector(event.target.value as InspectorChoice)
            }}
            style={{ padding: '2px 6px' }}
          >
            <option value="right">right</option>
            <option value="left">left</option>
            <option value="off">off</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Palette
          <select
            data-testid="palette-select"
            value={palette}
            onChange={(event) => {
              setPalette(event.target.value as PaletteChoice)
            }}
            style={{ padding: '2px 6px' }}
          >
            <option value="left">left</option>
            <option value="top">top</option>
            <option value="off">off</option>
          </select>
        </label>
        <span style={{ marginLeft: 'auto' }}>
          Last action: <code>{lastAction}</code>
        </span>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '4px 10px',
            border: `1px solid ${theme === 'dark' ? '#30363d' : '#d1d9e0'}`,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          Reset
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <DiagramStudio
          value={diagram}
          onChange={handleChange}
          theme={theme}
          minimap
          controls
          layout="manual"
          inspector={inspector}
          palette={palette}
        />
      </div>
    </>
  )
}

/**
 * Quick human-readable summary of the latest onChange payload, shown in
 * the "Last action" line of the editable playground. Lightweight string
 * formatting only — no diff machinery.
 */
function summarizeDiagram(d: Diagram): string {
  return (
    `${d.nodes.length} nodes / ${d.edges.length} edges` +
    (d.clusters && d.clusters.length > 0 ? ` / ${d.clusters.length} clusters` : '') +
    (d.flows && d.flows.length > 0 ? ` / ${d.flows.length} flows` : '')
  )
}
