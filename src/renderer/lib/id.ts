/**
 * 6-character alphanumeric id factory for new nodes and clusters created
 * via the Palette (0.4.0+). Produces opaque, human-readable identifiers
 * without pulling in a runtime dependency (`nanoid` is well-engineered
 * but adds ~1 KB to the bundle for 30 LOC of code we own anyway).
 *
 * **Alphabet** (56 chars): base62 minus look-alikes (`0`, `O`, `o`, `1`,
 * `l`, `I`). An id like `Hk7p2X` survives being read aloud, transcribed
 * by hand, or pasted into a non-monospace font without ambiguity.
 *
 * **Collision odds**: 56^6 ≈ 30.8 billion possible ids. For any realistic
 * diagram (dozens to hundreds of nodes), the probability of a collision
 * on a single mint is effectively zero. {@link mintUniqueId} exists as
 * defense-in-depth — and the schema's `superRefine` on id uniqueness is
 * the ultimate gate (the dispatcher's `safeParse` rejects a colliding
 * patch before `onChange` fires).
 *
 * **Randomness source**: `crypto.getRandomValues` (browser + Node 19+).
 * Falls back to `Math.random` in environments where WebCrypto is
 * unavailable; the fallback is documented but never triggered in the
 * supported runtime range (React 18+/Node 22+).
 *
 * **Bias note**: 256 is not divisible by 56, so `byte % 56` slightly
 * over-represents the first 32 alphabet positions (by ~1 byte in every
 * 256). The bias is well under the collision-resistance floor at this
 * scale; rejection sampling would add complexity for no measurable
 * benefit.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
//                A B C D E F G H _ J K L M N _ P Q R S T U V W X Y Z   (no I, no O)
//                a b c d e f g h i j k _ m n _ p q r s t u v w x y z   (no l, no o)
//                _ _ 2 3 4 5 6 7 8 9                                   (no 0, no 1)

const ID_LENGTH = 6

/**
 * Random-bytes source. Production callers leave this default
 * ({@link defaultRandomBytes}). Tests inject a deterministic implementation
 * to make the output reproducible.
 */
export type RandomBytes = (length: number) => Uint8Array

const defaultRandomBytes: RandomBytes = (length) => {
  const bytes = new Uint8Array(length)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
    return bytes
  }
  // Fallback for runtimes without WebCrypto. Not cryptographic-grade, but
  // for a single-user editor's node ids the collision resistance is still
  // effectively perfect at our scale.
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

/**
 * Mint one id. The result is always exactly {@link ID_LENGTH} characters
 * drawn from {@link ALPHABET}.
 */
export function mintId(random: RandomBytes = defaultRandomBytes): string {
  const bytes = random(ID_LENGTH)
  let id = ''
  for (let i = 0; i < ID_LENGTH; i += 1) {
    // `bytes[i]` is `number | undefined` under noUncheckedIndexedAccess; the
    // random source contract guarantees a Uint8Array of the requested length,
    // so the `?? 0` is unreachable in production but keeps the type honest.
    const byte = bytes[i] ?? 0
    id += ALPHABET.charAt(byte % ALPHABET.length)
  }
  return id
}

/**
 * Mint an id guaranteed not to be in `existing`. Retries up to 100 times
 * before throwing — far beyond what's needed unless `existing` covers a
 * non-trivial fraction of the 30.8B-id space (which no real diagram does).
 *
 * The retry loop is defense in depth; in practice the very first attempt
 * is collision-free for diagrams of any realistic size.
 */
export function mintUniqueId(
  existing: ReadonlySet<string>,
  random: RandomBytes = defaultRandomBytes,
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = mintId(random)
    if (!existing.has(id)) return id
  }
  throw new Error('mintUniqueId: 100 consecutive collisions — existing set is impossibly dense')
}

// Re-exported so tests can lock the alphabet contract and consumers
// (should we ever want to expose them — not in 0.4.0) have stable surface.
export { ALPHABET, ID_LENGTH }
