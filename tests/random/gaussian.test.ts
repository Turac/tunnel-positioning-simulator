import { describe, expect, it } from 'vitest'
import { boxMuller } from '../../src/core/random/gaussian'
import { createRng } from '../../src/core/random/rng'

describe('boxMuller: analytic values', () => {
  // With u1 = 1 − e^(−1/2), the radius √(−2 ln(1 − u1)) is exactly 1, so z = cos(2π u2).
  const unitRadius = 1 - Math.exp(-0.5)

  it.each([
    [0, 1], // cos(0) = 1
    [0.5, -1], // cos(π) = −1
    [0.25, 0], // cos(π/2) = 0
  ])('u1 = 1 − e^(−1/2), u2 = %s gives %s', (u2, expected) => {
    expect(boxMuller(unitRadius, u2)).toBeCloseTo(expected, 12)
  })

  it('stays finite for u1 = 0 (ln(1) = 0, so z = 0)', () => {
    const z = boxMuller(0, 0.3)
    expect(Number.isFinite(z)).toBe(true)
    expect(z).toBeCloseTo(0, 15)
  })
})

describe('gaussian: stream consumption', () => {
  it('consumes exactly two uniforms per sample, in order', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 5; i++) {
      const u1 = b.uniform()
      const u2 = b.uniform()
      expect(a.gaussian()).toBe(boxMuller(u1, u2))
    }
    expect(a.uniform()).toBe(b.uniform())
  })

  it('returns the mean exactly when sigma is 0', () => {
    expect(createRng(1).gaussian(2.5, 0)).toBe(2.5)
  })

  it.each([
    [0, -1],
    [0, Number.NaN],
    [0, Number.POSITIVE_INFINITY],
    [Number.NaN, 1],
  ])('rejects mean %s, sigma %s', (mean, sigma) => {
    expect(() => createRng(1).gaussian(mean, sigma)).toThrow(RangeError)
  })
})

describe('gaussian: statistics (fixed seed, so deterministic, not flaky)', () => {
  const n = 100_000

  function sample(mean?: number, sigma?: number): number[] {
    const rng = createRng(2024)
    return Array.from({ length: n }, () => rng.gaussian(mean, sigma))
  }

  function meanAndStd(xs: readonly number[]): { mean: number; std: number } {
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1)
    return { mean, std: Math.sqrt(variance) }
  }

  it('standard normal: mean 0 and standard deviation 1', () => {
    const { mean, std } = meanAndStd(sample())
    // Standard error of the mean: 1 / √n ≈ 0.0032; 0.02 is about 6σ.
    expect(Math.abs(mean)).toBeLessThan(0.02)
    expect(Math.abs(std - 1)).toBeLessThan(0.02)
  })

  it('scales to mean 3 and standard deviation 0.5', () => {
    const { mean, std } = meanAndStd(sample(3, 0.5))
    // Standard error of the mean: 0.5 / √n ≈ 0.0016; 0.01 is about 6σ.
    expect(Math.abs(mean - 3)).toBeLessThan(0.01)
    expect(Math.abs(std - 0.5)).toBeLessThan(0.01)
  })

  it('covers ±1σ and ±2σ in the expected proportions', () => {
    const xs = sample()
    const within = (k: number) => xs.filter((x) => Math.abs(x) < k).length / n
    // Standard normal ±1σ / ±2σ coverage: erf(1/√2) ≈ 0.6827 and erf(√2) ≈ 0.9545,
    // verified independently by the project author. Standard errors of the proportions are
    // ≈ 0.0015 and ≈ 0.0007, so ±0.005 is about 3.4σ and 7.6σ.
    expect(Math.abs(within(1) - 0.6827)).toBeLessThan(0.005)
    expect(Math.abs(within(2) - 0.9545)).toBeLessThan(0.005)
  })
})
