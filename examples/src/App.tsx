import { type Diagram, DiagramStudio, type DiagramInput, type InkinThemeName } from '@inkin/core'
import { useCallback, useState } from 'react'
import { architecture } from './samples/architecture'
import { editable as initialEditable } from './samples/editable'
import { lifecycle } from './samples/lifecycle'
import { minimal } from './samples/minimal'

/**
 * Examples playground for `@inkin/core@0.3.0` — the editing release.
 *
 * Four samples wired in via a header dropdown:
 *   - Minimal, Lifecycle, Architecture  — read-only (no onChange).
 *     Demonstrates the 0.2.0 surface still works byte-for-byte after the
 *     0.3.0 changes.
 *   - Editable playground (new in 0.3.0) — passes an onChange that round-
 *     trips into a useState. Drag a node, double-click a label, press
 *     Delete on a selected node — every change updates the displayed
 *     "Last action" + the diagram re-renders from React state.
 *
 * For real-world consumers, swapping the in-memory useState for
 * localStorage persistence is a two-line change — see the inline comment
 * in the EditablePlaygroundShell component below.
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
  editable: 'Editable playground — drag, edit, delete',
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
        <span style={{ opacity: 0.7 }}>0.3.0 editing release</span>
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
 * Editable playground shell — keeps the current Diagram in React state and
 * surfaces a "Last action" line so consumers can see exactly what
 * `onChange` fired with.
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
function EditablePlaygroundShell({ theme }: { readonly theme: InkinThemeName }) {
  const [diagram, setDiagram] = useState<DiagramInput>(initialEditable)
  const [lastAction, setLastAction] = useState<string>('—')

  const handleChange = useCallback((next: Diagram) => {
    setDiagram(next)
    setLastAction(summarizeDiagram(next))
  }, [])

  const reset = useCallback(() => {
    setDiagram(initialEditable)
    setLastAction('reset to initial sample')
  }, [])

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 20px',
          borderBottom: `1px solid ${theme === 'dark' ? '#30363d' : '#d1d9e0'}`,
          fontSize: 13,
          opacity: 0.85,
        }}
      >
        <span>
          <strong>{diagram.nodes.length}</strong> nodes,{' '}
          <strong>{diagram.edges.length}</strong> edges
        </span>
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
  return `${d.nodes.length} nodes / ${d.edges.length} edges` +
    (d.clusters && d.clusters.length > 0 ? ` / ${d.clusters.length} clusters` : '') +
    (d.flows && d.flows.length > 0 ? ` / ${d.flows.length} flows` : '')
}
