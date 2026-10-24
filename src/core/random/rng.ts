// Seeded random number generator: the only source of randomness in src/core
// (CLAUDE.md hard rule 2). See ADR-0004 (generator, seeding) and ADR-0006 (named streams).

import { boxMuller } from './gaussian'
import { createSplitMix64 } from './splitmix64'
import { STREAM_IDS, type StreamName } from './streams'
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
const MAX_UINT32 = 0xffffffff
const LOW_32 = 0xffffffffn

/** Maps a uint32 to [0, 1). Exact in double precision; never returns 1. */
export function toUnitInterval(x: number): number {
  return x / TWO_POW_32
}

function assertUint32(value: number, what: string, min = 0): void {
  if (!Number.isInteger(value) || value < min || value > MAX_UINT32) {
    throw new RangeError(`${what} must be an integer in [${min}, 2^32 - 1], got ${value}`)
  }
}

/**
 * Fills xoshiro128** state from two SplitMix64 outputs. Word order is a project convention
 * (low 32 bits, then high 32 bits, of each output); see ADR-0004.
 */
function stateFromSplitMix64(input: bigint): Xoshiro128State {
  const next = createSplitMix64(input)
  const a = next()
  const b = next()
  return [Number(a & LOW_32), Number(a >> 32n), Number(b & LOW_32), Number(b >> 32n)]
}

/** SplitMix64 input of a plain seed: always < 2^32. */
export function seedState(seed: number): Xoshiro128State {
  assertUint32(seed, 'Seed')
  return stateFromSplitMix64(BigInt(seed))
}

/**
 * SplitMix64 input of a named stream: `(streamId << 32) | seed`. Stream IDs start at 1, so
 * every stream input is >= 2^32 and never coincides with a plain seed (< 2^32), for all
 * seeds including 0. See ADR-0006.
 */
export function streamInput(seed: number, streamId: number): bigint {
  assertUint32(seed, 'Seed')
  assertUint32(streamId, 'Stream ID', 1)
  return (BigInt(streamId) << 32n) | BigInt(seed)
}

export function streamState(seed: number, streamId: number): Xoshiro128State {
  return stateFromSplitMix64(streamInput(seed, streamId))
}

function rngFromState(state: Xoshiro128State): Rng {
  const next = createXoshiro128ss(state)
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

export function createRng(seed: number): Rng {
  return rngFromState(seedState(seed))
}

/** Independent generator for one named random source of a scenario run. */
export function createStreamRng(seed: number, stream: StreamName): Rng {
  if (!Object.hasOwn(STREAM_IDS, stream)) {
    throw new RangeError(`Unknown stream: ${String(stream)}`)
  }
  return rngFromState(streamState(seed, STREAM_IDS[stream]))
}
