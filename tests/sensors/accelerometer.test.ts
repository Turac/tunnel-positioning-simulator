import { describe, expect, it } from 'vitest'
import { createTunnelMap } from '../../src/core/map/tunnel'
import { STANDARD_GRAVITY } from '../../src/core/physics/constants'
import {
  DEFAULT_ACCELEROMETER,
  simulateAccelerometer,
  specificForce,
  type AccelerometerConfig,
} from '../../src/core/sensors/accelerometer'
import { createSpeedProfile, type SpeedKeypoint } from '../../src/core/world/speed-profile'
import { createTrajectory, truthAt, type Trajectory } from '../../src/core/world/trajectory'

const OFF: AccelerometerConfig = {
  ...DEFAULT_ACCELEROMETER,
  noiseDensity: 0,
  turnOnBiasSigma: 0,
  biasDriftQ: 0,
  vibrationSigma0: 0,
  vibrationSlope: 0,
}

// Flat 1300 m road (approach 200, tunnel 1000, departure 100).
function trajectory(keypoints: SpeedKeypoint[], grade = 0): Trajectory {
  const map = createTunnelMap({
    approachLength: 200,
    tunnelLength: 1000,
    departureLength: 100,
    exitS: 500,
    grade: [{ s: -200, grade }, { s: 1100, grade }],
  })
  return createTrajectory(map, createSpeedProfile(keypoints))
}

const cruise = trajectory([{ t: 0, v: 20 }, { t: 100, v: 20 }]) // runEnd 65 s

/** Measured minus ideal specific force, per sample. */
function errors(traj: Trajectory, config: AccelerometerConfig, seed: number): number[] {
  return simulateAccelerometer(traj, config, seed).map((m) => {
    const truth = truthAt(traj, m.t)
    return m.f - specificForce(truth.a, truth.theta, config.pitchMisalignment)
  })
}

function variance(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length
}

describe('specific force', () => {
  it('a car standing on a 4 % uphill reads +g·sin(atan 0.04) ≈ +0.392 m/s², downhill negative', () => {
    // sin(atan 0.04) = 0.04 / √1.0016 = 0.0399680; times 9.80665 = 0.391953.
    expect(specificForce(0, Math.atan(0.04))).toBeCloseTo(0.391953, 6)
    expect(specificForce(0, Math.atan(-0.04))).toBeCloseTo(-0.391953, 6)
  })

  it('pitch misalignment: a·cos δ + g·sin(θ + δ)', () => {
    // a = 1, θ = 0, δ = 0.05 rad: cos 0.05 + 9.80665·sin 0.05 = 0.998750 + 0.490129.
    expect(specificForce(1, 0, 0.05)).toBeCloseTo(1.488879, 5)
  })

  it('uses standard gravity 9.80665 m/s²', () => {
    expect(STANDARD_GRAVITY).toBe(9.80665)
  })
})

describe('with all errors off', () => {
  it('reports the ideal specific force at t = k / rateHz up to the run end', () => {
    const traj = trajectory([{ t: 0, v: 0 }, { t: 20, v: 20 }, { t: 100, v: 20 }], 0.04)
    const out = simulateAccelerometer(traj, OFF, 1)
    expect(out).toHaveLength(Math.floor(traj.runEnd * 100) + 1)
    expect(out[150]!.t).toBe(1.5)
    // During the 1 m/s² ramp on a 4 % grade: f = 1 + g·sin(atan 0.04).
    expect(out[150]!.f).toBeCloseTo(1 + 0.391953, 6)
  })

  it('applies the scale-factor error to the specific force', () => {
    const traj = trajectory([{ t: 0, v: 0 }, { t: 100, v: 50 }]) // a = 0.5 m/s², flat
    expect(simulateAccelerometer(traj, { ...OFF, scaleFactorError: 0.004 }, 1)[10]!.f).toBe(
      1.004 * 0.5,
    )
  })
})

describe('error terms', () => {
  it('white noise σ = density·√(rateHz/2) ≈ 0.0111 m/s²', () => {
    const e = errors(cruise, { ...OFF, noiseDensity: DEFAULT_ACCELEROMETER.noiseDensity }, 7)
    expect(Math.sqrt(variance(e))).toBeCloseTo(160e-6 * STANDARD_GRAVITY * Math.sqrt(50), 3)
  })

  it('turn-on bias is constant within a run', () => {
    const e = errors(cruise, { ...OFF, turnOnBiasSigma: 0.1 }, 7)
    expect(new Set(e).size).toBe(1)
    expect(e[0]).not.toBe(0)
  })

  it('a fixed turn-on bias replaces the drawn one and leaves the other terms unchanged', () => {
    const drawn = errors(cruise, { ...DEFAULT_ACCELEROMETER }, 7)
    const fixed = errors(cruise, { ...DEFAULT_ACCELEROMETER, turnOnBiasFixed: 0.05 }, 7)
    const offset = fixed[0]! - drawn[0]!
    expect(offset).not.toBe(0)
    fixed.forEach((x, k) => expect(x - drawn[k]!).toBeCloseTo(offset, 12))
    expect(new Set(errors(cruise, { ...OFF, turnOnBiasFixed: 0.05 }, 7))).toEqual(new Set([0.05]))
  })

  it('bias drift variance at t = 10 s is q·t at 50, 100 and 200 Hz', () => {
    const q = 1e-4
    const fast = trajectory([{ t: 0, v: 50 }, { t: 100, v: 50 }]) // runEnd 26 s keeps this quick
    for (const rateHz of [50, 100, 200]) {
      const at10 = Array.from({ length: 400 }, (_, seed) => {
        const e = errors(fast, { ...OFF, rateHz, biasDriftQ: q, vibrationFrequencyHz: 10 }, seed)
        return e[10 * rateHz]!
      })
      // 400 seeds: relative standard error of a variance ≈ √(2/400) ≈ 7 %.
      expect(variance(at10) / (q * 10)).toBeGreaterThan(0.75)
      expect(variance(at10) / (q * 10)).toBeLessThan(1.25)
    }
  })

  it('vibration variance follows σ(v)²: 0.2² at standstill, 0.8² at 20 m/s', () => {
    const traj = trajectory([{ t: 0, v: 0 }, { t: 30, v: 0 }, { t: 31, v: 20 }, { t: 200, v: 20 }])
    const vib = { ...OFF, vibrationSigma0: 0.2, vibrationSlope: 0.03 }
    const e = errors(traj, vib, 3)
    expect(variance(e.slice(0, 2000))).toBeCloseTo(0.04, 3) // 0-20 s, standing
    expect(variance(e.slice(4000, 6000))).toBeCloseTo(0.64, 2) // 40-60 s, 20 m/s
    expect(variance(errors(traj, OFF, 3).slice(4000, 6000))).toBe(0) // vibration off
  })

  it('integrated vibration gives a bounded velocity error, not a growing one', () => {
    // 5.2 m/s over 1300 m: runEnd = 250 s. Amplitude A = √2·(0.2 + 0.03·5.2) = 0.503 m/s².
    // ∫A·sin(ωt + φ) = A·(cos φ − cos(ωt + φ))/ω stays within 2A/ω = 0.0064 m/s. Its mean
    // A·cos φ/ω is a constant offset, so position drifts linearly by at most 250·A/ω ≈ 0.8 m.
    // White noise of the same σ at 100 Hz would give a random walk in velocity instead.
    const traj = trajectory([{ t: 0, v: 5.2 }, { t: 300, v: 5.2 }])
    const e = errors(traj, { ...OFF, vibrationSigma0: 0.2, vibrationSlope: 0.03 }, 3)
    const A = Math.SQRT2 * (0.2 + 0.03 * 5.2)
    const omega = 2 * Math.PI * 25
    const dt = 0.01
    let v = 0
    let s = 0
    let maxAbsV = 0
    for (const x of e) {
      v += x * dt
      s += v * dt
      maxAbsV = Math.max(maxAbsV, Math.abs(v))
    }
    expect(maxAbsV).toBeLessThan((2 * A) / omega + 0.003) // + discrete-sum slack
    expect(Math.abs(s)).toBeLessThan((250 * A) / omega + 0.5)
  })

  it('rejects a vibration frequency at or above Nyquist', () => {
    expect(() => simulateAccelerometer(cruise, { ...OFF, vibrationFrequencyHz: 50 }, 1)).toThrow(
      /Nyquist/,
    )
  })
})

describe('determinism and stream independence', () => {
  it('same seed gives identical output, another seed differs', () => {
    expect(simulateAccelerometer(cruise, DEFAULT_ACCELEROMETER, 42)).toEqual(
      simulateAccelerometer(cruise, DEFAULT_ACCELEROMETER, 42),
    )
    expect(simulateAccelerometer(cruise, DEFAULT_ACCELEROMETER, 43)).not.toEqual(
      simulateAccelerometer(cruise, DEFAULT_ACCELEROMETER, 42),
    )
  })

  it('switching other terms on does not change the white-noise draws', () => {
    const white = { ...OFF, noiseDensity: DEFAULT_ACCELEROMETER.noiseDensity }
    const others = { ...DEFAULT_ACCELEROMETER, noiseDensity: 0 }
    const whiteOnly = errors(cruise, white, 42)
    const all = simulateAccelerometer(cruise, DEFAULT_ACCELEROMETER, 42)
    const allButWhite = simulateAccelerometer(cruise, others, 42)
    all.forEach((m, k) => {
      expect(m.f - allButWhite[k]!.f).toBeCloseTo(whiteOnly[k]!, 12)
    })
  })
})
