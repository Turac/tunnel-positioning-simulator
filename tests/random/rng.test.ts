import { describe, expect, it } from 'vitest'
import { createRng, seedState, toUnitInterval } from '../../src/core/random/rng'

function take(next: () => number, n: number): number[] {
  return Array.from({ length: n }, next)
}

describe('seeding', () => {
  // Expected words: the SplitMix64 reference outputs for each seed
  // (tests/reference/splitmix64.expected.txt), split low-then-high (ADR-0004).
  it.each([
    [42, [0x2feb6e95, 0xbdd73226, 0xb266f103, 0x28efe333]],
    [4294967295, [0xaff181c0, 0x73b13ba2, 0x1340d3b4, 0x61204305]],
  ])('seed %i expands to the expected state', (seed, expected) => {
    expect(seedState(seed)).toEqual(expected)
  })

  it.each([1.5, -1, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid seed %s',
    (seed) => {
      expect(() => createRng(seed)).toThrow(RangeError)
    },
  )
})

describe('determinism', () => {
  it('produces the identical sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(take(a.nextUint32, 1000)).toEqual(take(b.nextUint32, 1000))
  })

  it('produces different sequences for different seeds', () => {
    expect(take(createRng(42).nextUint32, 10)).not.toEqual(take(createRng(43).nextUint32, 10))
  })

  it('matches the reference outputs end to end for seed 42', () => {
    // First outputs of the official xoshiro128** C code from the SEED42 state
    // (tests/reference/xoshiro128starstar.expected.txt). Changing the seeding or the
    // generator changes every recorded result, so this must stay fixed.
    const expected = [0x69e85a2a, 0xf843fad0, 0x0105185f, 0x8a1f1ea6, 0xa66be2a9]
    expect(take(createRng(42).nextUint32, 5)).toEqual(expected)

    const uniforms = take(createRng(42).uniform, 5)
    expect(uniforms).toEqual(expected.map((x) => x / 2 ** 32))
  })
})

describe('uniform', () => {
  it('maps the uint32 range onto [0, 1)', () => {
    expect(toUnitInterval(0)).toBe(0)
    expect(toUnitInterval(0xffffffff)).toBeLessThan(1)
  })

  it('stays in [0, 1) with mean close to 0.5', () => {
    const rng = createRng(7)
    const n = 100_000
    let sum = 0
    for (let i = 0; i < n; i++) {
      const u = rng.uniform()
      expect(u >= 0 && u < 1).toBe(true)
      sum += u
    }
    // Standard error of the mean: sqrt(1/12) / sqrt(n) ≈ 0.00091; 0.005 is about 5.5σ.
    // The seed is fixed, so this check is deterministic, not flaky.
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.005)
  })
})
