// SplitMix64 (Vigna). Port of the official reference implementation, verified against it
// in tests/random/splitmix64.test.ts. Used only to expand a seed into generator state, so
// the BigInt cost is paid once per stream, not per sample. See ADR-0004.

const GAMMA = 0x9e3779b97f4a7c15n
const MUL1 = 0xbf58476d1ce4e5b9n
const MUL2 = 0x94d049bb133111ebn

const u64 = (x: bigint): bigint => BigInt.asUintN(64, x)

/** Returns a generator of uint64 outputs (as bigint) starting from `seed`. */
export function createSplitMix64(seed: bigint): () => bigint {
  let x = u64(seed)

  return () => {
    x = u64(x + GAMMA)
    let z = x
    z = u64((z ^ (z >> 30n)) * MUL1)
    z = u64((z ^ (z >> 27n)) * MUL2)
    return z ^ (z >> 31n)
  }
}
