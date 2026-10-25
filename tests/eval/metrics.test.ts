import { describe, expect, it } from 'vitest'
import type { Estimate } from '../../src/core/estimators/estimator'
import { computeMetrics } from '../../src/core/eval/metrics'
import { createTunnelMap } from '../../src/core/map/tunnel'
import type { RunResult } from '../../src/core/sim/run'

// Truth at 1 Hz, 10 m/s: s_k = −500 + 10k, k = 0..200. Tunnel [0, 1000] is k = 50..150;
// exit at s = 600, announcement points at s = 200 (k = 70) and s = 500 (k = 100).
const map = createTunnelMap({
  approachLength: 500,
  tunnelLength: 1000,
  departureLength: 500,
  exitS: 600,
  grade: [{ s: -500, grade: 0 }, { s: 1500, grade: 0 }],
})
const truthS = (k: number): number => -500 + 10 * k
const run: RunResult = {
  map,
  truth: {
    samples: Array.from({ length: 201 }, (_, k) => ({ t: k, s: truthS(k), v: 10, a: 0, theta: 0 })),
    rateHz: 1,
    entryTime: 50,
    exitTime: 150,
    runEnd: 200,
  },
  measurements: [160, 170].map((t) => ({
    kind: 'gnss' as const,
    t,
    s: truthS(t),
    speed: 10,
    reportedSigma: 2,
    reportedSpeedSigma: 0.5,
  })),
}

const estimates = (offset: (k: number) => number, sigma: (k: number) => number): Estimate[] =>
  run.truth.samples.map((x, k) => ({ t: x.t, s: x.s + offset(k), v: 10, sigmaS: sigma(k) }))

describe('computeMetrics', () => {
  // +25 m ahead, a 40 m spike at k = 120, back to +2 m from k = 161; σ = 10 m before
  // k = 100 (2σ < 25: not covered), 20 m from k = 100 (2σ = 40 ≥ 40: covered, inclusive).
  const ahead = computeMetrics(
    run,
    estimates(
      (k) => (k === 120 ? 40 : k >= 161 ? 2 : 25),
      (k) => (k < 100 ? 10 : 20),
    ),
  )

  it('measures the error at the tunnel exit and the largest error inside', () => {
    expect(ahead.exitError).toBe(25)
    expect(ahead.maxTunnelError).toBe(40)
  })

  it('counts the in-tunnel fraction within ±2σ, boundary included', () => {
    expect(ahead.coverage).toBe(51 / 101)
  })

  it('reports an estimate ahead of the truth as an early announcement', () => {
    // ŝ = s + 25 reaches 200 at k = 68 (s = 180): 20 m and 2 s early; 500 at k = 98.
    expect(ahead.announcements).toEqual([
      { lead: 400, distanceError: -20, timeError: -2 },
      { lead: 100, distanceError: -20, timeError: -2 },
    ])
  })

  it('measures the GNSS return jump and the recovery time from the first fix', () => {
    // k = 161: Δŝ = (s + 2) − (s − 10 + 25) = −13 against v̂·Δt = 10 → 23 m.
    // Last error ≥ 5 m at k = 160, first fix after the exit at t = 160 → 1 s.
    expect(ahead.returnJump).toBe(23)
    expect(ahead.recoveryTime).toBe(1)
  })

  it('reports a lagging estimate as late, a stuck one as missed and not recovered', () => {
    const behind = computeMetrics(run, estimates(() => -25, () => 10))
    // ŝ = s − 25 reaches 200 at k = 73 (s = 230): 30 m and 3 s late.
    expect(behind.announcements[0]).toEqual({ lead: 400, distanceError: 30, timeError: 3 })

    const stuck = computeMetrics(run, estimates((k) => -10 * k, () => 10))
    expect(stuck.announcements[0]).toEqual({ lead: 400, distanceError: null, timeError: null })
    expect(stuck.recoveryTime).toBeNull()
  })
})
