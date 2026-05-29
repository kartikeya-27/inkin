import type { DiagramInput } from '@inkin/core'

/**
 * The hello-world sample — three nodes in a row, two labeled edges, one
 * terminal node. Same diagram the README quickstart shows. If this doesn't
 * render correctly there is no point investigating anything else.
 */
export const minimal: DiagramInput = {
  schemaVersion: 1,
  nodes: [
    { id: 'a', label: 'Start' },
    { id: 'b', label: 'Middle' },
    { id: 'c', label: 'End', shape: 'terminal' },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'go' },
    { from: 'b', to: 'c', label: 'finish' },
  ],
}
