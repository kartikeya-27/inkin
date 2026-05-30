// @vitest-environment jsdom

/**
 * Phase 14 integration test — two-instance editing isolation through the
 * consumer-visible API.
 *
 * The Phase 3 SelectionSlice unit test already covers per-instance store
 * isolation at the Zustand level. This test goes one level up: with two
 * `<DiagramStudio>` instances mounted on the same page, an edit in
 * instance A must produce exactly ONE `onChange` call (to A's handler)
 * and instance B's handler must stay quiet. The inline-edit flow (Phase 10)
 * is the most JSDOM-friendly consumer-visible action to exercise this with —
 * drag-no-jitter and pixel-level isolation live in the Playwright suite.
 */

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagramStudio } from '../../../src/renderer/DiagramStudio'
import type { Diagram } from '../../../src/schema/types'

afterEach(() => {
  cleanup()
})

const diagram: Diagram = {
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'Hello', shape: 'rect' },
    { id: 'b', label: 'World', shape: 'rect' },
  ],
  edges: [{ from: 'a', to: 'b', label: 'go', style: 'solid' }],
}

describe('two-instance editing isolation', () => {
  it("inline edit in instance A fires only A's onChange, not B's", () => {
    const onChangeA = vi.fn()
    const onChangeB = vi.fn()
    const { container } = render(
      <div>
        <div data-testid="instance-a">
          <DiagramStudio value={diagram} onChange={onChangeA} layout="manual" />
        </div>
        <div data-testid="instance-b">
          <DiagramStudio value={diagram} onChange={onChangeB} layout="manual" />
        </div>
      </div>,
    )

    // Two instances → two static-label slots per node. Find A's first
    // label by scoping to its testid wrapper.
    const instanceA = container.querySelector('[data-testid="instance-a"]')
    expect(instanceA).not.toBeNull()
    if (instanceA === null) return

    const labelInA = Array.from(instanceA.querySelectorAll('div')).find(
      (d) => d.textContent === 'Hello' && d.getAttribute('tabindex') === '-1',
    )
    expect(labelInA).toBeDefined()
    if (labelInA === undefined) return

    fireEvent.doubleClick(labelInA)
    const inputInA = instanceA.querySelector(
      'input[aria-label="label for node a"]',
    ) as HTMLInputElement | null
    expect(inputInA).not.toBeNull()
    if (inputInA === null) return

    fireEvent.change(inputInA, { target: { value: 'Renamed-in-A' } })
    fireEvent.keyDown(inputInA, { key: 'Enter' })

    expect(onChangeA).toHaveBeenCalledTimes(1)
    expect(onChangeA.mock.calls[0]?.[0].nodes[0]?.label).toBe('Renamed-in-A')
    expect(onChangeB).not.toHaveBeenCalled()
  })

  it('starting an inline edit in A does not put B into edit mode', () => {
    const { container } = render(
      <div>
        <div data-testid="instance-a">
          <DiagramStudio value={diagram} onChange={() => {}} layout="manual" />
        </div>
        <div data-testid="instance-b">
          <DiagramStudio value={diagram} onChange={() => {}} layout="manual" />
        </div>
      </div>,
    )
    const instanceA = container.querySelector('[data-testid="instance-a"]')
    const instanceB = container.querySelector('[data-testid="instance-b"]')
    if (instanceA === null || instanceB === null) throw new Error('instances not found')

    // Begin edit in A.
    const labelInA = Array.from(instanceA.querySelectorAll('div')).find(
      (d) => d.textContent === 'Hello' && d.getAttribute('tabindex') === '-1',
    )
    if (labelInA === undefined) throw new Error('label not found in A')
    fireEvent.doubleClick(labelInA)

    // A now has an input.
    expect(instanceA.querySelector('input[aria-label="label for node a"]')).not.toBeNull()
    // B does NOT — its EditSlice is a separate store.
    expect(instanceB.querySelector('input')).toBeNull()
  })

  it('two instances render without StrictMode-style double-mount sharing state', () => {
    // Defensive: render twice in quick succession to surface any module-
    // scoped state leaks (e.g., if InkinStoreProvider accidentally used a
    // module singleton). Each instance still owns its own provider.
    const onChange = vi.fn()
    const { rerender, container } = render(
      <>
        <DiagramStudio value={diagram} onChange={onChange} layout="manual" />
        <DiagramStudio value={diagram} onChange={onChange} layout="manual" />
      </>,
    )
    rerender(
      <>
        <DiagramStudio value={diagram} onChange={onChange} layout="manual" />
        <DiagramStudio value={diagram} onChange={onChange} layout="manual" />
      </>,
    )

    // Two distinct wrapper elements remain.
    const wrappers = container.querySelectorAll('[data-inkin-theme]')
    expect(wrappers.length).toBe(2)
    expect(onChange).not.toHaveBeenCalled()
  })
})
