/**
 * Vitest setup file — runs once per test file before `describe`/`it` blocks.
 *
 * What this covers:
 *   1. `@testing-library/jest-dom` matchers (`toBeInTheDocument`,
 *      `toHaveAttribute`, etc.) registered on `expect` for the React tests.
 *   2. Browser globals xyflow expects but JSDOM doesn't ship:
 *        - `ResizeObserver` — used by xyflow to measure node/container sizes.
 *          JSDOM omits it, and without a stub xyflow throws on first render.
 *        - `DOMMatrix` — used by xyflow's viewport transform math.
 *        - `Element.prototype.scrollTo` — called by xyflow on focus events.
 *
 * The stubs are intentionally minimal: they exist so `<ReactFlow>` mounts
 * without crashing under JSDOM. They do NOT attempt to emulate real layout;
 * the React tests assert mount + DOM shape only, not pixel positions (that's
 * the job of the Playwright e2e suite landing in 0.3.0).
 *
 * Node-environment test files (`tests/schema.test.ts` etc.) load this setup
 * too but ignore the DOM stubs since the runtime has no `globalThis.window`
 * unless the file opts into JSDOM via the `// @vitest-environment jsdom`
 * directive at the top.
 */

import '@testing-library/jest-dom/vitest'

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class DOMMatrixStub {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0
  m11 = 1
  m12 = 0
  m13 = 0
  m14 = 0
  m21 = 0
  m22 = 1
  m23 = 0
  m24 = 0
  m31 = 0
  m32 = 0
  m33 = 1
  m34 = 0
  m41 = 0
  m42 = 0
  m43 = 0
  m44 = 1
  inverse(): DOMMatrixStub {
    return new DOMMatrixStub()
  }
  multiply(): DOMMatrixStub {
    return new DOMMatrixStub()
  }
}

const globalAny = globalThis as unknown as Record<string, unknown>

if (typeof globalAny.ResizeObserver === 'undefined') {
  globalAny.ResizeObserver = ResizeObserverStub
}

if (typeof globalAny.DOMMatrix === 'undefined') {
  globalAny.DOMMatrix = DOMMatrixStub
}

if (typeof globalAny.window !== 'undefined') {
  const elementProto = (globalAny.Element as { prototype: { scrollTo?: () => void } }).prototype
  if (typeof elementProto.scrollTo !== 'function') {
    elementProto.scrollTo = () => {}
  }
}
