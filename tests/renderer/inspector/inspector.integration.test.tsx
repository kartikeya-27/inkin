// @vitest-environment jsdom

/**
 * Phase 12 integration test — mount the full `<DiagramStudio>` in
 * editable mode, drive selection by clicking a node in the rendered
 * canvas, then exercise the Inspector form fields through the DOM and
 * assert the dispatched `SetField` patches flow through `onChange`.
 *
 * Strategy:
 *   - The Inspector is now mounted by DiagramStudio in editable mode
 *     (Phase 8 wiring). No backdoor providers, no test-only mounting —
 *     the test goes through the same React tree consumers see.
 *   - Selection happens via clicking on the `.react-flow__node`
 *     wrapper element xyflow renders. That fires xyflow's internal
 *     selection update, which our `useFlowSync` mirrors into the
 *     SelectionSlice, which Inspector subscribes to.
 *   - Form field interactions use fireEvent (matching the project's
 *     existing inline-edit integration test pattern).
 *
 * What this DOESN'T cover (deferred to Phase 13 Playwright):
 *   - Pixel-level layout of the panel.
 *   - Drag-to-select / marquee-select multi-select. The store-side
 *     selection wiring works in JSDOM but real marquee needs measured
 *     layout.
 */

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiagramStudio } from '../../../src/renderer/DiagramStudio'
import type { Diagram } from '../../../src/schema/types'

afterEach(() => {
  cleanup()
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const seed: Diagram = {
  schemaVersion: 1,
  clusters: [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
  ],
  nodes: [
    { id: 'a', label: 'Alpha', shape: 'rect', cluster: 'left' },
    { id: 'b', label: 'Beta', shape: 'rect' },
  ],
  edges: [{ from: 'a', to: 'b', label: 'go', style: 'solid' }],
}

function findNodeWrapper(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`.react-flow__node[data-id="${id}"]`)
  if (el === null) throw new Error(`node wrapper not found: ${id}`)
  return el as HTMLElement
}

function findInspector(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="inkin-inspector"]')
  if (el === null) throw new Error('inspector not mounted')
  return el as HTMLElement
}

function findFieldByLabel(inspector: HTMLElement, label: string): HTMLElement {
  // Inspector uses <label htmlFor={id}> + matching control id. Find the
  // label, follow its `for` attribute to the control element.
  const labelEl = Array.from(inspector.querySelectorAll('label')).find(
    (l) => l.textContent === label,
  )
  if (labelEl === undefined) throw new Error(`field label not found: ${label}`)
  const forAttr = labelEl.getAttribute('for')
  if (forAttr === null) throw new Error(`label ${label} has no htmlFor`)
  const control = inspector.querySelector(`#${CSS.escape(forAttr)}`)
  if (control === null) throw new Error(`control ${forAttr} not found`)
  return control as HTMLElement
}

describe('Inspector integration — single-node editing', () => {
  it("clicking a node mounts NodeFields populated with that node's values", () => {
    const { container } = render(<DiagramStudio value={seed} onChange={() => {}} layout="manual" />)

    fireEvent.click(findNodeWrapper(container, 'a'))

    const inspector = findInspector(container)
    // Header reflects single-node selection.
    expect(inspector.textContent).toContain('Node')
    // Each field renders with the node's current value.
    expect((findFieldByLabel(inspector, 'Label') as HTMLInputElement).value).toBe('Alpha')
    expect((findFieldByLabel(inspector, 'Shape') as HTMLSelectElement).value).toBe('rect')
    expect((findFieldByLabel(inspector, 'Cluster') as HTMLSelectElement).value).toBe('left')
  })

  it('changing the Shape Select dispatches SetField{node-shape} via onChange', async () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={seed} onChange={onChange} layout="manual" />)

    fireEvent.click(findNodeWrapper(container, 'a'))
    const shapeSelect = findFieldByLabel(findInspector(container), 'Shape') as HTMLSelectElement
    fireEvent.change(shapeSelect, { target: { value: 'terminal' } })
    await flush()

    expect(onChange).toHaveBeenCalled()
    const next = onChange.mock.calls.at(-1)?.[0] as Diagram
    expect(next.nodes.find((n) => n.id === 'a')?.shape).toBe('terminal')
  })

  it('changing the Cluster Select dispatches AssignCluster via onChange', async () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={seed} onChange={onChange} layout="manual" />)

    fireEvent.click(findNodeWrapper(container, 'a'))
    const clusterSelect = findFieldByLabel(findInspector(container), 'Cluster') as HTMLSelectElement
    fireEvent.change(clusterSelect, { target: { value: 'right' } })
    await flush()

    const next = onChange.mock.calls.at(-1)?.[0] as Diagram
    expect(next.nodes.find((n) => n.id === 'a')?.cluster).toBe('right')
  })

  it('selecting the "— none —" cluster unassigns (strips the cluster field)', async () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={seed} onChange={onChange} layout="manual" />)

    fireEvent.click(findNodeWrapper(container, 'a'))
    const clusterSelect = findFieldByLabel(findInspector(container), 'Cluster') as HTMLSelectElement
    fireEvent.change(clusterSelect, { target: { value: '' } })
    await flush()

    const next = onChange.mock.calls.at(-1)?.[0] as Diagram
    const a = next.nodes.find((n) => n.id === 'a')
    expect(a).toBeDefined()
    expect(a).not.toHaveProperty('cluster')
  })

  it('label commit-on-Enter dispatches SetField{node-label}', async () => {
    const onChange = vi.fn()
    const { container } = render(<DiagramStudio value={seed} onChange={onChange} layout="manual" />)

    fireEvent.click(findNodeWrapper(container, 'a'))
    const labelInput = findFieldByLabel(findInspector(container), 'Label') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: 'Renamed via inspector' } })
    // Keystrokes don't dispatch — Enter does.
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(labelInput, { key: 'Enter' })
    await flush()

    const next = onChange.mock.calls.at(-1)?.[0] as Diagram
    expect(next.nodes.find((n) => n.id === 'a')?.label).toBe('Renamed via inspector')
  })
})

describe('Inspector integration — read-only mode safety', () => {
  it('Inspector is not in the DOM when DiagramStudio is read-only', () => {
    const { container } = render(<DiagramStudio value={seed} layout="manual" />)
    expect(container.querySelector('[data-testid="inkin-inspector"]')).toBeNull()
  })
})
