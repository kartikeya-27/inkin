import { describe, expect, it } from 'vitest'
import { createInkinStore } from '../../../src/renderer/store'
import {
  editTargetEquals,
  type EditTarget,
} from '../../../src/renderer/store/edit'

/**
 * EditSlice unit tests.
 *
 * The Phase 4 verification gate: a `start → update → commit` round-trip
 * returns the final draft text and clears the slot; a `start → cancel`
 * round-trip returns null on the subsequent commit and clears the slot.
 *
 * Subscriber-notification semantics mirror the SelectionSlice tests: a
 * no-op write (e.g. `updateDraft` to the same text) must not call set.
 */

const nodeLabel: EditTarget = { kind: 'node-label', id: 'a' }
const nodeSublabel: EditTarget = { kind: 'node-sublabel', id: 'a' }
const edgeLabel: EditTarget = { kind: 'edge-label', id: 'a->b' }

describe('EditSlice — initial state', () => {
  it('starts with no active edit and an empty draft', () => {
    const state = createInkinStore().getState()
    expect(state.editTarget).toBeNull()
    expect(state.draftText).toBe('')
  })

  it('exposes the four edit actions', () => {
    const state = createInkinStore().getState()
    expect(typeof state.startEdit).toBe('function')
    expect(typeof state.updateDraft).toBe('function')
    expect(typeof state.commitEdit).toBe('function')
    expect(typeof state.cancelEdit).toBe('function')
  })
})

describe('EditSlice — startEdit → updateDraft → commitEdit round-trip', () => {
  it('commits the final draft text and clears the slot', () => {
    const store = createInkinStore()
    store.getState().startEdit(nodeLabel, 'Start')
    expect(store.getState().editTarget).toEqual(nodeLabel)
    expect(store.getState().draftText).toBe('Start')

    store.getState().updateDraft('Sta')
    store.getState().updateDraft('Stage 1')

    const committed = store.getState().commitEdit()
    expect(committed).not.toBeNull()
    expect(committed?.target).toEqual(nodeLabel)
    expect(committed?.text).toBe('Stage 1')

    expect(store.getState().editTarget).toBeNull()
    expect(store.getState().draftText).toBe('')
  })

  it('accepts the empty string as a valid commit (intentional blank label)', () => {
    const store = createInkinStore()
    store.getState().startEdit(edgeLabel, 'go')
    store.getState().updateDraft('')
    const committed = store.getState().commitEdit()
    expect(committed?.text).toBe('')
    expect(store.getState().editTarget).toBeNull()
  })

  it('commitEdit on an idle store returns null and does not throw', () => {
    const store = createInkinStore()
    expect(store.getState().commitEdit()).toBeNull()
    expect(store.getState().editTarget).toBeNull()
  })
})

describe('EditSlice — cancelEdit', () => {
  it('clears the slot without committing; subsequent commitEdit returns null', () => {
    const store = createInkinStore()
    store.getState().startEdit(nodeSublabel, 'old')
    store.getState().updateDraft('new')
    store.getState().cancelEdit()
    expect(store.getState().editTarget).toBeNull()
    expect(store.getState().draftText).toBe('')
    expect(store.getState().commitEdit()).toBeNull()
  })

  it('is a no-op on an idle store (no subscriber notification)', () => {
    const store = createInkinStore()
    let calls = 0
    const unsub = store.subscribe(() => {
      calls += 1
    })
    store.getState().cancelEdit()
    unsub()
    expect(calls).toBe(0)
  })
})

describe('EditSlice — single-slot semantics', () => {
  it('startEdit on a new target replaces the active edit silently', () => {
    const store = createInkinStore()
    store.getState().startEdit(nodeLabel, 'first')
    store.getState().startEdit(edgeLabel, 'second')
    expect(store.getState().editTarget).toEqual(edgeLabel)
    expect(store.getState().draftText).toBe('second')
  })

  it('startEdit with the same target AND same initial text is a no-op', () => {
    const store = createInkinStore()
    store.getState().startEdit(nodeLabel, 'x')
    let calls = 0
    const unsub = store.subscribe(() => {
      calls += 1
    })
    store.getState().startEdit(nodeLabel, 'x')
    unsub()
    expect(calls).toBe(0)
  })

  it('startEdit with the same target but different text DOES update the draft', () => {
    const store = createInkinStore()
    store.getState().startEdit(nodeLabel, 'x')
    store.getState().startEdit(nodeLabel, 'y')
    expect(store.getState().draftText).toBe('y')
  })
})

describe('EditSlice — updateDraft no-op', () => {
  it('does not notify subscribers when text is unchanged', () => {
    const store = createInkinStore()
    store.getState().startEdit(nodeLabel, 'hello')
    let calls = 0
    const unsub = store.subscribe(() => {
      calls += 1
    })
    store.getState().updateDraft('hello')
    unsub()
    expect(calls).toBe(0)
  })

  it('does notify on a real change', () => {
    const store = createInkinStore()
    store.getState().startEdit(nodeLabel, 'a')
    let calls = 0
    const unsub = store.subscribe(() => {
      calls += 1
    })
    store.getState().updateDraft('ab')
    unsub()
    expect(calls).toBe(1)
  })
})

describe('EditSlice — per-instance isolation', () => {
  it('edits in one store do not leak to another', () => {
    const a = createInkinStore()
    const b = createInkinStore()
    a.getState().startEdit(nodeLabel, 'only-in-a')
    expect(a.getState().editTarget).not.toBeNull()
    expect(b.getState().editTarget).toBeNull()
  })
})

describe('editTargetEquals — pure helper', () => {
  it('returns true for the same reference', () => {
    expect(editTargetEquals(nodeLabel, nodeLabel)).toBe(true)
  })

  it('returns true for distinct objects with same kind + id', () => {
    expect(editTargetEquals({ kind: 'node-label', id: 'a' }, { kind: 'node-label', id: 'a' })).toBe(
      true,
    )
  })

  it('returns false when kinds differ', () => {
    expect(editTargetEquals(nodeLabel, nodeSublabel)).toBe(false)
  })

  it('returns false when ids differ', () => {
    expect(editTargetEquals(nodeLabel, { kind: 'node-label', id: 'b' })).toBe(false)
  })

  it('handles null on either side', () => {
    expect(editTargetEquals(null, null)).toBe(true)
    expect(editTargetEquals(nodeLabel, null)).toBe(false)
    expect(editTargetEquals(null, nodeLabel)).toBe(false)
  })
})
