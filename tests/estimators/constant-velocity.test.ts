import { describe, expect, it } from 'vitest'
import { createConstantVelocity } from '../../src/core/estimators/constant-velocity'
import type { GnssMeasurement } from '../../src/core/sensors/measurement'

const fix = (t: number, s: number, speed: number): GnssMeasurement => ({
  kind: 'gnss',
  t,
  s,
  speed,
  reportedSigma: 3,
  reportedSpeedSigma: 0.5,
})

describe('B0 constant velocity', () => {
  it('returns null before the first fix', () => {
    expect(createConstantVelocity().step({ kind: 'accel', t: 0, f: 0 })).toBeNull()
  })

  it('extrapolates the last fix with its speed and grows sigma with the speed error', () => {
    const b0 = createConstantVelocity()
    b0.step(fix(10, -100, 20))
    // 8 s later: s = -100 + 20·8 = 60; σ = √(3² + (0.5·8)²) = 5.
    expect(b0.step({ kind: 'accel', t: 18, f: 5 })).toEqual({ t: 18, s: 60, v: 20, sigmaS: 5 })
  })

  it('restarts from each new fix', () => {
    const b0 = createConstantVelocity()
    b0.step(fix(10, -100, 20))
    expect(b0.step(fix(11, -70, 10))).toMatchObject({ s: -70, v: 10, sigmaS: 3 })
  })
})
