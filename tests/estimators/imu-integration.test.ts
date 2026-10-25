import { describe, expect, it } from 'vitest'
import type { Estimate } from '../../src/core/estimators/estimator'
import { createImuIntegration } from '../../src/core/estimators/imu-integration'
import { createTunnelMap } from '../../src/core/map/tunnel'
import { STANDARD_GRAVITY } from '../../src/core/physics/constants'

const mapWithGrade = (grade: number) =>
  createTunnelMap({
    approachLength: 1000,
    tunnelLength: 1000,
    departureLength: 1000,
    exitS: 500,
    grade: [{ s: -1000, grade }, { s: 2000, grade }],
  })

// Fix at t = 0, then accel samples at 100 Hz with constant f for `seconds`.
function integrate(grade: number, speed: number, f: number, seconds: number): Estimate {
  const a1 = createImuIntegration(mapWithGrade(grade))
  a1.step({ kind: 'gnss', t: 0, s: 0, speed, reportedSigma: 2, reportedSpeedSigma: 0.5 })
  let last: Estimate | null = null
  for (let k = 1; k <= seconds * 100; k++) last = a1.step({ kind: 'accel', t: k / 100, f })
  return last!
}

describe('A1 grade-corrected integration', () => {
  it('returns null before the first fix', () => {
    expect(createImuIntegration(mapWithGrade(0)).step({ kind: 'accel', t: 0, f: 0 })).toBeNull()
  })

  it('integrates a constant acceleration on a flat road', () => {
    // s = 10·4 + ½·1·4² = 48, v = 10 + 1·4 = 14.
    const e = integrate(0, 10, 1, 4)
    expect(e.s).toBeCloseTo(48, 9)
    expect(e.v).toBeCloseTo(14, 9)
  })

  it('removes gravity on a grade: a car standing on 4 % stays put', () => {
    const e = integrate(0.04, 0, STANDARD_GRAVITY * Math.sin(Math.atan(0.04)), 10)
    expect(e.v).toBeCloseTo(0, 12)
    expect(e.s).toBeCloseTo(0, 10)
  })

  it('starts from the reported accuracy and grows with time since the fix', () => {
    const near = integrate(0, 10, 0, 0.01)
    const far = integrate(0, 10, 0, 30)
    expect(near.sigmaS).toBeCloseTo(2, 2)
    expect(far.sigmaS).toBeGreaterThan(near.sigmaS)
  })
})
