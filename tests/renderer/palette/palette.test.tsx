// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Palette } from '../../../src/renderer/palette/Palette'
import { InkinStoreProvider, useEditorStoreApi } from '../../../src/renderer/store'

afterEach(() => {
  cleanup()
})

/**
 * Palette tests. Cover:
 *   - Button click → enters placement mode + aria-pressed flips.
 *   - Same button clicked again → toggles back to idle.
 *   - Two tools: clicking the other one switches mode (origin cleared).
 *   - Esc resets to idle.
 *   - visibilitychange resets to idle when page becomes hidden.
 *   - Position class respects prop.
 */

function StoreSelector({
  select,
}: {
  select: (api: ReturnType<typeof useEditorStoreApi>) => void
}) {
  const api = useEditorStoreApi()
  select(api)
  return null
}

function renderPalette(
  onStore: (api: ReturnType<typeof useEditorStoreApi>) => void,
  options?: { position?: 'left' | 'top' },
) {
  return render(
    <InkinStoreProvider>
      <StoreSelector select={onStore} />
      <Palette {...(options?.position !== undefined && { position: options.position })} />
    </InkinStoreProvider>,
  )
}

describe('Palette — rendering', () => {
  it('renders two tool buttons', () => {
    renderPalette(() => {})
    expect(screen.getByRole('button', { name: 'add node' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'add cluster' })).toBeInTheDocument()
  })

  it('starts with both buttons aria-pressed=false (idle mode)', () => {
    renderPalette(() => {})
    expect(screen.getByRole('button', { name: 'add node' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'add cluster' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('defaults to position="left" CSS class', () => {
    renderPalette(() => {})
    const panel = screen.getByTestId('inkin-palette')
    expect(panel.className).toMatch(/positionLeft/)
  })

  it('honors position="top"', () => {
    renderPalette(() => {}, { position: 'top' })
    const panel = screen.getByTestId('inkin-palette')
    expect(panel.className).toMatch(/positionTop/)
  })
})

describe('Palette — mode toggle', () => {
  it('clicking "add node" enters placing-node + flips aria-pressed', () => {
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPalette((a) => {
      api = a
    })
    const button = screen.getByRole('button', { name: 'add node' })
    fireEvent.click(button)
    expect(api.getState().mode).toBe('placing-node')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('clicking the same tool again toggles back to idle', () => {
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPalette((a) => {
      api = a
    })
    const button = screen.getByRole('button', { name: 'add node' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(api.getState().mode).toBe('idle')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking the other tool switches mode (no need to exit first)', () => {
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPalette((a) => {
      api = a
    })
    fireEvent.click(screen.getByRole('button', { name: 'add node' }))
    expect(api.getState().mode).toBe('placing-node')
    fireEvent.click(screen.getByRole('button', { name: 'add cluster' }))
    expect(api.getState().mode).toBe('placing-cluster')
    expect(screen.getByRole('button', { name: 'add cluster' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'add node' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('Palette — Esc resets to idle', () => {
  it('Escape keydown on the document exits placement mode', () => {
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPalette((a) => {
      api = a
    })
    fireEvent.click(screen.getByRole('button', { name: 'add node' }))
    expect(api.getState().mode).toBe('placing-node')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(api.getState().mode).toBe('idle')
  })

  it('Escape in idle mode is a no-op (does not flip subscribers)', () => {
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPalette((a) => {
      api = a
    })
    // Use a probe subscriber to count emissions.
    let calls = 0
    api.subscribe(() => {
      calls += 1
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(calls).toBe(0)
  })
})

describe('Palette — visibilitychange resets to idle', () => {
  // Setting `document.hidden` via defineProperty needs an explicit
  // teardown — otherwise the mocked descriptor leaks to subsequent
  // tests. `delete document.hidden` falls back to the original getter.
  function withDocumentHidden(hidden: boolean, fn: () => void): void {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
    try {
      fn()
    } finally {
      // Remove the own-property override; JSDOM's prototype getter
      // (which reports false by default) takes over again.
      delete (document as { hidden?: boolean }).hidden
    }
  }

  it('document hidden → mode resets to idle when in a placement mode', () => {
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPalette((a) => {
      api = a
    })
    fireEvent.click(screen.getByRole('button', { name: 'add cluster' }))
    expect(api.getState().mode).toBe('placing-cluster')

    withDocumentHidden(true, () => {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
    })
    expect(api.getState().mode).toBe('idle')
  })

  it('document visible (hidden=false) does NOT exit mode', () => {
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPalette((a) => {
      api = a
    })
    fireEvent.click(screen.getByRole('button', { name: 'add node' }))

    // Default `document.hidden` is false in JSDOM; the listener should
    // bail without reset.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(api.getState().mode).toBe('placing-node')
  })
})
