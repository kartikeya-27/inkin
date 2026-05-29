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
import { afterEach, describe, expect, it } from 'vitest'
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
})
