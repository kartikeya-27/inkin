// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '../../../src/renderer/ui/Button'

afterEach(() => {
  cleanup()
})

describe('Button — defaults and rendering', () => {
  it('renders children verbatim', () => {
    render(<Button>Add Node</Button>)
    expect(screen.getByRole('button', { name: 'Add Node' })).toBeInTheDocument()
  })

  it('defaults to type="button" to prevent accidental form submission', () => {
    render(<Button>x</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('honors an explicit type override', () => {
    render(<Button type="submit">submit</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('passes through aria-label and aria-pressed', () => {
    render(
      <Button aria-label="Add node tool" aria-pressed={true}>
        +
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Add node tool' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Button — click activation', () => {
  it('fires onClick on mouse click', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>x</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        x
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not throw when onClick is omitted', () => {
    render(<Button>x</Button>)
    fireEvent.click(screen.getByRole('button'))
    // No assertion needed — absence of error is the test.
  })
})
