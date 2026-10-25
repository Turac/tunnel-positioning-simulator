import { describe, expect, it } from 'vitest'
import { DEFAULT_ACCELEROMETER } from '../../src/core/sensors/accelerometer'
import { DEFAULT_GNSS } from '../../src/core/sensors/gnss'
import { simulateRun, type RunConfig } from '../../src/core/sim/run'

// Available in Node and browsers; the test tsconfig has neither DOM nor Node types.
declare const structuredClone: <T>(value: T) => T

// 20 m/s, approach 2000 m, tunnel 1000 m, departure 1000 m: runEnd = 200 s.
const CONFIG: RunConfig = {
  map: {
    approachLength: 2000,
    tunnelLength: 1000,
    departureLength: 1000,
    exitS: 500,
    grade: [{ s: -2000, grade: 0 }, { s: 2000, grade: 0.02 }],
  },
  speedProfile: [{ t: 0, v: 20 }, { t: 300, v: 20 }],
  accelerometer: DEFAULT_ACCELEROMETER,
  gnss: DEFAULT_GNSS,
}

describe('simulateRun', () => {
  const run = simulateRun(CONFIG, 42)

  it('returns plain data that survives structuredClone', () => {
    expect(structuredClone(run)).toEqual(run)
  })

  it('samples the truth on the accelerometer grid from s = -approachLength to the run end', () => {
    expect(run.truth.runEnd).toBe(200)
    expect(run.truth.samples).toHaveLength(20001)
    expect(run.truth.samples[0]).toMatchObject({ t: 0, s: -2000, v: 20 })
    expect(run.truth.samples[20000]).toMatchObject({ t: 200, s: 2000 })
    expect([run.truth.entryTime, run.truth.exitTime]).toEqual([100, 150])
  })

  it('merges measurements in time order, accelerometer first at equal t', () => {
    const accel = run.measurements.filter((m) => m.kind === 'accel')
    expect(accel).toHaveLength(20001)
    for (let i = 1; i < run.measurements.length; i++) {
      expect(run.measurements[i]!.t).toBeGreaterThanOrEqual(run.measurements[i - 1]!.t)
    }
    const firstAtOne = run.measurements.findIndex((m) => m.t === 1)
    expect(run.measurements[firstAtOne]!.kind).toBe('accel')
    expect(run.measurements[firstAtOne + 1]).toMatchObject({ kind: 'gnss', t: 1 })
  })

  it('is deterministic for a seed', () => {
    expect(simulateRun(CONFIG, 42)).toEqual(run)
    expect(simulateRun(CONFIG, 43).measurements).not.toEqual(run.measurements)
  })
})
