// xoshiro128** 1.1 (Blackman and Vigna). Port of the official reference implementation,
// verified against it in tests/random/xoshiro128ss.test.ts. See ADR-0004.

export type Xoshiro128State = readonly [number, number, number, number]

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k))
}

/** Returns a generator of uint32 outputs. The state must not be all zero. */
export function createXoshiro128ss(state: Xoshiro128State): () => number {
  if (state.every((word) => word === 0)) {
    throw new RangeError('xoshiro128** state must not be all zero')
  }
  // Words are held as int32 between steps (JavaScript bitwise operators return int32);
  // the bit patterns are identical to the C uint32_t state. Outputs are made unsigned.
  let [s0, s1, s2, s3] = state

  return () => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0
    const t = s1 << 9

    s2 ^= s0
    s3 ^= s1
    s1 ^= s2
    s0 ^= s3
    s2 ^= t
    s3 = rotl(s3, 11)

    return result
  }
}
