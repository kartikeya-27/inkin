import { type Diagram, type DiagramInput, DiagramStudio, type InkinThemeName } from '@inkin/core'
import { fromMermaid, toMermaid } from '@inkin/core/mermaid'
import { useMemo, useState } from 'react'

/**
 * "Mermaid import" sample for `@inkin/core@0.6.0`.
 *
 * Demonstrates the bidirectional bridge live:
 *   - Paste Mermaid `flowchart` / `stateDiagram` source into the
 *     textarea → it runs `fromMermaid` and renders the result as an
 *     editable `<DiagramStudio>`.
 *   - Edit the diagram (drag / rename / Inspector / Palette) — the
 *     "Mermaid output" pane re-emits the current diagram via `toMermaid`
 *     on every change, so reviewers can watch the round-trip in real
 *     time.
 *   - Syntax errors surface inline; best-effort warnings land in the
 *     DevTools console (lossy shapes / styles, dropped features).
 */

const STARTER = `flowchart LR
  browser[Browser] --> api[API Gateway]
  api -.-> web[Web Service]
  web --> db[(Database)]
  web --> cache[(Redis)]
  subgraph data[data tier]
    db
    cache
  end`

export function MermaidImportShell({ theme }: { readonly theme: InkinThemeName }) {
  const [source, setSource] = useState<string>(STARTER)
  const [diagram, setDiagram] = useState<DiagramInput | null>(() => {
    const r = fromMermaid(STARTER)
    return r.ok ? r.diagram : null
  })
  const [issues, setIssues] = useState<readonly { message: string }[]>([])

  // Re-emit Mermaid from the current diagram on every edit so the output
  // pane mirrors the live state.
  const emitted = useMemo(() => (diagram ? toMermaid(diagram as Diagram) : ''), [diagram])

  const runImport = () => {
    const result = fromMermaid(source)
    if (result.ok) {
      setDiagram(result.diagram)
      setIssues([])
    } else {
      setDiagram(null)
      setIssues(result.issues)
    }
  }

  const border = theme === 'dark' ? '#30363d' : '#d1d9e0'
  const panelBg = theme === 'dark' ? '#0d1117' : '#ffffff'
  const codeColor = theme === 'dark' ? '#e6edf3' : '#1f2328'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '8px 20px',
          borderBottom: `1px solid ${border}`,
          fontSize: 13,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <strong>Mermaid bridge</strong>
        <span style={{ opacity: 0.7 }}>
          paste Mermaid → import → edit → re-emit (round-trip)
        </span>
        <button
          type="button"
          onClick={runImport}
          data-testid="mermaid-import-btn"
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            border: `1px solid ${border}`,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          Import →
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: source + output panes */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 360,
            borderRight: `1px solid ${border}`,
            minHeight: 0,
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <span style={{ padding: '6px 12px', fontSize: 12, opacity: 0.7 }}>
              Mermaid source (editable)
            </span>
            <textarea
              data-testid="mermaid-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                resize: 'none',
                border: 'none',
                borderTop: `1px solid ${border}`,
                padding: '10px 12px',
                background: panelBg,
                color: codeColor,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                fontSize: 12,
                lineHeight: 1.5,
                outline: 'none',
              }}
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <span style={{ padding: '6px 12px', fontSize: 12, opacity: 0.7 }}>
              toMermaid(currentDiagram) — updates as you edit
            </span>
            <pre
              data-testid="mermaid-output"
              style={{
                flex: 1,
                margin: 0,
                overflow: 'auto',
                borderTop: `1px solid ${border}`,
                padding: '10px 12px',
                background: panelBg,
                color: codeColor,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {emitted}
            </pre>
          </div>
        </div>

        {/* Right: the editable diagram */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {diagram !== null ? (
            <DiagramStudio
              value={diagram}
              onChange={(next: Diagram) => setDiagram(next)}
              theme={theme}
              controls
            />
          ) : (
            <div
              role="alert"
              style={{ padding: 20, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}
            >
              <strong>Could not import this Mermaid source.</strong>
              <ul>
                {issues.map((i) => (
                  <li key={i.message}>{i.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
