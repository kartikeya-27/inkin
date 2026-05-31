import { describe, expect, it } from 'vitest'
import { ALPHABET, ID_LENGTH, mintId, mintUniqueId } from '../../../src/renderer/lib/id'

/**
 * Contract tests for the id factory. Two layers:
 *   - Alphabet & shape: the alphabet stays at 56 chars, no look-alikes,
 *     mintId always returns ID_LENGTH chars drawn from it. Locking the
 *     alphabet protects against accidental edits that would break id
 *     legibility ("hey, why are some ids showing 0s now?").
 *   - Behavior: statistical collision-resistance at our diagram scale,
 *     deterministic output under an injected random source (so we can
 *     verify the retry path in mintUniqueId without flaky tests).
 */

describe('id factory — alphabet contract', () => {
  it('is 56 characters', () => {
    expect(ALPHABET).toHaveLength(56)
  })

  it('contains no look-alike characters (0 O o 1 l I)', () => {
    for (const c of '0Oo1lI') {
      expect(ALPHABET.includes(c)).toBe(false)
    }
  })

  it('contains only base62 characters', () => {
    expect(/^[A-Za-z0-9]+$/.test(ALPHABET)).toBe(true)
  })

  it('has no duplicate characters', () => {
    expect(new Set(ALPHABET).size).toBe(ALPHABET.length)
  })
})

describe('mintId', () => {
  it('produces a string of exactly ID_LENGTH characters', () => {
    expect(mintId()).toHaveLength(ID_LENGTH)
  })

  it('only uses characters from the documented alphabet', () => {
    // 100 samples is enough to surface any out-of-alphabet character
    // (every byte in [0..255] maps via modulo).
    for (let i = 0; i < 100; i += 1) {
      const id = mintId()
      for (const c of id) {
        expect(ALPHABET.includes(c)).toBe(true)
      }
    }
  })

  it('generates 10 000 ids without a collision (statistical gate)', () => {
    // With 30.8B-id space and 10k draws, the birthday-paradox collision
    // probability is ~1.6e-6 — effectively zero. A flake here means the
    // alphabet shrank, the length dropped, or the random source broke.
    const seen = new Set<string>()
    for (let i = 0; i < 10_000; i += 1) {
      seen.add(mintId())
    }
    expect(seen.size).toBe(10_000)
  })

  it('honors an injected deterministic random source', () => {
    // Force every byte to 0 → every alphabet index 0 → ALPHABET[0]^6.
    const allZeros = (n: number) => new Uint8Array(n)
    expect(mintId(allZeros)).toBe(ALPHABET.charAt(0).repeat(ID_LENGTH))
  })

  it('maps bytes uniformly via modulo for predictable test outputs', () => {
    // Byte value 1 → ALPHABET[1] under modulo (1 % 56 === 1).
    const allOnes = (n: number) => new Uint8Array(n).fill(1)
    expect(mintId(allOnes)).toBe(ALPHABET.charAt(1).repeat(ID_LENGTH))
  })
})

describe('mintUniqueId', () => {
  it('returns an id that is not in the existing set', () => {
    const existing = new Set(['ABCDEF', 'GHJKLM'])
    const id = mintUniqueId(existing)
    expect(existing.has(id)).toBe(false)
    expect(id).toHaveLength(ID_LENGTH)
  })

  it('retries when the first attempt collides', () => {
    // Sequential mock: first call returns 0×6 (→ ALPHABET[0]^6),
    // second call returns 1×6 (→ ALPHABET[1]^6). Seeding `existing`
    // with the first id forces exactly one retry.
    const sequence = [new Uint8Array(ID_LENGTH).fill(0), new Uint8Array(ID_LENGTH).fill(1)]
    let calls = 0
    const random = () => {
      const next = sequence[calls] ?? new Uint8Array(ID_LENGTH)
      calls += 1
      return next
    }
    const firstId = ALPHABET.charAt(0).repeat(ID_LENGTH)
    const expectedRetryId = ALPHABET.charAt(1).repeat(ID_LENGTH)

    const id = mintUniqueId(new Set([firstId]), random)
    expect(id).toBe(expectedRetryId)
    expect(calls).toBe(2)
  })

  it('throws after 100 consecutive collisions', () => {
    // Random source always returns the same bytes → always the same id.
    const constant = new Uint8Array(ID_LENGTH) // all zeros
    const random = () => constant
    const fixedId = ALPHABET.charAt(0).repeat(ID_LENGTH)

    expect(() => mintUniqueId(new Set([fixedId]), random)).toThrow(/100 consecutive collisions/)
  })
})
