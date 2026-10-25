import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  lastSampleIndex,
  sampleTime,
  type AccelMeasurement,
  type GnssMeasurement,
  type Measurement,
} from '../../src/core/sensors/measurement'

describe('sampleTime', () => {
  it('k / rateHz: sample 30 000 at 100 Hz is exactly 300 s', () => {
    expect(sampleTime(30000, 100)).toBe(300)
    expect(sampleTime(0, 100)).toBe(0)
  })

  it('matches k / 100 at every sample, where accumulating 0.01 drifts', () => {
    let accumulated = 0
    let accumulatedMismatches = 0
    for (let k = 1; k <= 30000; k++) {
      accumulated += 0.01
      if (accumulated !== k / 100) accumulatedMismatches++
      expect(sampleTime(k, 100)).toBe(k / 100)
    }
    // Why the index form is needed: the accumulated time is off at most samples.
    expect(accumulatedMismatches).toBe(29975)
    expect(accumulated).toBe(299.99999999987216)
  })

  it('a 100 Hz and a 1 Hz grid coincide exactly at every whole second', () => {
    for (let s = 0; s <= 300; s++) {
      expect(sampleTime(100 * s, 100)).toBe(sampleTime(s, 1))
    }
  })

  it.each([-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejects index %d', (k) => {
    expect(() => sampleTime(k, 100)).toThrow(/Sample index/)
  })

  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY])('rejects rate %d Hz', (rate) => {
    expect(() => sampleTime(1, rate)).toThrow(/Sample rate/)
  })
})

describe('lastSampleIndex', () => {
  it.each([
    [65, 100, 6500],
    [64.999, 100, 6499],
    [0, 100, 0],
    [0.009, 100, 0],
    [0.01, 100, 1],
    [300, 1, 300],
    [300.9, 1, 300],
  ])('tEnd = %d s at %d Hz -> %d', (tEnd, rate, k) => {
    expect(lastSampleIndex(tEnd, rate)).toBe(k)
  })

  it('corrects floor upwards: tEnd = 0.29 at 100 Hz is 29, floor gives 28', () => {
    expect(Math.floor(0.29 * 100)).toBe(28) // the edge case really occurs
    expect(lastSampleIndex(0.29, 100)).toBe(29)
  })

  it('corrects floor downwards: tEnd = 0.049999999999999996 at 100 Hz is 4, floor gives 5', () => {
    expect(Math.floor(0.049999999999999996 * 100)).toBe(5) // the edge case really occurs
    expect(lastSampleIndex(0.049999999999999996, 100)).toBe(4)
  })

  it('satisfies its definition for many end times', () => {
    for (let i = 0; i <= 5000; i++) {
      const tEnd = i * 0.0137
      const k = lastSampleIndex(tEnd, 100)
      expect(sampleTime(k, 100)).toBeLessThanOrEqual(tEnd)
      expect(sampleTime(k + 1, 100)).toBeGreaterThan(tEnd)
    }
  })

  it.each([-0.001, Number.NaN, Number.POSITIVE_INFINITY])('rejects end time %d s', (tEnd) => {
    expect(() => lastSampleIndex(tEnd, 100)).toThrow(/End time/)
  })

  it('rejects an invalid rate', () => {
    expect(() => lastSampleIndex(1, 0)).toThrow(/Sample rate/)
  })
})

describe('Measurement types', () => {
  it('narrow on kind', () => {
    const stream: Measurement[] = [
      { kind: 'accel', t: 0, f: 0.39 },
      { kind: 'gnss', t: 0, s: -200, speed: 20, reportedSigma: 3, reportedSpeedSigma: 0.2 },
    ]
    const accel = stream.filter((m): m is AccelMeasurement => m.kind === 'accel')
    expect(accel.map((m) => m.f)).toEqual([0.39])
    expectTypeOf<Extract<Measurement, { kind: 'gnss' }>>().toEqualTypeOf<GnssMeasurement>()
  })

  it('carry no sample index or ground truth', () => {
    expectTypeOf<keyof AccelMeasurement>().toEqualTypeOf<'kind' | 't' | 'f'>()
    expectTypeOf<keyof GnssMeasurement>().toEqualTypeOf<
      'kind' | 't' | 's' | 'speed' | 'reportedSigma' | 'reportedSpeedSigma'
    >()
  })
})
