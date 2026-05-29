import type { Diagram } from '@inkin/core'

/**
 * A generic order-processing state machine. Exercises:
 *   - rect + terminal node shapes mixed in one diagram
 *   - a self-edge (`processing` → `processing` on retry)
 *   - branching from a single source (the `cancel` path)
 *   - dagre laying out a non-trivial DAG without explicit positions
 *
 * No clusters here; this is the "single graph" use case (state diagrams,
 * approval flows, simple pipelines).
 */
export const lifecycle: Diagram = {
  schemaVersion: 1,
  nodes: [
    { id: 'created', label: 'Created', shape: 'terminal' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'processing', label: 'Processing', sublabel: 'async worker' },
    { id: 'completed', label: 'Completed', shape: 'terminal' },
    { id: 'failed', label: 'Failed', shape: 'terminal' },
    { id: 'cancelled', label: 'Cancelled', shape: 'terminal' },
  ],
  edges: [
    { from: 'created', to: 'submitted', label: 'submit' },
    { from: 'submitted', to: 'processing', label: 'pick up' },
    { from: 'processing', to: 'processing', label: 'retry', style: 'dashed' },
    { from: 'processing', to: 'completed', label: 'ok' },
    { from: 'processing', to: 'failed', label: 'error' },
    { from: 'submitted', to: 'cancelled', label: 'cancel', style: 'dashed' },
  ],
}
