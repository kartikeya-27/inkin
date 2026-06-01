import { useEffect } from 'react'
import { cn } from '../lib/cn'
import { useEditorStore, useEditorStoreApi } from '../store'
import type { PlacementMode } from '../store/interaction'
import { Button } from '../ui/Button'
import styles from './Palette.module.css'

/**
 * Creation toolbar. Mounted by `DiagramStudio` in editable mode when the
 * `palette` prop is not `'off'` (default `'left'`).
 *
 * Two tool buttons toggle between `idle` and their respective placing
 * mode via `InteractionSlice.enterPlacementMode` / `exitPlacementMode`.
 * `aria-pressed` mirrors the active mode so screen readers know which
 * tool is currently armed.
 *
 * Two document-level listeners reset to `idle` defensively:
 *   - `Escape` keydown — user cancels mid-placement.
 *   - `visibilitychange` (page hidden) — user tabbed away with a tool
 *     armed; we don't want them to come back and drop an unexpected
 *     node on the next click.
 *
 * Listeners read live state via `useEditorStoreApi().getState()` rather
 * than the React-subscribed `mode` value, so they don't re-bind on every
 * mode flip. One register on mount, one cleanup on unmount.
 */

export type PalettePosition = 'left' | 'top'

export interface PaletteProps {
  /** Which edge of the canvas to dock against. Default `'left'`. */
  readonly position?: PalettePosition
  readonly className?: string | undefined
}

export function Palette({ position = 'left', className }: PaletteProps) {
  const mode = useEditorStore((s) => s.mode)
  const storeApi = useEditorStoreApi()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const state = storeApi.getState()
      if (state.mode === 'idle') return
      event.preventDefault()
      state.exitPlacementMode()
    }
    const onVisibilityChange = () => {
      if (!document.hidden) return
      const state = storeApi.getState()
      if (state.mode === 'idle') return
      state.exitPlacementMode()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [storeApi])

  const toggle = (target: PlacementMode) => {
    const state = storeApi.getState()
    if (state.mode === target) {
      state.exitPlacementMode()
      return
    }
    state.enterPlacementMode(target)
  }

  return (
    <aside
      className={cn(
        styles.root,
        position === 'left' ? styles.positionLeft : styles.positionTop,
        className,
      )}
      aria-label="Palette"
      data-testid="inkin-palette"
    >
      <Button
        aria-label="add node"
        aria-pressed={mode === 'placing-node'}
        onClick={() => toggle('placing-node')}
        size="sm"
        className={styles.tool}
      >
        + Node
      </Button>
      <Button
        aria-label="add cluster"
        aria-pressed={mode === 'placing-cluster'}
        onClick={() => toggle('placing-cluster')}
        size="sm"
        className={styles.tool}
      >
        + Cluster
      </Button>
    </aside>
  )
}
