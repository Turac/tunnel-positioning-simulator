import { describe, expect, it } from 'vitest'
import type { Estimate, Estimator } from '../../src/core/estimators/estimator'
import { createKalman, GATE } from '../../src/core/estimators/kalman'
import { createTunnelMap } from '../../src/core/map/tunnel'

// Flat road, car at a constant 20 m/s; the accelerometer reads a constant bias of
// 0.05 m/s² plus the 25 Hz vibration at 20 m/s (RMS 0.8 m/s², A-32), so the ZUPT detector
// sees a moving car. GNSS fixes are exact unless an offset is given.
const map = createTunnelMap({
  approachLength: 3000,
  tunnelLength: 1000,
  departureLength: 1000,
  exitS: 500,
  grade: [{ s: -3000, grade: 0 }, { s: 2000, grade: 0 }],
})
const BIAS = 0.05
const R_SIGMA = 2
const moving = (t: number): number => BIAS + Math.SQRT2 * 0.8 * Math.sin(2 * Math.PI * 25 * t + 0.3)

function drive(a2: Estimator, from: number, to: number, offset: (t: number) => number = () => 0): Estimate {
  let last: Estimate | null = null
  for (let k = from * 100 + 1; k <= to * 100; k++) {
    const t = k / 100
    last = a2.step({ kind: 'accel', t, f: moving(t) })
    if (k % 100 === 0) {
      a2.step({
        kind: 'gnss',
        t,
        s: -3000 + 20 * t + offset(t),
        speed: 20,
        reportedSigma: R_SIGMA,
        reportedSpeedSigma: 0.5,
      })
    }
  }
  return last!
}

function converged(): Estimator {
  const a2 = createKalman(map)
  a2.step({ kind: 'gnss', t: 0, s: -3000, speed: 20, reportedSigma: R_SIGMA, reportedSpeedSigma: 0.5 })
  drive(a2, 0, 100)
  return a2
}

describe('A2 Kalman filter', () => {
  it('learns a constant bias from GNSS before the tunnel', () => {
    const a2 = createKalman(map)
    a2.step({ kind: 'gnss', t: 0, s: -3000, speed: 20, reportedSigma: R_SIGMA, reportedSpeedSigma: 0.5 })
    const e = drive(a2, 0, 100)
    expect(e.bias).toBeCloseTo(BIAS, 3)
    expect(e.s).toBeCloseTo(-3000 + 20 * 100, 1)
  })

  it('rejects a single 50 m outlier', () => {
    const a2 = converged()
    const e = drive(a2, 100, 102, (t) => (t === 101 ? 50 : 0))
    expect(e.s).toBeCloseTo(-3000 + 20 * 102, 1)
  })

  it('after 3 rejected fixes widens P_ss to the gate and weights the fix, then counts again', () => {
    const a2 = converged()
    // Two rejected fixes at +60 m, then the third: just before it, the estimate is e.
    expect(drive(a2, 100, 102, () => 60).s).toBeCloseTo(-3000 + 20 * 102, 1) // rejected
    drive(a2, 102, 102.99)
    const before = a2.step({ kind: 'accel', t: 103, f: moving(103) })!
    const z = -3000 + 20 * 103 + 60
    const after = a2.step({ kind: 'gnss', t: 103, s: z, speed: 20, reportedSigma: R_SIGMA, reportedSpeedSigma: 0.5 })!
    const nu = z - before.s
    const R = R_SIGMA ** 2
    const P = Math.max(before.sigmaS ** 2, (nu * nu) / GATE - R)
    // Speed update after the position update moves s only a little (small cross term).
    expect(after.s).toBeCloseTo(before.s + (P / (P + R)) * nu, 0)
    // K = 1 − GATE·R/ν² ≈ 0.993: accepted with the filter's own weight, not adopted.
    expect(after.s).toBeGreaterThan(before.s + 50)
    expect(after.s).toBeLessThan(z)

    // The counter restarted: a single far outlier right after is rejected.
    const next = drive(a2, 103, 104, () => 500)
    expect(next.s).toBeLessThan(after.s + 25)
  })
})

describe('A2 zero-velocity update', () => {
  // Vibration with RMS σ(v) = 0.2 + 0.03·v at 25 Hz, as in A-32, plus the bias. One fix
  // at t = 0 with a speed error, then no GNSS (inside the tunnel) for 5 s.
  function coast(v: number, fixSpeed: number): Estimate {
    const a2 = createKalman(map)
    a2.step({ kind: 'gnss', t: 0, s: 0, speed: fixSpeed, reportedSigma: 2, reportedSpeedSigma: 0.5 })
    const amplitude = Math.SQRT2 * (0.2 + 0.03 * v)
    let last: Estimate | null = null
    for (let k = 1; k <= 500; k++) {
      const t = k / 100
      last = a2.step({ kind: 'accel', t, f: BIAS + amplitude * Math.sin(2 * Math.PI * 25 * t + 0.3) })
    }
    return last!
  }

  it('holds a standing car at zero speed', () => {
    expect(Math.abs(coast(0, 0.5).v)).toBeLessThan(0.01)
  })

  it('does not fire at 20 m/s', () => {
    expect(coast(20, 20).v).toBeGreaterThan(19)
  })

  it('fails on purpose for a car crawling at 0.5 m/s: it is taken as standing', () => {
    expect(Math.abs(coast(0.5, 0.5).v)).toBeLessThan(0.05)
  })
})
