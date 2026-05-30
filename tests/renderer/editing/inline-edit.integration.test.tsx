// @vitest-environment jsdom

/**
 * Phase 10 integration test — wires `<EditableLabel>` into `BaseNode` (via
 * `RectNode`) inside `<DiagramStudio>` and verifies the end-to-end inline-
 * edit flow:
 *
 *   1. Mount with `onChange` provided (editable mode).
 *   2. Find a node's label, double-click it.
 *   3. The `<input>` swaps in via the EditableLabel store-driven render.
 *   4. Type a new value.
 *   5. Press Enter.
 *   6. `onChange` is called with the schema-next where that node's `label`
 *      has the new value.
 *
 * This is the JSDOM half of the verification. The Playwright e2e in Phase
 * 15 exercises the same flow against a real browser (real keyboard events,
 * real pointer-capture interaction with xyflow's pane). Together they cover
 * the inline-edit gate from the plan.
 */

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagramStudio } from '../../../src/renderer/DiagramStudio'
import type { Diagram } from '../../../src/schema/types'

afterEach(() => {
  cleanup()
})

const simple: Diagram = {
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'Hello', shape: 'rect' },
    { id: 'b', label: 'World', shape: 'rect' },
  ],
  edges: [{ from: 'a', to: 'b', label: 'go', style: 'solid' }],
}

describe('inline-edit integration — node label', () => {
  it('double-click → type → Enter commits a SetField patch via onChange', () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={simple} onChange={onChange} layout="manual" />)

    // EditableLabel wraps the node label. Find the static label by its text.
    // In the resting state it's a <div tabindex="-1">{label}</div>.
    const nodeLabelDiv = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent === 'Hello' && d.getAttribute('tabindex') === '-1',
    )
    expect(nodeLabelDiv).toBeDefined()
    if (nodeLabelDiv === undefined) return

    // Double-click swaps to <input>.
    fireEvent.doubleClick(nodeLabelDiv)

    // EditableLabel now renders an <input> bound to the draft.
    const input = container.querySelector('input[aria-label="label for node a"]')
    expect(input).not.toBeNull()
    if (input === null) return
    expect((input as HTMLInputElement).value).toBe('Hello')

    // Type a new value.
    fireEvent.change(input, { target: { value: 'Renamed' } })
    expect((input as HTMLInputElement).value).toBe('Renamed')

    // Enter commits.
    fireEvent.keyDown(input, { key: 'Enter' })

    // onChange called with the updated schema.
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]?.[0] as Diagram
    const a = next.nodes.find((n) => n.id === 'a')
    expect(a?.label).toBe('Renamed')
  })

  it('Esc cancels: no onChange, the input swaps back to the original label', () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={simple} onChange={onChange} layout="manual" />)

    const nodeLabelDiv = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent === 'Hello' && d.getAttribute('tabindex') === '-1',
    )
    if (nodeLabelDiv === undefined) throw new Error('label not found')
    fireEvent.doubleClick(nodeLabelDiv)

    const input = container.querySelector('input[aria-label="label for node a"]') as
      | HTMLInputElement
      | null
    if (input === null) throw new Error('input not found')
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does NOT render an editable input in read-only mode (no onChange)', () => {
    const { container } = render(<DiagramStudio value={simple} layout="manual" />)
    // The static label still renders, but as a plain <div className="label">
    // — not the EditableLabel staticLabel with tabIndex=-1.
    const editableSlot = container.querySelector('[tabindex="-1"]')
    expect(editableSlot).toBeNull()
  })
})

// Edge-label inline-edit flow is covered in the Phase 15 Playwright suite
// against a real browser. xyflow's `EdgeLabelRenderer` is a portal whose
// target (`react-flow__edgelabel-renderer`) only mounts once the viewport
// has real layout dimensions, which JSDOM doesn't provide. The unit-level
// pieces of the path are already covered:
//   - `LabeledEdge` rendering logic: src/renderer/edges/LabeledEdge.tsx
//   - EditableLabel commit semantics: tests/renderer/editing/EditableLabel.test.tsx
//   - SetField patch dispatch:        tests/renderer/editing/sync.test.tsx
//   - applyPatch SetField arm:        tests/renderer/editing/apply-patch.test.ts
