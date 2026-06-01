// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Field } from '../../../src/renderer/ui/Field'
import { TextInput } from '../../../src/renderer/ui/TextInput'

afterEach(() => {
  cleanup()
})

describe('Field', () => {
  it('renders the label text', () => {
    render(
      <Field label="Shape" htmlFor="x">
        <input id="x" />
      </Field>,
    )
    expect(screen.getByText('Shape')).toBeInTheDocument()
  })

  it('wires htmlFor → child input id for label association', () => {
    // testing-library getByLabelText only succeeds when the label and
    // control are associated — this is the wiring contract.
    render(
      <Field label="My Label" htmlFor="my-field">
        <TextInput id="my-field" value="hi" onCommit={() => {}} />
      </Field>,
    )
    expect(screen.getByLabelText('My Label')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <Field label="Id" htmlFor="x" description="must be unique across the diagram">
        <input id="x" />
      </Field>,
    )
    expect(screen.getByText('must be unique across the diagram')).toBeInTheDocument()
  })

  it('omits description when not provided', () => {
    const { container } = render(
      <Field label="x" htmlFor="x">
        <input id="x" />
      </Field>,
    )
    // No description text means just the label text under the labelRow.
    expect(container.querySelectorAll('div')).toHaveLength(3) // root, labelRow, control
  })

  it('renders hint slot when provided', () => {
    render(
      <Field label="x" htmlFor="x" hint={<span>?</span>}>
        <input id="x" />
      </Field>,
    )
    expect(screen.getByText('?')).toBeInTheDocument()
  })
})
