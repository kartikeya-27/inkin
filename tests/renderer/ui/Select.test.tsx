// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Select, type SelectOption } from '../../../src/renderer/ui/Select'

afterEach(() => {
  cleanup()
})

const SHAPES: SelectOption[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'terminal', label: 'Terminal' },
]

describe('Select', () => {
  it('renders an option per entry', () => {
    render(<Select value="rect" onChange={() => {}} options={SHAPES} ariaLabel="shape" />)
    expect(screen.getByRole('combobox', { name: 'shape' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Rectangle' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Terminal' })).toBeInTheDocument()
  })

  it('reflects the current value', () => {
    render(<Select value="terminal" onChange={() => {}} options={SHAPES} ariaLabel="shape" />)
    const select = screen.getByRole('combobox', { name: 'shape' }) as HTMLSelectElement
    expect(select.value).toBe('terminal')
  })

  it('fires onChange with the new value on selection', () => {
    const onChange = vi.fn()
    render(<Select value="rect" onChange={onChange} options={SHAPES} ariaLabel="shape" />)
    const select = screen.getByRole('combobox', { name: 'shape' }) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'terminal' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('terminal')
  })

  it('renders a hidden placeholder option when provided and value is empty', () => {
    const { container } = render(
      <Select
        value=""
        onChange={() => {}}
        options={SHAPES}
        placeholder="— select —"
        ariaLabel="shape"
      />,
    )
    // The `hidden` attribute removes the option from the a11y tree, so
    // getByRole won't see it even with hidden:true. Query the DOM directly.
    const placeholder = container.querySelector('option[hidden][disabled]')
    expect(placeholder).not.toBeNull()
    expect(placeholder).toHaveTextContent('— select —')
  })

  it('wires id for `<label htmlFor>` association', () => {
    render(
      <>
        <label htmlFor="my-select">Shape</label>
        <Select id="my-select" value="rect" onChange={() => {}} options={SHAPES} />
      </>,
    )
    expect(screen.getByLabelText('Shape')).toBeInTheDocument()
  })

  it('disabled attribute set when disabled', () => {
    render(<Select value="rect" onChange={() => {}} options={SHAPES} ariaLabel="shape" disabled />)
    expect(screen.getByRole('combobox', { name: 'shape' })).toBeDisabled()
  })

  it('respects per-option disabled flag', () => {
    const options: SelectOption[] = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ]
    render(<Select value="a" onChange={() => {}} options={options} ariaLabel="x" />)
    expect(screen.getByRole('option', { name: 'B' })).toBeDisabled()
  })
})
