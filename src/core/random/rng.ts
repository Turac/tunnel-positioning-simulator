// Seeded random number generator: the only source of randomness in src/core
// (CLAUDE.md hard rule 2). See ADR-0004.

import { boxMuller } from './gaussian'
import { createSplitMix64 } from './splitmix64'
import { createXoshiro128ss, type Xoshiro128State } from './xoshiro128ss'

export interface Rng {
  /** Next raw output, an integer in [0, 2^32). */
  nextUint32(): number
  /** Next uniform sample in [0, 1). */
  uniform(): number
  /** Next normal sample with the given mean and standard deviation. Consumes two uniforms. */
  gaussian(mean?: number, sigma?: number): number
}

const TWO_POW_32 = 2 ** 32
const LOW_32 = 0xffffffffn

/** Maps a uint32 to [0, 1). Exact in double precision; never returns 1. */
export function toUnitInterval(x: number): number {
  return x / TWO_POW_32
}

/**
 * Expands a seed into xoshiro128** state with two SplitMix64 outputs. Word order is a
 * project convention (low 32 bits, then high 32 bits, of each output); see ADR-0004.
 */
export function seedState(seed: number): Xoshiro128State {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`Seed must be an integer in [0, 2^32 - 1], got ${seed}`)
  }
  const next = createSplitMix64(BigInt(seed))
  const a = next()
  const b = next()
  return [Number(a & LOW_32), Number(a >> 32n), Number(b & LOW_32), Number(b >> 32n)]
}

export function createRng(seed: number): Rng {
  const next = createXoshiro128ss(seedState(seed))
  const uniform = (): number => toUnitInterval(next())
  return {
    nextUint32: next,
    uniform,
    gaussian: (mean = 0, sigma = 1) => {
      if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma < 0) {
        throw new RangeError(`Invalid normal parameters: mean ${mean}, sigma ${sigma}`)
      }
      const u1 = uniform()
      const u2 = uniform()
      return mean + sigma * boxMuller(u1, u2)
    },
  }
}
