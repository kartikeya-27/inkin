import type { DiagramInput } from '@inkin/core'

/**
 * A generic three-tier web architecture, clustered. Exercises:
 *   - clusters with multiple child nodes
 *   - solid + dashed edges
 *   - sublabels (monospace second line)
 *   - terminal-shape leaf nodes
 *   - dagre auto-layout across cluster boundaries
 *   - flow animation (0.5.0) — two flows staggered to show parallel
 *     data movement: a synchronous request path through
 *     `browser → api → web → db`, and an async queue drain via
 *     `worker → db`. The queue-drain flow starts at half the loop's
 *     phase (3.25 s = duration / 2) so the two tokens are visually
 *     out of phase, reinforcing the "parallel and independent"
 *     reading without overlapping in time.
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
  flows: [
    // Synchronous request path: browser hits API, API forwards to web,
    // web reads/writes the DB. The token traces all three edges as one
    // continuous offset-path.
    { id: 'request', edges: ['req-in', 'req-svc', 'svc-db'], duration: 6500 },
    // Background worker draining a queue against the same DB. One edge,
    // same duration, staggered by half the loop so it's never visually
    // overlaid on the request token.
    { id: 'queue-drain', edges: ['wkr-db'], duration: 6500, delay: 3250 },
  ],
}
