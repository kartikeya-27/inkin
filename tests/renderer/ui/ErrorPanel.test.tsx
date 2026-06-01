// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorPanel } from '../../../src/renderer/ui/ErrorPanel'

afterEach(() => {
  cleanup()
})

describe('ErrorPanel', () => {
  it('renders the message inside a role="alert" container', () => {
    render(<ErrorPanel message="Validation failed: duplicate id 'a'" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Validation failed: duplicate id 'a'")
  })

  it('does not render a dismiss button when onDismiss is omitted', () => {
    render(<ErrorPanel message="boom" />)
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })

  it('renders a dismiss button when onDismiss is provided', () => {
    render(<ErrorPanel message="boom" onDismiss={() => {}} />)
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('fires onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorPanel message="boom" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
