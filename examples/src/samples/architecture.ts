import type { DiagramInput } from '@inkin/core'

/**
 * A generic three-tier web architecture, clustered. Exercises:
 *   - clusters with multiple child nodes
 *   - solid + dashed edges
 *   - sublabels (monospace second line)
 *   - terminal-shape leaf nodes
 *   - dagre auto-layout across cluster boundaries
 *
 * Flow animation is part of 0.5.0 and is intentionally not used here.
 */
export const architecture: DiagramInput = {
  schemaVersion: 1,
  clusters: [
    { id: 'edge', label: 'edge' },
    { id: 'app', label: 'application' },
    { id: 'data', label: 'data' },
  ],
  nodes: [
    { id: 'browser', label: 'Browser', sublabel: 'client', cluster: 'edge' },
    { id: 'cdn', label: 'CDN', sublabel: 'static assets', cluster: 'edge', shape: 'terminal' },
    { id: 'api', label: 'API Gateway', sublabel: 'edge', cluster: 'app' },
    { id: 'web', label: 'Web Service', sublabel: 'Node 24 LTS', cluster: 'app' },
    { id: 'worker', label: 'Worker', sublabel: 'background jobs', cluster: 'app' },
    { id: 'cache', label: 'Cache', sublabel: 'Redis', cluster: 'data', shape: 'terminal' },
    { id: 'db', label: 'Database', sublabel: 'Postgres', cluster: 'data', shape: 'terminal' },
  ],
  edges: [
    { id: 'req-in', from: 'browser', to: 'api', label: 'HTTPS' },
    { id: 'req-svc', from: 'api', to: 'web', style: 'dashed' },
    { id: 'svc-db', from: 'web', to: 'db' },
    { id: 'svc-cache', from: 'web', to: 'cache', style: 'dashed' },
    { id: 'wkr-db', from: 'worker', to: 'db', label: 'consume queue' },
    { from: 'browser', to: 'cdn' },
  ],
}
