import { describe, expect, it } from 'vitest'
import { ticks } from '../../src/ui/lib/scale'

describe('ticks', () => {
  it('keeps several ticks when rounding the step up would leave only one', () => {
    // A span of 80 at count 4: raw step 20.05; rounding up to 50 left only 0.
    expect(ticks([-30.24, 49.97], 4)).toEqual([-20, 0, 20, 40])
  })

  it('uses round steps covering the domain', () => {
    expect(ticks([0, 206], 10)).toEqual([0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200])
    expect(ticks([-42.5, 42.5], 4)).toEqual([-40, -20, 0, 20, 40])
  })

  it('returns the single value of an empty domain', () => {
    expect(ticks([3, 3])).toEqual([3])
  })
})
