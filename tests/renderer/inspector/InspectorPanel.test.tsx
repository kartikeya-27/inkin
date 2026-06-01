// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorActions } from '../../../src/renderer/editing/EditorActionsContext'
import { EditorActionsProvider } from '../../../src/renderer/editing/EditorActionsContext'
import { ClusterFields } from '../../../src/renderer/inspector/ClusterFields'
import { EdgeFields } from '../../../src/renderer/inspector/EdgeFields'
import { EmptyState } from '../../../src/renderer/inspector/EmptyState'
import { InspectorPanel } from '../../../src/renderer/inspector/InspectorPanel'
import { NodeFields } from '../../../src/renderer/inspector/NodeFields'
import { InkinStoreProvider, useEditorStoreApi } from '../../../src/renderer/store'
import { parse } from '../../../src/schema'

afterEach(() => {
  cleanup()
})

/**
 * Inspector tests. Three layers:
 *   1. Per-Fields-component direct render with mock actions. Exercises
 *      single + multi-select branching, commit dispatch, multi-value
 *      placeholder rendering.
 *   2. InspectorPanel routing — set selection via the store, assert the
 *      right Fields sub-component renders + the header title reflects
 *      the kind + count.
 *   3. Read-only mode (no EditorActionsProvider) renders nothing.
 */

function makeActions(): EditorActions {
  return {
    dispatchSetField: vi.fn(),
    dispatchAddNode: vi.fn(),
    dispatchAddCluster: vi.fn(),
    dispatchAssignCluster: vi.fn(),
  }
}

/** Mock provider for tests; supplies the same EditorActions to all children. */
function MockActionsProvider({
  actions,
  children,
}: {
  actions: EditorActions
  children: ReactNode
}) {
  return (
    <EditorActionsProvider
      dispatchSetField={actions.dispatchSetField}
      dispatchAddNode={actions.dispatchAddNode}
      dispatchAddCluster={actions.dispatchAddCluster}
      dispatchAssignCluster={actions.dispatchAssignCluster}
    >
      {children}
    </EditorActionsProvider>
  )
}

const triangle = parse({
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'A', sublabel: 'first', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', shape: 'terminal', position: { x: 200, y: 0 } },
    { id: 'c', label: 'C', position: { x: 100, y: 150 } },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'ab', style: 'dashed' },
    { from: 'b', to: 'c', label: 'bc' },
  ],
})

const clustered = parse({
  schemaVersion: 1,
  clusters: [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
  ],
  nodes: [
    { id: 'a', label: 'A', cluster: 'left', position: { x: 0, y: 0 } },
    { id: 'b', label: 'B', cluster: 'right', position: { x: 200, y: 0 } },
  ],
  edges: [],
})

// --- NodeFields direct tests -------------------------------------------------

describe('NodeFields — single selection', () => {
  it('renders the node label, sublabel, shape, and cluster pickers', () => {
    const actions = makeActions()
    render(<NodeFields nodes={[triangle.nodes[0]!]} clusters={[]} actions={actions} />)
    expect(screen.getByLabelText('Label')).toBeInTheDocument()
    expect(screen.getByLabelText('Sublabel')).toBeInTheDocument()
    expect(screen.getByLabelText('Shape')).toBeInTheDocument()
    expect(screen.getByLabelText('Cluster')).toBeInTheDocument()
  })

  it("shows the node's current label in the input", () => {
    const actions = makeActions()
    render(<NodeFields nodes={[triangle.nodes[0]!]} clusters={[]} actions={actions} />)
    const labelInput = screen.getByLabelText('Label') as HTMLInputElement
    expect(labelInput.value).toBe('A')
  })

  it('dispatches SetField{node-label} on label commit', () => {
    const actions = makeActions()
    render(<NodeFields nodes={[triangle.nodes[0]!]} clusters={[]} actions={actions} />)
    const labelInput = screen.getByLabelText('Label') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: 'Renamed' } })
    fireEvent.keyDown(labelInput, { key: 'Enter' })
    expect(actions.dispatchSetField).toHaveBeenCalledWith(
      { kind: 'node-label', id: 'a' },
      'Renamed',
    )
  })

  it('dispatches SetField{node-shape} on shape change', () => {
    const actions = makeActions()
    render(<NodeFields nodes={[triangle.nodes[0]!]} clusters={[]} actions={actions} />)
    const shapeSelect = screen.getByLabelText('Shape') as HTMLSelectElement
    fireEvent.change(shapeSelect, { target: { value: 'terminal' } })
    expect(actions.dispatchSetField).toHaveBeenCalledWith(
      { kind: 'node-shape', id: 'a' },
      'terminal',
    )
  })

  it('dispatches dispatchAssignCluster on cluster change (real cluster id)', () => {
    const actions = makeActions()
    render(
      <NodeFields
        nodes={[clustered.nodes[0]!]}
        clusters={clustered.clusters ?? []}
        actions={actions}
      />,
    )
    const clusterSelect = screen.getByLabelText('Cluster') as HTMLSelectElement
    expect(clusterSelect.value).toBe('left')
    fireEvent.change(clusterSelect, { target: { value: 'right' } })
    expect(actions.dispatchAssignCluster).toHaveBeenCalledWith('a', 'right')
  })

  it('dispatchAssignCluster with undefined when cluster set to "" (the unassign sentinel)', () => {
    const actions = makeActions()
    render(
      <NodeFields
        nodes={[clustered.nodes[0]!]}
        clusters={clustered.clusters ?? []}
        actions={actions}
      />,
    )
    const clusterSelect = screen.getByLabelText('Cluster') as HTMLSelectElement
    fireEvent.change(clusterSelect, { target: { value: '' } })
    expect(actions.dispatchAssignCluster).toHaveBeenCalledWith('a', undefined)
  })

  it('cluster dropdown includes "— none —" plus every cluster', () => {
    const actions = makeActions()
    render(
      <NodeFields
        nodes={[clustered.nodes[0]!]}
        clusters={clustered.clusters ?? []}
        actions={actions}
      />,
    )
    expect(screen.getByRole('option', { name: '— none —' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Right' })).toBeInTheDocument()
  })
})

describe('NodeFields — multi-select', () => {
  it('shows shared value when all nodes share it', () => {
    const actions = makeActions()
    // Both nodes have shape: 'rect' (default).
    const both = [triangle.nodes[0]!, triangle.nodes[2]!]
    render(<NodeFields nodes={both} clusters={[]} actions={actions} />)
    expect((screen.getByLabelText('Shape') as HTMLSelectElement).value).toBe('rect')
  })

  it('shows empty placeholder when nodes have mixed values', () => {
    const actions = makeActions()
    // Node 'a' has label 'A', node 'b' has label 'B'.
    render(
      <NodeFields
        nodes={[triangle.nodes[0]!, triangle.nodes[1]!]}
        clusters={[]}
        actions={actions}
      />,
    )
    const labelInput = screen.getByLabelText('Labels') as HTMLInputElement
    expect(labelInput.value).toBe('')
    expect(labelInput).toHaveAttribute('placeholder', 'multiple values')
  })

  it('header label pluralizes when multi-select', () => {
    const actions = makeActions()
    render(
      <NodeFields
        nodes={[triangle.nodes[0]!, triangle.nodes[1]!]}
        clusters={[]}
        actions={actions}
      />,
    )
    // The Field's label-text changes from 'Label' to 'Labels'.
    expect(screen.getByText('Labels')).toBeInTheDocument()
  })

  it('commit applies to every selected node', () => {
    const actions = makeActions()
    render(
      <NodeFields
        nodes={[triangle.nodes[0]!, triangle.nodes[1]!]}
        clusters={[]}
        actions={actions}
      />,
    )
    const labelInput = screen.getByLabelText('Labels') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: 'Shared' } })
    fireEvent.keyDown(labelInput, { key: 'Enter' })
    expect(actions.dispatchSetField).toHaveBeenCalledTimes(2)
    expect(actions.dispatchSetField).toHaveBeenCalledWith({ kind: 'node-label', id: 'a' }, 'Shared')
    expect(actions.dispatchSetField).toHaveBeenCalledWith({ kind: 'node-label', id: 'b' }, 'Shared')
  })
})

// --- EdgeFields tests --------------------------------------------------------

describe('EdgeFields', () => {
  it('renders label + style fields', () => {
    const actions = makeActions()
    render(<EdgeFields edges={[triangle.edges[0]!]} actions={actions} />)
    expect(screen.getByLabelText('Label')).toBeInTheDocument()
    expect(screen.getByLabelText('Style')).toBeInTheDocument()
  })

  it('dispatches SetField{edge-label} keyed by effective id', () => {
    const actions = makeActions()
    render(<EdgeFields edges={[triangle.edges[0]!]} actions={actions} />)
    const labelInput = screen.getByLabelText('Label') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: 'commit' } })
    fireEvent.keyDown(labelInput, { key: 'Enter' })
    expect(actions.dispatchSetField).toHaveBeenCalledWith(
      { kind: 'edge-label', id: 'a->b' },
      'commit',
    )
  })

  it('dispatches SetField{edge-style} on style change', () => {
    const actions = makeActions()
    render(<EdgeFields edges={[triangle.edges[0]!]} actions={actions} />)
    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'solid' } })
    expect(actions.dispatchSetField).toHaveBeenCalledWith(
      { kind: 'edge-style', id: 'a->b' },
      'solid',
    )
  })
})

// --- ClusterFields tests -----------------------------------------------------

describe('ClusterFields', () => {
  it('renders only the label field in 0.4.0', () => {
    const actions = makeActions()
    render(<ClusterFields clusters={[clustered.clusters![0]!]} actions={actions} />)
    expect(screen.getByLabelText('Label')).toBeInTheDocument()
    expect(screen.queryByLabelText('Parent')).not.toBeInTheDocument()
  })

  it('dispatches SetField{cluster-label} on commit', () => {
    const actions = makeActions()
    render(<ClusterFields clusters={[clustered.clusters![0]!]} actions={actions} />)
    const labelInput = screen.getByLabelText('Label') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: 'Renamed' } })
    fireEvent.keyDown(labelInput, { key: 'Enter' })
    expect(actions.dispatchSetField).toHaveBeenCalledWith(
      { kind: 'cluster-label', id: 'left' },
      'Renamed',
    )
  })
})

// --- EmptyState --------------------------------------------------------------

describe('EmptyState', () => {
  it('renders the no-selection hint', () => {
    render(<EmptyState />)
    expect(screen.getByText('No selection')).toBeInTheDocument()
    expect(screen.getByText(/select a node, edge, or cluster/i)).toBeInTheDocument()
  })
})

// --- InspectorPanel routing --------------------------------------------------

function StoreSelector({
  select,
}: {
  select: (api: ReturnType<typeof useEditorStoreApi>) => void
}) {
  const api = useEditorStoreApi()
  select(api)
  return null
}

function renderPanel(
  actions: EditorActions,
  onStore: (api: ReturnType<typeof useEditorStoreApi>) => void,
) {
  return render(
    <InkinStoreProvider>
      <MockActionsProvider actions={actions}>
        <StoreSelector select={onStore} />
        <InspectorPanel diagram={clustered} />
      </MockActionsProvider>
    </InkinStoreProvider>,
  )
}

describe('InspectorPanel — routing by selection', () => {
  it('renders EmptyState when nothing is selected', () => {
    const actions = makeActions()
    renderPanel(actions, () => {})
    expect(screen.getByText('No selection')).toBeInTheDocument()
    expect(screen.getByText('Inspector')).toBeInTheDocument()
  })

  it('renders NodeFields when a node is selected, title reflects kind', () => {
    const actions = makeActions()
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPanel(actions, (a) => {
      api = a
    })
    act(() => {
      api.getState().setSelection({ nodes: new Set(['a']) })
    })
    // Re-query after state change. React re-renders on store update.
    expect(screen.getByLabelText('Label')).toBeInTheDocument()
    expect(screen.getByText('Node')).toBeInTheDocument()
  })

  it('renders EdgeFields when an edge is selected', () => {
    const actions = makeActions()
    let api!: ReturnType<typeof useEditorStoreApi>
    render(
      <InkinStoreProvider>
        <MockActionsProvider actions={actions}>
          <StoreSelector
            select={(a) => {
              api = a
            }}
          />
          <InspectorPanel diagram={triangle} />
        </MockActionsProvider>
      </InkinStoreProvider>,
    )
    act(() => {
      api.getState().setSelection({ edges: new Set(['a->b']) })
    })
    expect(screen.getByLabelText('Style')).toBeInTheDocument()
    expect(screen.getByText('Edge')).toBeInTheDocument()
  })

  it('renders ClusterFields when a cluster is selected', () => {
    const actions = makeActions()
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPanel(actions, (a) => {
      api = a
    })
    act(() => {
      api.getState().setSelection({ clusters: new Set(['left']) })
    })
    expect(screen.getByLabelText('Label')).toBeInTheDocument()
    expect(screen.getByText('Cluster')).toBeInTheDocument()
  })

  it('priority: nodes > edges > clusters when multiple kinds selected', () => {
    const actions = makeActions()
    let api!: ReturnType<typeof useEditorStoreApi>
    render(
      <InkinStoreProvider>
        <MockActionsProvider actions={actions}>
          <StoreSelector
            select={(a) => {
              api = a
            }}
          />
          <InspectorPanel diagram={triangle} />
        </MockActionsProvider>
      </InkinStoreProvider>,
    )
    act(() => {
      api.getState().setSelection({
        nodes: new Set(['a']),
        edges: new Set(['a->b']),
      })
    })
    // Nodes win.
    expect(screen.getByText('Node')).toBeInTheDocument()
    expect(screen.queryByLabelText('Style')).not.toBeInTheDocument()
  })

  it('multi-select header shows count + plural', () => {
    const actions = makeActions()
    let api!: ReturnType<typeof useEditorStoreApi>
    renderPanel(actions, (a) => {
      api = a
    })
    act(() => {
      api.getState().setSelection({ nodes: new Set(['a', 'b']) })
    })
    expect(screen.getByText('2 nodes')).toBeInTheDocument()
  })
})

describe('InspectorPanel — read-only mode safety', () => {
  it('renders nothing when there is no EditorActionsProvider in the tree', () => {
    const { container } = render(
      <InkinStoreProvider>
        <InspectorPanel diagram={triangle} />
      </InkinStoreProvider>,
    )
    expect(container.querySelector('[data-testid="inkin-inspector"]')).toBeNull()
  })
})

describe('InspectorPanel — positioning', () => {
  it('defaults to right position class', () => {
    const actions = makeActions()
    render(
      <InkinStoreProvider>
        <MockActionsProvider actions={actions}>
          <InspectorPanel diagram={triangle} />
        </MockActionsProvider>
      </InkinStoreProvider>,
    )
    const panel = screen.getByTestId('inkin-inspector')
    expect(panel.className).toMatch(/positionRight/)
  })

  it('honors position="left"', () => {
    const actions = makeActions()
    render(
      <InkinStoreProvider>
        <MockActionsProvider actions={actions}>
          <InspectorPanel diagram={triangle} position="left" />
        </MockActionsProvider>
      </InkinStoreProvider>,
    )
    const panel = screen.getByTestId('inkin-inspector')
    expect(panel.className).toMatch(/positionLeft/)
  })
})
