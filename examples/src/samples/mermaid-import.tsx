import { type Diagram, type DiagramInput, DiagramStudio, type InkinThemeName } from '@inkin/core'
import { fromMermaid, toMermaid } from '@inkin/core/mermaid'
import { useEffect, useRef, useState } from 'react'

/**
 * "Mermaid import" sample for `@inkin/core@0.6.0`.
 *
 * A live two-way Mermaid ⇄ diagram editor:
 *   - Type or paste Mermaid `flowchart` / `stateDiagram` source into the
 *     code box → the diagram redraws automatically (debounced, so a
 *     half-typed line doesn't blank the canvas; the last valid diagram
 *     stays on screen while the source is mid-edit / invalid).
 *   - Drag / rename / add / delete in the diagram → the code box
 *     rewrites itself to the canonical `toMermaid` output.
 *
 * The code box is the single source of truth; the diagram is derived
 * from it via `fromMermaid`, and diagram edits flow back through
 * `toMermaid`. A guard ref breaks the edit → code → re-import loop:
 * when the code is rewritten from a diagram edit, the next debounced
 * import is skipped (the diagram is already current).
 *
 * Best-effort import warnings (lossy shapes / styles, dropped features)
 * land in the DevTools console; hard syntax errors show inline without
 * discarding the last good diagram.
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
  const [code, setCode] = useState<string>(STARTER)
  const [diagram, setDiagram] = useState<DiagramInput | null>(() => {
    const r = fromMermaid(STARTER)
    return r.ok ? r.diagram : null
  })
  const [error, setError] = useState<string | null>(null)
  // When true, the next debounced import is skipped — the code was just
  // rewritten from a diagram edit, so the diagram is already current.
  const skipNextImport = useRef(false)

  // Code → diagram (debounced). Keeps the last good diagram on a
  // transient syntax error so the canvas doesn't flicker to empty while
  // the source is mid-edit.
  useEffect(() => {
    if (skipNextImport.current) {
      skipNextImport.current = false
      return
    }
    const handle = setTimeout(() => {
      const result = fromMermaid(code)
      if (result.ok) {
        setDiagram(result.diagram)
        setError(null)
      } else {
        setError(result.issues.map((i) => i.message).join(' · '))
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [code])

  // Diagram → code (canonical re-emit). Marks the import guard so this
  // programmatic code change doesn't bounce back into a re-import.
  const handleDiagramChange = (next: Diagram) => {
    setDiagram(next)
    skipNextImport.current = true
    setCode(toMermaid(next))
  }

  const border = theme === 'dark' ? '#30363d' : '#d1d9e0'
  const panelBg = theme === 'dark' ? '#0d1117' : '#ffffff'
  const codeColor = theme === 'dark' ? '#e6edf3' : '#1f2328'
  const errColor = theme === 'dark' ? '#ff7b72' : '#cf222e'

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
          live two-way — type Mermaid to redraw, edit the diagram to rewrite the code
        </span>
        {error !== null && (
          <span data-testid="mermaid-error" style={{ marginLeft: 'auto', color: errColor }}>
            {error}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: the single live code box (source of truth). */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 360,
            borderRight: `1px solid ${border}`,
            minHeight: 0,
          }}
        >
          <span style={{ padding: '6px 12px', fontSize: 12, opacity: 0.7 }}>
            Mermaid (edit here, or edit the diagram →)
          </span>
          <textarea
            data-testid="mermaid-source"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              borderTop: `1px solid ${border}`,
              padding: '10px 12px',
              background: panelBg,
              color: error !== null ? errColor : codeColor,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              outline: 'none',
            }}
          />
        </div>

        {/* Right: the editable diagram derived from the code. */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {diagram !== null ? (
            <DiagramStudio value={diagram} onChange={handleDiagramChange} theme={theme} controls />
          ) : (
            <div
              role="alert"
              style={{ padding: 20, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}
            >
              <strong>Could not import this Mermaid source.</strong>
              <p style={{ color: errColor }}>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
