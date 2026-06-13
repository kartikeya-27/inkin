/**
 * Round-trip fixture corpus for the 0.6.0 Mermaid bridge. Phase 8.
 *
 * Each entry is a Mermaid source string within inkin's documented
 * supported subset (see `notes/mermaid-grammar-snapshot/`). The
 * round-trip suite asserts:
 *
 *   normalize(fromMermaid(src))  ==  normalize(fromMermaid(toMermaid(
 *                                       fromMermaid(src).diagram)))
 *
 * i.e. parsing, re-emitting, and re-parsing yields a semantically equal
 * Diagram (decision #7: semantic equivalence, not byte-identical text).
 *
 * ---------------------------------------------------------------------------
 * Attribution: these inputs are adapted from the Mermaid project's own
 * parser test corpus —
 *   packages/mermaid/src/diagrams/flowchart/parser/flow-*.spec.js
 *   packages/mermaid/src/diagrams/state/parser/state-parser.spec.js
 * at mermaid-js/mermaid HEAD `a047cbf9c8589438b1dc7c1e323ab7493e9ce5c5`.
 * Mermaid is MIT-licensed (© 2015 Knut Sveidqvist and Mermaid
 * contributors). Reduced / reshaped to the inkin supported subset.
 * ---------------------------------------------------------------------------
 */

export interface RoundTripFixture {
  readonly name: string
  readonly mermaid: string
}

export const FLOWCHART_FIXTURES: readonly RoundTripFixture[] = [
  {
    name: 'minimal two-node chain',
    mermaid: 'flowchart\nA[Start] --> B[End]',
  },
  {
    name: 'bare-id nodes (label defaults to id)',
    mermaid: 'flowchart\nA --> B --> C',
  },
  {
    name: 'all in-scope node shapes',
    mermaid: `flowchart
A[rect] --> B((circle))
B --> C(((double)))
C --> D{diamond}
D --> E{{hex}}
E --> F([stadium])
F --> G[(cylinder)]
G --> H[[subroutine]]`,
  },
  {
    name: 'all edge styles',
    mermaid: `flowchart
A --> B
B --- C
C -.-> D
D -.- E
E ==> F
F === G
G ~~~ H`,
  },
  {
    name: 'pipe and mid-edge labels',
    mermaid: `flowchart
A -->|click| B
B -- submit --> C
C -. retry .-> D`,
  },
  {
    name: 'direction LR',
    mermaid: 'flowchart LR\nA[Start] --> B[End]',
  },
  {
    name: 'single subgraph',
    mermaid: `flowchart
subgraph g1[Group One]
A[A] --> B[B]
end
B --> C[C]`,
  },
  {
    name: 'multiple subgraphs + top-level node first',
    mermaid: `flowchart
X[outside]
subgraph g1[One]
A[A]
end
subgraph g2[Two]
B[B]
end
X --> A
A --> B`,
  },
  {
    name: 'parallel edges between the same pair',
    mermaid: `flowchart
A[A] --> B[B]
A --> B
A -.-> B`,
  },
  {
    name: 'labels with spaces',
    mermaid: 'flowchart\nA[Long node label] --> B[Another label]',
  },
]

export const STATE_FIXTURES: readonly RoundTripFixture[] = [
  {
    name: 'start/end sentinels + transitions',
    mermaid: `stateDiagram-v2
[*] --> Pending
Pending --> Running
Running --> [*]`,
  },
  {
    name: 'transitions with event descriptions',
    mermaid: `stateDiagram-v2
[*] --> Idle
Idle --> Running : start
Running --> Idle : pause
Running --> [*] : done`,
  },
  {
    name: 'labeled state declarations',
    mermaid: `stateDiagram-v2
state "Active state" as Active
Active --> Idle
Idle --> Active`,
  },
  {
    name: 'compound state',
    mermaid: `stateDiagram-v2
[*] --> Active
state Active {
  Running --> Idle
  Idle --> Running
}
Active --> [*]`,
  },
]
