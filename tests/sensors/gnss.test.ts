import { describe, expect, it } from 'vitest'
import { createTunnelMap } from '../../src/core/map/tunnel'
import { DEFAULT_GNSS, simulateGnss, type GnssConfig } from '../../src/core/sensors/gnss'
import type { GnssMeasurement } from '../../src/core/sensors/measurement'
import { createSpeedProfile } from '../../src/core/world/speed-profile'
import { createTrajectory, truthAt, type Trajectory } from '../../src/core/world/trajectory'

// 20 m/s on a flat road. Approach 2000 m: at s = 0 exactly at t = 100 s. Departure 3000 m.
function cruise(tunnelLength = 1000, approachLength = 2000): Trajectory {
  const map = createTunnelMap({
    approachLength,
    tunnelLength,
    departureLength: 3000,
    exitS: 500,
    grade: [{ s: -approachLength, grade: 0 }, { s: tunnelLength + 3000, grade: 0 }],
  })
  return createTrajectory(map, createSpeedProfile([{ t: 0, v: 20 }, { t: 1000, v: 20 }]))
}

const QUIET: GnssConfig = {
  ...DEFAULT_GNSS,
  positionSigma: 0,
  speedSigma: 0,
  reacquisitionSigma: 0,
  reacquisitionDelayMin: 0,
  reacquisitionDelayMax: 0,
}

function positionErrors(traj: Trajectory, fixes: GnssMeasurement[]): Map<number, number> {
  return new Map(fixes.map((m) => [m.t, m.s - truthAt(traj, m.t).s]))
}

function variance(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
}

describe('open-sky position error (Gauss–Markov, σ = 2 m, τ = 60 s)', () => {
  const traj = cruise()
  const config = { ...DEFAULT_GNSS, speedSigma: 0 }
  const runs = Array.from({ length: 500 }, (_, seed) =>
    positionErrors(traj, simulateGnss(traj, config, seed)),
  )
  const at = (t: number) => runs.map((e) => e.get(t)!)

  it('is stationary: variance σ² = 4 m² from the first fix on', () => {
    // 500 seeds: relative standard error of a variance ≈ √(2/500) ≈ 6 %.
    expect(variance(at(0)) / 4).toBeGreaterThan(0.8)
    expect(variance(at(0)) / 4).toBeLessThan(1.2)
    expect(variance(at(90)) / 4).toBeGreaterThan(0.8)
    expect(variance(at(90)) / 4).toBeLessThan(1.2)
  })

  it('has correlation e^(−Δt/τ): ≈ 0.37 at a lag of 60 s', () => {
    const a = at(20)
    const b = at(80)
    const corr = a.reduce((sum, x, i) => sum + x * b[i]!, 0) / a.length / 4
    expect(corr).toBeGreaterThan(0.27)
    expect(corr).toBeLessThan(0.47)
  })
})

describe('tunnel outage and reacquisition', () => {
  const traj = cruise() // entry 100 s (s = 0), exit 150 s (s = 1000), run end 300 s

  it('publishes no fix while 0 <= s <= L, including both portals', () => {
    const times = simulateGnss(traj, QUIET, 1).map((m) => m.t)
    expect(times).toContain(99)
    expect(times).not.toContain(100) // s = 0
    expect(times).not.toContain(150) // s = L
    expect(times.filter((t) => t >= 100 && t <= 150)).toEqual([])
  })

  it('with zero delay the first fix after the tunnel is the first one outside: t = 151 s', () => {
    const times = simulateGnss(traj, QUIET, 1).map((m) => m.t)
    expect(times.find((t) => t > 99)).toBe(151)
  })

  it('the first fix comes exactly at exitTime + d when that is on the grid (d = 5 s)', () => {
    const fixed = { ...QUIET, reacquisitionDelayMin: 5, reacquisitionDelayMax: 5 }
    const times = simulateGnss(traj, fixed, 1).map((m) => m.t)
    expect(times.find((t) => t > 99)).toBe(155)
  })

  it('the extra error decays with time since reacquisition: reported σ = 0.5·20·e^(−Δt/10)', () => {
    const config = { ...QUIET, reacquisitionSigma: 20, reacquisitionDelayMin: 5, reacquisitionDelayMax: 5 }
    const fixes = simulateGnss(traj, config, 1)
    const after = (t: number) => fixes.find((m) => m.t === t)!
    expect(after(155).reportedSigma).toBeCloseTo(10, 12)
    expect(after(165).reportedSigma).toBeCloseTo(10 * Math.exp(-1), 12)
    expect(after(99).reportedSigma).toBe(0) // before the tunnel: no extra error
  })

  it('the first fix after reacquisition has error σ ≈ σ_r = 20 m', () => {
    const config = { ...QUIET, reacquisitionSigma: 20, reacquisitionDelayMin: 5, reacquisitionDelayMax: 5 }
    const first = Array.from({ length: 500 }, (_, seed) =>
      positionErrors(traj, simulateGnss(traj, config, seed)).get(155)!,
    )
    expect(variance(first) / 400).toBeGreaterThan(0.8)
    expect(variance(first) / 400).toBeLessThan(1.2)
  })
})

describe('speed', () => {
  it('is clamped to >= 0 at standstill', () => {
    const map = createTunnelMap({
      approachLength: 200,
      tunnelLength: 1000,
      departureLength: 100,
      exitS: 500,
      grade: [{ s: -200, grade: 0 }, { s: 1100, grade: 0 }],
    })
    // Standing for 60 s at the road start, then 20 m/s.
    const traj = createTrajectory(
      map,
      createSpeedProfile([{ t: 0, v: 0 }, { t: 60, v: 0 }, { t: 61, v: 20 }, { t: 200, v: 20 }]),
    )
    const standing = simulateGnss(traj, DEFAULT_GNSS, 3).filter((m) => m.t <= 60)
    expect(standing.every((m) => m.speed >= 0)).toBe(true)
    expect(standing.some((m) => m.speed === 0)).toBe(true)
  })
})

describe('determinism and publication independence', () => {
  it('same seed gives identical output', () => {
    const traj = cruise()
    expect(simulateGnss(traj, DEFAULT_GNSS, 42)).toEqual(simulateGnss(traj, DEFAULT_GNSS, 42))
  })

  it('a longer tunnel leaves the error draws at the same absolute time unchanged', () => {
    const short = cruise(1000)
    const long = cruise(2000)
    const config = { ...DEFAULT_GNSS, reacquisitionSigma: 0 }
    const a = positionErrors(short, simulateGnss(short, config, 42))
    const b = positionErrors(long, simulateGnss(long, config, 42))
    const common = [...a.keys()].filter((t) => b.has(t))
    expect(common.length).toBeGreaterThan(150) // approach and after both tunnels
    expect(common.some((t) => t > 250)).toBe(true) // includes fixes after the long tunnel
    for (const t of common) expect(b.get(t)).toBe(a.get(t))
  })
})

describe('exit jump (off by default)', () => {
  it('offsets only the fixes in [t_reacq, t_reacq + duration) and leaves the reported σ', () => {
    // Exit at t = 150 s, delay 3 s → t_reacq = 153 s; jump on the fixes at 153..157 s.
    const traj = cruise()
    const base = { ...QUIET, reacquisitionDelayMin: 3, reacquisitionDelayMax: 3 }
    const plain = simulateGnss(traj, base, 1)
    const jumped = simulateGnss(traj, { ...base, exitJumpOffset: 30, exitJumpDuration: 5 }, 1)
    const offsets = jumped.map((m, i) => [m.t, m.s - plain[i]!.s])
    expect(offsets.filter(([, d]) => d !== 0)).toEqual([153, 154, 155, 156, 157].map((t) => [t, 30]))
    expect(jumped.map((m) => m.reportedSigma)).toEqual(plain.map((m) => m.reportedSigma))
  })
})
