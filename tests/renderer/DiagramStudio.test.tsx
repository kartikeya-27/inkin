// @vitest-environment jsdom

/**
 * `<DiagramStudio>` smoke tests.
 *
 * These tests validate the React surface's externally-observable contract
 * under JSDOM:
 *   - Mounting with a valid Diagram does not throw and renders the wrapper
 *     with the correct `data-inkin-theme` attribute.
 *   - Mounting with an invalid Diagram renders the inline error panel
 *     (DX commitment #6 — "Error-on-mistake, not silent-render").
 *   - The `theme` prop reflects to the wrapper's `data-inkin-theme` value.
 *   - The `className` prop composes with the internal root class.
 *
 * What we do NOT assert here (and why):
 *   - Pixel layout, node positions, edge geometry — JSDOM's
 *     `getBoundingClientRect` returns zeros, so xyflow can't actually lay
 *     out. Pixel-level checks belong in the Playwright e2e suite landing
 *     in 0.3.0 alongside the editing affordances.
 *   - SVG export — `html-to-image` requires a real browser; tested via
 *     Playwright in 0.3.0.
 *   - Store-internal behavior — the 0.2.0 store slices are empty by
 *     design (filled in 0.3.0). The per-instance isolation gate (#29
 *     from the plan) lands with the editor work in 0.3.0 since there's
 *     no selection state yet to leak between instances.
 */

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagramStudio } from '../../src/renderer/DiagramStudio'
import type { Diagram } from '../../src/schema/types'

afterEach(() => {
  cleanup()
})

const validDiagram: Diagram = {
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'Start', shape: 'rect' },
    { id: 'b', label: 'End', shape: 'terminal' },
  ],
  edges: [{ from: 'a', to: 'b', label: 'go', style: 'solid' }],
}

describe('<DiagramStudio>', () => {
  it('mounts a valid diagram without throwing and applies the default theme', () => {
    const { container } = render(<DiagramStudio value={validDiagram} />)
    const wrapper = container.firstElementChild
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveAttribute('data-inkin-theme', 'dark')
  })

  it('honors an explicit theme prop', () => {
    const { container } = render(<DiagramStudio value={validDiagram} theme="light" />)
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveAttribute('data-inkin-theme', 'light')
  })

  it('appends a custom className to the root wrapper', () => {
    const { container } = render(<DiagramStudio value={validDiagram} className="custom-frame" />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('custom-frame')
  })

  it('renders an inline error panel when the diagram fails validation', () => {
    const invalid = {
      schemaVersion: 1,
      nodes: [{ label: 'missing-id', shape: 'rect' }],
      edges: [],
    } as unknown as Diagram

    const { getByRole, getByText } = render(<DiagramStudio value={invalid} />)
    const panel = getByRole('alert')
    expect(panel).toBeInTheDocument()
    expect(panel.textContent).toContain('invalid Diagram')
    // The formatted error path points at the first node's missing `id`.
    expect(getByText(/diagram\.nodes\[0\]\.id/)).toBeInTheDocument()
  })

  it('mounts two independent instances on the same page without crashing', () => {
    const { container } = render(
      <>
        <DiagramStudio value={validDiagram} theme="dark" />
        <DiagramStudio value={validDiagram} theme="light" />
      </>,
    )
    const wrappers = container.querySelectorAll('[data-inkin-theme]')
    expect(wrappers).toHaveLength(2)
    expect(wrappers[0]).toHaveAttribute('data-inkin-theme', 'dark')
    expect(wrappers[1]).toHaveAttribute('data-inkin-theme', 'light')
  })

  it('mounts in editable mode when onChange is supplied without throwing', () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={validDiagram} onChange={onChange} />)
    const wrapper = container.firstElementChild
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveAttribute('data-inkin-theme', 'dark')
    // Component mounts without dispatch yet — onChange only fires on real events.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('survives a value-reference change without unmounting', () => {
    const onChange = vi.fn()
    const next: Diagram = {
      schemaVersion: 1,
      nodes: [{ id: 'a', label: 'Renamed', shape: 'rect' }],
      edges: [],
    }
    const { container, rerender } = render(
      <DiagramStudio value={validDiagram} onChange={onChange} />,
    )
    const wrapperBefore = container.firstElementChild
    rerender(<DiagramStudio value={next} onChange={onChange} />)
    const wrapperAfter = container.firstElementChild
    // Same DOM element — providers stayed mounted; only the inner state re-seeded.
    expect(wrapperAfter).toBe(wrapperBefore)
  })

  it('shows the inline error panel in editable mode too when value is invalid', () => {
    const onChange = vi.fn()
    const invalid = {
      schemaVersion: 1,
      nodes: [{ label: 'missing-id', shape: 'rect' }],
      edges: [],
    } as unknown as Diagram
    const { getByRole } = render(<DiagramStudio value={invalid} onChange={onChange} />)
    expect(getByRole('alert')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})

// --- 0.4.0: inspector / palette chrome -----------------------------------------

describe('<DiagramStudio> — 0.4.0 inspector + palette chrome', () => {
  it('mounts no Inspector and no Palette in read-only mode (no onChange)', () => {
    const { queryByTestId } = render(<DiagramStudio value={validDiagram} />)
    expect(queryByTestId('inkin-inspector')).toBeNull()
    expect(queryByTestId('inkin-palette')).toBeNull()
  })

  it('mounts both Inspector and Palette by default when onChange is provided', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<DiagramStudio value={validDiagram} onChange={onChange} />)
    expect(getByTestId('inkin-inspector')).toBeInTheDocument()
    expect(getByTestId('inkin-palette')).toBeInTheDocument()
  })

  it('inspector="off" hides only the Inspector', () => {
    const onChange = vi.fn()
    const { queryByTestId, getByTestId } = render(
      <DiagramStudio value={validDiagram} onChange={onChange} inspector="off" />,
    )
    expect(queryByTestId('inkin-inspector')).toBeNull()
    expect(getByTestId('inkin-palette')).toBeInTheDocument()
  })

  it('palette="off" hides only the Palette', () => {
    const onChange = vi.fn()
    const { queryByTestId, getByTestId } = render(
      <DiagramStudio value={validDiagram} onChange={onChange} palette="off" />,
    )
    expect(queryByTestId('inkin-palette')).toBeNull()
    expect(getByTestId('inkin-inspector')).toBeInTheDocument()
  })

  it('palette="top" applies the positionTop class', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <DiagramStudio value={validDiagram} onChange={onChange} palette="top" />,
    )
    expect(getByTestId('inkin-palette').className).toMatch(/positionTop/)
  })

  it('inspector="left" applies the positionLeft class', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <DiagramStudio value={validDiagram} onChange={onChange} inspector="left" />,
    )
    expect(getByTestId('inkin-inspector').className).toMatch(/positionLeft/)
  })

  it('warns once when chrome is explicitly enabled without onChange', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { queryByTestId, rerender } = render(
      <DiagramStudio value={validDiagram} inspector="right" />,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/inspector.*palette/i)
    // Panels still don't render — read-only mode doesn't mount the providers.
    expect(queryByTestId('inkin-inspector')).toBeNull()

    // Re-rendering with the same props does not re-warn (one per instance).
    rerender(<DiagramStudio value={validDiagram} inspector="right" />)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('does not warn when chrome is explicitly OFF in read-only mode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<DiagramStudio value={validDiagram} inspector="off" palette="off" />)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not warn in editable mode regardless of chrome props', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onChange = vi.fn()
    render(
      <DiagramStudio value={validDiagram} onChange={onChange} inspector="right" palette="left" />,
    )
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

// --- 0.5.0: flow-animation overlay --------------------------------------------

/**
 * `<DiagramStudio>` is the integration point for `<FlowLayer>`: when the
 * parsed diagram carries a `flows` field, the layer must mount inside
 * `<ReactFlow>` (so its hooks resolve) and render one `<circle>` per flow.
 * When no `flows` field exists (the 0.4.x shape) the layer must NOT mount —
 * the byte-for-byte backwards-compat gate.
 *
 * Per-flow visual behavior (color, custom properties, animation rule) is
 * already covered by `tests/renderer/flows/FlowLayer.test.tsx`. The tests
 * below focus on the seam — does the wiring through `DiagramStudio` →
 * `DiagramStudioInner` → `GraphRenderer` → `FlowLayer` carry the
 * `parsedDiagram.flows` field through correctly.
 */
describe('<DiagramStudio> — 0.5.0 flow overlay', () => {
  const diagramWithFlows: Diagram = {
    schemaVersion: 1,
    nodes: [
      { id: 'a', label: 'Start', shape: 'rect' },
      { id: 'b', label: 'End', shape: 'terminal' },
    ],
    edges: [{ from: 'a', to: 'b', label: 'go', style: 'solid' }],
    flows: [{ id: 'pulse', edges: ['a->b'], duration: 7000, delay: 0 }],
  }

  it('mounts <FlowLayer> when the diagram carries a non-empty flows field', () => {
    const { container } = render(<DiagramStudio value={diagramWithFlows} />)
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).not.toBeNull()
    expect(container.querySelectorAll('circle[data-testid^="inkin-flow-token-"]')).toHaveLength(1)
  })

  it('renders one circle per flow under a multi-flow diagram', () => {
    const multi: Diagram = {
      ...diagramWithFlows,
      flows: [
        { id: 'pulse-a', edges: ['a->b'], duration: 7000, delay: 0 },
        { id: 'pulse-b', edges: ['a->b'], duration: 5000, delay: 1000 },
      ],
    }
    const { container } = render(<DiagramStudio value={multi} />)
    expect(container.querySelectorAll('circle[data-testid^="inkin-flow-token-"]')).toHaveLength(2)
  })

  it('mounts no <FlowLayer> when the diagram has no flows field (0.4.x parity)', () => {
    // `validDiagram` from the file scope above has no `flows` — that's the
    // 0.4.x shape every existing consumer sends today.
    const { container } = render(<DiagramStudio value={validDiagram} />)
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })

  it('mounts no <FlowLayer> when flows is an empty array', () => {
    const empty: Diagram = { ...diagramWithFlows, flows: [] }
    const { container } = render(<DiagramStudio value={empty} />)
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).toBeNull()
  })

  it('mounts <FlowLayer> in editable mode too — flows are independent of editing', () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={diagramWithFlows} onChange={onChange} />)
    expect(container.querySelector('[data-testid="inkin-flow-layer"]')).not.toBeNull()
    expect(container.querySelectorAll('circle[data-testid^="inkin-flow-token-"]')).toHaveLength(1)
  })
})
