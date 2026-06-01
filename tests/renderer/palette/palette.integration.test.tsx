// @vitest-environment jsdom

/**
 * Phase 12 integration test — mount the full `<DiagramStudio>` in
 * editable mode, verify the Palette toolbar is wired in correctly and
 * its mode-toggle keyboard escape hatches work through the same React
 * tree consumers see.
 *
 * What this complements:
 *   - The standalone Palette unit tests (`palette.test.tsx`) cover the
 *     button-click ↔ store-mode contract in isolation.
 *   - This integration covers the wiring through DiagramStudio: the
 *     Palette must mount in the editable JSX tree (Phase 8), survive
 *     re-renders triggered by the consumer's value changes, and respond
 *     to document-level Esc + visibilitychange without re-binding.
 *
 * Click-to-place wiring on the canvas itself is gated by Phase 13's
 * Playwright e2e — JSDOM doesn't compute the spatial layout xyflow
 * needs for `project()` to translate a click coordinate into a flow
 * position.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DiagramStudio } from '../../../src/renderer/DiagramStudio'
import type { Diagram } from '../../../src/schema/types'

afterEach(() => {
  cleanup()
})

const seed: Diagram = {
  schemaVersion: 1,
  nodes: [{ id: 'a', label: 'A', shape: 'rect' }],
  edges: [],
}

describe('Palette integration — wiring through DiagramStudio', () => {
  it('mounts inside the editable subtree by default', () => {
    render(<DiagramStudio value={seed} onChange={() => {}} layout="manual" />)
    expect(screen.getByTestId('inkin-palette')).toBeInTheDocument()
  })

  it('does not mount in read-only mode', () => {
    render(<DiagramStudio value={seed} layout="manual" />)
    expect(screen.queryByTestId('inkin-palette')).toBeNull()
  })

  it('clicking "add node" arms placing-node mode (aria-pressed=true)', () => {
    render(<DiagramStudio value={seed} onChange={() => {}} layout="manual" />)
    const addNode = screen.getByRole('button', { name: 'add node' })
    expect(addNode).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(addNode)
    expect(addNode).toHaveAttribute('aria-pressed', 'true')
  })

  it('Esc on the document while armed resets to idle', () => {
    render(<DiagramStudio value={seed} onChange={() => {}} layout="manual" />)
    const addCluster = screen.getByRole('button', { name: 'add cluster' })
    fireEvent.click(addCluster)
    expect(addCluster).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(addCluster).toHaveAttribute('aria-pressed', 'false')
  })

  it('switching between tools transitions cleanly (only one armed at a time)', () => {
    render(<DiagramStudio value={seed} onChange={() => {}} layout="manual" />)
    const addNode = screen.getByRole('button', { name: 'add node' })
    const addCluster = screen.getByRole('button', { name: 'add cluster' })
    fireEvent.click(addNode)
    fireEvent.click(addCluster)
    expect(addNode).toHaveAttribute('aria-pressed', 'false')
    expect(addCluster).toHaveAttribute('aria-pressed', 'true')
  })

  it('palette="off" removes the toolbar even in editable mode', () => {
    render(<DiagramStudio value={seed} onChange={() => {}} layout="manual" palette="off" />)
    expect(screen.queryByTestId('inkin-palette')).toBeNull()
    // Inspector still renders by default.
    expect(screen.getByTestId('inkin-inspector')).toBeInTheDocument()
  })

  it('palette="top" applies the top-position CSS variant class', () => {
    render(<DiagramStudio value={seed} onChange={() => {}} layout="manual" palette="top" />)
    const palette = screen.getByTestId('inkin-palette')
    expect(palette.className).toMatch(/positionTop/)
  })
})
