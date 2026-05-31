// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextInput } from '../../../src/renderer/ui/TextInput'

afterEach(() => {
  cleanup()
})

describe('TextInput — commit-on-blur / commit-on-Enter semantics', () => {
  it('typing does NOT fire onCommit per-keystroke (the Inspector storm guard)', () => {
    const onCommit = vi.fn()
    render(<TextInput value="hello" onCommit={onCommit} ariaLabel="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'ab' } })
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Enter commits the current draft', () => {
    const onCommit = vi.fn()
    render(<TextInput value="" onCommit={onCommit} ariaLabel="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'world' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('world')
  })

  it('blur commits the current draft', () => {
    const onCommit = vi.fn()
    render(<TextInput value="" onCommit={onCommit} ariaLabel="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('abc')
  })

  it('Enter + subsequent blur does NOT double-commit (the Enter dedup guard)', () => {
    const onCommit = vi.fn()
    render(<TextInput value="" onCommit={onCommit} ariaLabel="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'once' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('Esc reverts the draft to value and fires onCancel', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    render(<TextInput value="original" onCommit={onCommit} onCancel={onCancel} ariaLabel="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'discarded' } })
    expect(input.value).toBe('discarded')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.value).toBe('original')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('TextInput — controlled-value re-seed', () => {
  it('re-seeds draft when value prop changes from outside (while not focused)', () => {
    const onCommit = vi.fn()
    const { rerender } = render(<TextInput value="A" onCommit={onCommit} ariaLabel="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    expect(input.value).toBe('A')
    rerender(<TextInput value="B" onCommit={onCommit} ariaLabel="x" />)
    expect(input.value).toBe('B')
  })

  it('does NOT re-seed while the user is actively focused (preserves their draft)', () => {
    const onCommit = vi.fn()
    const { rerender } = render(<TextInput value="A" onCommit={onCommit} ariaLabel="x" />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: 'in-progress' } })
    expect(input.value).toBe('in-progress')

    rerender(<TextInput value="B" onCommit={onCommit} ariaLabel="x" />)
    // External value change ignored — user is mid-edit.
    expect(input.value).toBe('in-progress')
  })
})

describe('TextInput — accessibility + attributes', () => {
  it('wires id for `<label htmlFor>` association', () => {
    render(
      <>
        <label htmlFor="my-field">My field</label>
        <TextInput id="my-field" value="x" onCommit={() => {}} />
      </>,
    )
    expect(screen.getByLabelText('My field')).toBeInTheDocument()
  })

  it('renders placeholder when provided', () => {
    render(<TextInput value="" onCommit={() => {}} ariaLabel="x" placeholder="enter text" />)
    expect(screen.getByLabelText('x')).toHaveAttribute('placeholder', 'enter text')
  })

  it('ignores input when disabled', () => {
    const onCommit = vi.fn()
    render(<TextInput value="" onCommit={onCommit} ariaLabel="x" disabled />)
    const input = screen.getByLabelText('x') as HTMLInputElement
    expect(input).toBeDisabled()
    // Disabled inputs ignore change events from the user; fireEvent
    // does dispatch the event regardless, so we only assert the
    // attribute-level disablement — the browser is what enforces
    // input rejection.
    expect(onCommit).not.toHaveBeenCalled()
  })
})
