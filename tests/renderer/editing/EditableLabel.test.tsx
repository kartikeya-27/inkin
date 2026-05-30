// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditableLabel } from '../../../src/renderer/editing/EditableLabel'

/**
 * Phase 9 verification gate:
 *   - resting state renders <div>{value}</div>; double-click → onStartEdit
 *   - editing state renders <input> with draftText bound; onChange dispatches
 *   - Enter → onCommit(draftText), no double-fire via the subsequent blur
 *   - Esc → onCancel, no onCommit
 *   - blur (without Enter) → onCommit(draftText)
 *   - input carries the nodrag + nopan classes so xyflow's pointer capture
 *     doesn't steal focus
 */

afterEach(() => {
  cleanup()
})

function setup(overrides: Partial<React.ComponentProps<typeof EditableLabel>> = {}) {
  const props = {
    value: 'Hello',
    draftText: 'Hello',
    isEditing: false,
    onStartEdit: vi.fn(),
    onDraftChange: vi.fn(),
    onCommit: vi.fn(),
    onCancel: vi.fn(),
    ariaLabel: 'test label',
    ...overrides,
  }
  const utils = render(<EditableLabel {...props} />)
  return { ...utils, props }
}

describe('<EditableLabel> — resting state', () => {
  it('renders a div with the value text when not editing', () => {
    const { container } = setup({ value: 'Stage 1' })
    const div = container.querySelector('div')
    expect(div).not.toBeNull()
    expect(div?.textContent).toBe('Stage 1')
  })

  it('fires onStartEdit on double-click', () => {
    const onStartEdit = vi.fn()
    const { container } = setup({ onStartEdit })
    const div = container.querySelector('div')
    if (div === null) throw new Error('static label not rendered')
    fireEvent.doubleClick(div)
    expect(onStartEdit).toHaveBeenCalledTimes(1)
  })

  it('does NOT render an input when not editing', () => {
    const { container } = setup()
    expect(container.querySelector('input')).toBeNull()
  })
})

describe('<EditableLabel> — editing state', () => {
  it('renders an <input> bound to draftText', () => {
    const { container } = setup({ isEditing: true, draftText: 'Stage 2' })
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
    expect(input?.value).toBe('Stage 2')
  })

  it('does NOT render the resting <div> when editing', () => {
    const { container } = setup({ isEditing: true })
    // The only element rendered is the input.
    expect(container.querySelector('div')).toBeNull()
  })

  it('carries the nodrag + nopan classes so xyflow does not capture pointers', () => {
    const { container } = setup({ isEditing: true })
    const input = container.querySelector('input')
    expect(input?.className).toContain('nodrag')
    expect(input?.className).toContain('nopan')
  })

  it('fires onDraftChange on every keystroke', () => {
    const onDraftChange = vi.fn()
    const { container } = setup({ isEditing: true, onDraftChange })
    const input = container.querySelector('input')
    if (input === null) throw new Error('input not rendered')
    fireEvent.change(input, { target: { value: 'H' } })
    fireEvent.change(input, { target: { value: 'He' } })
    fireEvent.change(input, { target: { value: 'Hel' } })
    expect(onDraftChange).toHaveBeenCalledTimes(3)
    expect(onDraftChange).toHaveBeenLastCalledWith('Hel')
  })

  it('auto-focuses and selects the existing draft text on mount', () => {
    const { container } = setup({ isEditing: true, draftText: 'Selectable' })
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
    expect(document.activeElement).toBe(input)
    expect(input?.selectionStart).toBe(0)
    expect(input?.selectionEnd).toBe(10)
  })
})

describe('<EditableLabel> — commit semantics', () => {
  it('Enter fires onCommit with the current draftText', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    const { container } = setup({
      isEditing: true,
      draftText: 'committed',
      onCommit,
      onCancel,
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('input not rendered')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('committed')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Esc fires onCancel and does NOT fire onCommit', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    const { container } = setup({
      isEditing: true,
      draftText: 'discarded',
      onCommit,
      onCancel,
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('input not rendered')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('blur (without Enter) fires onCommit with the current draftText', () => {
    const onCommit = vi.fn()
    const { container } = setup({
      isEditing: true,
      draftText: 'committed-via-blur',
      onCommit,
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('input not rendered')
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('committed-via-blur')
  })

  it('Enter does NOT double-fire onCommit when followed by blur', () => {
    const onCommit = vi.fn()
    const { container } = setup({
      isEditing: true,
      draftText: 'once',
      onCommit,
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('input not rendered')
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('allows committing an empty string (intentional blank label)', () => {
    const onCommit = vi.fn()
    const { container } = setup({
      isEditing: true,
      draftText: '',
      onCommit,
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('input not rendered')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith('')
  })

  it('Delete / Backspace inside the input do NOT propagate (xyflow does not delete node)', () => {
    const onCommit = vi.fn()
    const { container } = setup({
      isEditing: true,
      draftText: 'Hello',
      onCommit,
    })
    const input = container.querySelector('input')
    if (input === null) throw new Error('input not rendered')
    // The actual deletion of one character is handled by the input element
    // itself; we just assert that the event's bubbling is stopped so
    // xyflow's deleteKeyCode handler in the parent ReactFlow can't fire.
    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })
    const stopSpy = vi.spyOn(event, 'stopPropagation')
    input.dispatchEvent(event)
    expect(stopSpy).toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled() // Delete is not a commit key
  })
})

describe('<EditableLabel> — accessibility surface', () => {
  it('sets aria-label on the input', () => {
    const { container } = setup({ isEditing: true, ariaLabel: 'node label for a' })
    expect(container.querySelector('input')?.getAttribute('aria-label')).toBe(
      'node label for a',
    )
  })

  it('makes the static label programmatically focusable (tabIndex=-1)', () => {
    const { container } = setup()
    const div = container.querySelector('div')
    expect(div?.getAttribute('tabindex')).toBe('-1')
  })
})
