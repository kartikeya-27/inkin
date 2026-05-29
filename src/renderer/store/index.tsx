import { createContext, type ReactNode, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createEditSlice, type EditSlice } from './edit'
import { createInteractionSlice, type InteractionSlice } from './interaction'
import { createSelectionSlice, type SelectionSlice } from './selection'

/**
 * Zustand store for inkin's editor-transient state — selection, interaction
 * mode, inline-edit state. Per-`<DiagramStudio>`-instance, NOT a global
 * singleton: mounting two `<DiagramStudio>` components on the same page
 * (e.g. side-by-side diagrams in a dashboard) gives each its own isolated
 * store. State in one never leaks to the other.
 *
 * In 0.2.0 (read-only) every slice is empty — the store carries no data.
 * The scaffolding exists so 0.3.0's editing release can fill the slices
 * without re-architecting how the store is mounted / consumed.
 *
 * Architecture follows the canonical Zustand-with-Context pattern (the same
 * one xyflow uses internally for its `ReactFlowProvider`):
 *
 *   1. createInkinStore() — factory; called once per mount via useRef so
 *      React StrictMode's double-render doesn't create two stores.
 *   2. <InkinStoreProvider> — wraps the rendered tree with a React Context
 *      that carries the store instance.
 *   3. useEditorStore(selector) — scoped hook that reads the store via the
 *      provider's Context; throws clearly if used outside DiagramStudio.
 */

export type EditorStore = SelectionSlice & InteractionSlice & EditSlice
export type EditorStoreInstance = ReturnType<typeof createInkinStore>

export function createInkinStore() {
  return createStore<EditorStore>(() => ({
    ...createSelectionSlice(),
    ...createInteractionSlice(),
    ...createEditSlice(),
  }))
}

const InkinStoreContext = createContext<EditorStoreInstance | null>(null)

export interface InkinStoreProviderProps {
  readonly children: ReactNode
}

export function InkinStoreProvider({ children }: InkinStoreProviderProps) {
  const storeRef = useRef<EditorStoreInstance | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createInkinStore()
  }
  return (
    <InkinStoreContext.Provider value={storeRef.current}>{children}</InkinStoreContext.Provider>
  )
}

/**
 * Read a slice of the per-instance editor store.
 *
 * MUST be called from inside the React tree rendered by `<DiagramStudio>`.
 * The DiagramStudio component mounts the `<InkinStoreProvider>` automatically;
 * any descendant component can subscribe via this hook.
 *
 * Selective subscription is the point: only components that read a slice
 * re-render when it changes. `useEditorStore(s => s.someField)` returns
 * `someField` and re-renders the calling component only when `someField`
 * changes, not on every store mutation.
 */
export function useEditorStore<T>(selector: (state: EditorStore) => T): T {
  const store = useContext(InkinStoreContext)
  if (store === null) {
    throw new Error(
      'useEditorStore must be used inside <DiagramStudio>. ' +
        'The hook reads from the InkinStoreProvider that DiagramStudio mounts.',
    )
  }
  return useStore(store, selector)
}

// Re-export slice types so consumers and future components can reference them.
export type { EditSlice } from './edit'
export type { InteractionSlice } from './interaction'
export type { SelectionSlice } from './selection'
