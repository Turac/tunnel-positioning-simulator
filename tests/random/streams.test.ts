import { describe, expect, it } from 'vitest'
import {
  createRng,
  createStreamRng,
  streamInput,
  streamState,
} from '../../src/core/random/rng'
import { STREAM_IDS, type StreamName } from '../../src/core/random/streams'

function take(next: () => number, n: number): number[] {
  return Array.from({ length: n }, next)
}

describe('stream ID table', () => {
  it('is pinned: IDs are permanent and append-only (ADR-0006)', () => {
    // Changing this literal means renumbering or removing a stream, which changes every
    // recorded result that uses it. Only append new entries with new IDs.
    expect(STREAM_IDS).toEqual({
      accelerometer: 1,
      gnss: 2,
      accelBiasInitial: 3,
      accelBiasDrift: 4,
      accelVibration: 5,
      gnssSpeed: 6,
      gnssReacquisitionDelay: 7,
      gnssReacquisitionError: 8,
    })
  })

  it('uses distinct integer IDs starting at 1', () => {
    const ids = Object.values(STREAM_IDS)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => Number.isInteger(id) && id >= 1)).toBe(true)
  })
})

describe('stream state matches the official SplitMix64 reference', () => {
  // Expected states: printed by tests/reference/splitmix64-harness.c, which computes the
  // input (streamId << 32) | seed and the low-then-high split in C
  // (tests/reference/splitmix64.expected.txt).
  it.each([
    [1, 42, [0xb0507523, 0x4e08d6bd, 0x7ff613d5, 0xb77ad2f1]],
    [2, 42, [0x64eb6168, 0x2381093e, 0xaff51209, 0x5ecd9410]],
    [1, 0, [0xa3820138, 0xc42c5a1a, 0x5756bd3d, 0x37ad5fdd]],
    [1, 4294967295, [0x7bf9c2c8, 0xb0caed0a, 0x779b52ea, 0x47c937cc]],
  ])('stream %i, seed %i', (streamId, seed, expected) => {
    expect(streamState(seed, streamId)).toEqual(expected)
  })

  it('matches the reference outputs end to end for stream 1, seed 42', () => {
    // Official xoshiro128** C code from the STREAM1_SEED42 state
    // (tests/reference/xoshiro128starstar.expected.txt).
    const outputs = take(createStreamRng(42, 'accelerometer').nextUint32, 1000)
    expect(outputs.slice(0, 10)).toEqual([
      0xc6df9edb, 0xda7e99e4, 0xf0fef6f8, 0x7b4e6c9a, 0x5ab5b7dc, 0xa3e4385a, 0x010fa120,
      0xa713e590, 0x835ebd0c, 0xa70f0eec,
    ])
    expect(outputs[999]).toBe(0x43b3f12c)
  })
})

describe('streams never coincide with plain seeds', () => {
  it.each([0, 1, 42, 4294967295])('seed %i: stream input >= 2^32 > plain input', (seed) => {
    for (const id of Object.values(STREAM_IDS)) {
      expect(streamInput(seed, id) >= 2n ** 32n).toBe(true)
    }
    expect(BigInt(seed) < 2n ** 32n).toBe(true)
  })

  it('pins the boundary inputs', () => {
    expect(streamInput(0, 1)).toBe(2n ** 32n)
    expect(streamInput(4294967295, 1)).toBe(2n ** 33n - 1n)
    expect(streamInput(0, 2)).toBe(2n ** 33n)
  })

  it('stream 1 with seed 0 differs from createRng(1)', () => {
    // With the rejected layout (seed << 32) | streamId both inputs would be 1.
    expect(take(createStreamRng(0, 'accelerometer').nextUint32, 10)).not.toEqual(
      take(createRng(1).nextUint32, 10),
    )
  })
})

describe('stream independence', () => {
  it('draws from one stream do not change another', () => {
    const untouched = take(createStreamRng(42, 'gnss').nextUint32, 100)

    const accelerometer = createStreamRng(42, 'accelerometer')
    const gnss = createStreamRng(42, 'gnss')
    take(accelerometer.nextUint32, 5000)
    expect(take(gnss.nextUint32, 100)).toEqual(untouched)
  })

  it('gives different sequences for different streams with the same seed', () => {
    expect(take(createStreamRng(42, 'accelerometer').nextUint32, 10)).not.toEqual(
      take(createStreamRng(42, 'gnss').nextUint32, 10),
    )
  })
})

describe('invalid input', () => {
  it.each([-1, 1.5, 2 ** 32, Number.NaN])('rejects seed %s', (seed) => {
    expect(() => createStreamRng(seed, 'gnss')).toThrow(RangeError)
  })

  it.each([0, -1, 1.5, 2 ** 32])('rejects stream ID %s', (id) => {
    expect(() => streamState(42, id)).toThrow(RangeError)
  })

  it('rejects an unknown stream name', () => {
    expect(() => createStreamRng(42, 'barometer' as StreamName)).toThrow(
      new RangeError('Unknown stream: barometer'),
    )
  })
})
