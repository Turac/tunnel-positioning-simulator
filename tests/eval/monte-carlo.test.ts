import { describe, expect, it } from 'vitest'
import { CONSTANT_VELOCITY } from '../../src/core/estimators/constant-velocity'
import { percentile, representativeSeed, runMonteCarlo, SEED_SETS, seedsOf, toMarkdown } from '../../src/core/eval/monte-carlo'
import type { RunMetrics } from '../../src/core/eval/metrics'
import { BASELINE } from '../../src/core/scenarios/scenarios'

describe('Monte Carlo', () => {
  it('interpolates percentiles linearly between order statistics', () => {
    // Sorted 1, 2, 3, 4, 10: median = 3; P95 at index 3.8 = 4 + 0.8·(10 − 4) = 8.8.
    expect(percentile([10, 2, 4, 1, 3], 0.5)).toBe(3)
    expect(percentile([10, 2, 4, 1, 3], 0.95)).toBeCloseTo(8.8, 12)
  })

  it('keeps tuning and report seeds disjoint even at the largest set size', () => {
    const tuning = seedsOf('tuning', 1_000_000)
    expect(tuning[tuning.length - 1]).toBeLessThan(seedsOf('report', 1)[0]!)
    expect(() => seedsOf('tuning', 1_000_001)).toThrow(RangeError)
  })

  it('leaves the poor-sensor scenario out of tuning', () => {
    expect(SEED_SETS.tuning.scenarios.map((s) => s.id)).not.toContain('poor-sensor')
    expect(SEED_SETS.report.scenarios.map((s) => s.id)).toContain('poor-sensor')
  })

  it('gives the same table for the same seeds', () => {
    const table = () => toMarkdown(runMonteCarlo([BASELINE], [CONSTANT_VELOCITY], [1, 2]))
    expect(table()).toBe(table())
    expect(table()).toContain('| B0 |')
  })

  it('picks the seed whose exit error is closest to the median, ties to the lower seed', () => {
    const row = (errors: number[]) => ({
      scenario: 's',
      method: 'A2',
      metrics: errors.map((exitError) => ({ exitError }) as RunMetrics),
    })
    // Median of 1, 9, 4, 30, 5 is 5.
    expect(representativeSeed(row([1, 9, 4, 30, 5]), [10, 11, 12, 13, 14])).toBe(14)
    // Median of 2, 6 is 4; both are 2 away, so the lower seed wins.
    expect(representativeSeed(row([6, 2]), [20, 21])).toBe(20)
    expect(() => representativeSeed(row([1]), [1, 2])).toThrow(RangeError)
  })
})
