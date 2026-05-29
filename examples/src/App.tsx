import { DiagramStudio, type InkinThemeName } from '@inkin/core'
import { useState } from 'react'
import { architecture } from './samples/architecture'
import { lifecycle } from './samples/lifecycle'
import { minimal } from './samples/minimal'

/**
 * Examples playground for `@inkin/core@0.2.0` — the read-only renderer.
 *
 * Three samples are wired in via a header dropdown so each rendering path
 * (linear chain, clustered architecture, state machine with self-loop) can
 * be eyeballed against the production build in one window. The dark/light
 * toggle exercises the `data-inkin-theme` attribute + token CSS.
 *
 * No `onChange` is passed — editing affordances land in 0.3.0. Pan and zoom
 * still work because xyflow ships them by default; that matches the plan's
 * "interactive read-only" promise.
 */

const samples = {
  minimal,
  lifecycle,
  architecture,
} as const

type SampleKey = keyof typeof samples

const sampleLabels: Record<SampleKey, string> = {
  minimal: 'Minimal — 3 nodes',
  lifecycle: 'Lifecycle — state machine',
  architecture: 'Architecture — clustered',
}

export function App() {
  const [sampleKey, setSampleKey] = useState<SampleKey>('minimal')
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
        <span style={{ opacity: 0.7 }}>0.2.0 read-only renderer</span>
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
      <main style={{ flex: 1, minHeight: 0 }}>
        <DiagramStudio value={samples[sampleKey]} theme={theme} minimap controls />
      </main>
    </div>
  )
}
