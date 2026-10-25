// A2: extended Kalman filter with state [s, v, b] (position, speed, accelerometer bias).
// See ADR-0013.
//
// Prediction at each accelerometer sample with â = f − g·sin θ(ŝ) − b. GNSS position and
// speed are separate scalar updates with R from the reported accuracies, each behind a
// χ² gate. Inside the tunnel there are no GNSS updates and the uncertainty grows; a
// zero-velocity update (ZUPT) holds the speed near 0 while the car stands still (ADR-0015).

import { gradeSlopeAt, pitchAt, type TunnelMap } from '../map/tunnel'
import { STANDARD_GRAVITY } from '../physics/constants'
import type { GnssMeasurement, Measurement } from '../sensors/measurement'
import { clampToRoad, type Estimate, type Estimator, type EstimatorEntry } from './estimator'
import { INITIAL_BIAS_SIGMA, VELOCITY_RANDOM_WALK } from './sensor-model'

/** Bias random-walk intensity, (m/s²)²/s (A-52). */
export const BIAS_RANDOM_WALK = 8.0e-8

/** χ² with 1 degree of freedom at 99 %: each scalar update is gated separately (A-55). */
export const GATE = 6.63

/** Consecutive rejected position fixes before P_ss is widened to accept the next (A-55). */
export const REJECTIONS_BEFORE_WIDENING = 3

/** ZUPT detector window, s (A-56). */
export const ZUPT_WINDOW = 0.5

/**
 * ZUPT threshold on the standard deviation of f over the window, m/s² (A-56): the vibration
 * RMS at 1 m/s from σ(v) = 0.2 + 0.03·v (A-32). Below about 1 m/s the car looks stationary.
 */
export const ZUPT_THRESHOLD = 0.2 + 0.03 * 1

/**
 * 1σ of the zero-velocity pseudo-measurement, m/s (A-56). The detector only knows that the
 * speed is below about 1 m/s, not that it is exactly 0, so the measurement claims no more.
 */
export const ZUPT_SIGMA = 0.5

/**
 * The detector must hold this long before the first ZUPT, and ZUPTs are then applied at
 * most once per this interval, s (A-56). Repeating the same information at every sample
 * would make the filter falsely certain; the hold skips brief dips below 1 m/s when the
 * car starts or stops.
 */
export const ZUPT_INTERVAL = 1

export interface KalmanConfig {
  /** Extra velocity random-walk intensity for unmodelled effects, (m/s²)²·s (A-53). */
  readonly qExtra: number
  /** Scale on the reported GNSS position σ, for the time-correlated GNSS error (A-54). */
  readonly gnssRScale: number
}

export const DEFAULT_KALMAN: KalmanConfig = { qExtra: 0, gnssRScale: 1 }

const S = 0
const V = 1
const B = 2

export function createKalman(map: TunnelMap, config: KalmanConfig = DEFAULT_KALMAN): Estimator {
  let x: number[] | null = null
  let P: number[][] = []
  let t = 0
  let rejections = 0
  // Recent accelerometer samples for the stationarity test, oldest first.
  const window: { t: number; f: number }[] = []
  let firstAccel: number | null = null
  // Start of the current stationary stretch and time of the last ZUPT.
  let stillSince: number | null = null
  let lastZupt = -Infinity

  function predict(f: number, dt: number): void {
    const xs = x!
    const s = clampToRoad(map, xs[S]!)
    const theta = pitchAt(map, s)
    const a = f - STANDARD_GRAVITY * Math.sin(theta) - xs[B]!
    // ∂â/∂s = −g·cos θ·dθ/ds with dθ/ds = (d grade/ds)/(1 + grade²); 0 off the road.
    const onRoad = s === xs[S]
    const grade = Math.tan(theta)
    const J = onRoad ? (-STANDARD_GRAVITY * Math.cos(theta) * gradeSlopeAt(map, s)) / (1 + grade * grade) : 0

    xs[S] = xs[S]! + xs[V]! * dt + 0.5 * a * dt * dt
    xs[V] = xs[V]! + a * dt

    const F = [
      [1 + 0.5 * J * dt * dt, dt, -0.5 * dt * dt],
      [J * dt, 1, -dt],
      [0, 0, 1],
    ]
    P = mul(mul(F, P), transpose(F))
    // Velocity random walk (white noise plus the unmodelled margin) and bias random walk.
    // Cross terms of the bias walk are O(dt²) at 100 Hz and are left out.
    const q = VELOCITY_RANDOM_WALK + config.qExtra
    P[S]![S]! += (q * dt ** 3) / 3
    P[S]![V]! += (q * dt * dt) / 2
    P[V]![S]! += (q * dt * dt) / 2
    P[V]![V]! += q * dt
    P[B]![B]! += BIAS_RANDOM_WALK * dt
  }

  /** True when the window spans ZUPT_WINDOW and the spread of f is below ZUPT_THRESHOLD. */
  function stationary(m: { t: number; f: number }): boolean {
    firstAccel ??= m.t
    window.push(m)
    while (window[0]!.t <= m.t - ZUPT_WINDOW) window.shift()
    if (m.t - firstAccel < ZUPT_WINDOW) return false
    const mean = window.reduce((sum, w) => sum + w.f, 0) / window.length
    const variance = window.reduce((sum, w) => sum + (w.f - mean) ** 2, 0) / (window.length - 1)
    return Math.sqrt(variance) < ZUPT_THRESHOLD
  }

  /** Scalar update of state i; returns false if the gate rejects it. */
  function update(i: number, z: number, R: number, widen: boolean, gated = true): boolean {
    const xs = x!
    const nu = z - xs[i]!
    if (widen) P[i]![i] = Math.max(P[i]![i]!, (nu * nu) / GATE - R)
    const Sinn = P[i]![i]! + R
    if (gated && (nu * nu) / Sinn > GATE * (1 + 1e-12)) return false
    const K = P.map((row) => row[i]! / Sinn)
    for (let j = 0; j < 3; j++) xs[j] = xs[j]! + K[j]! * nu
    const Pi = [...P[i]!]
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) P[j]![k] = P[j]![k]! - K[j]! * Pi[k]!
    return true
  }

  function fix(m: GnssMeasurement): void {
    const R = (config.gnssRScale * m.reportedSigma) ** 2
    if (x === null) {
      x = [m.s, m.speed, 0]
      P = [
        [R, 0, 0],
        [0, m.reportedSpeedSigma ** 2, 0],
        [0, 0, INITIAL_BIAS_SIGMA ** 2],
      ]
      t = m.t
      return
    }
    const widen = rejections + 1 >= REJECTIONS_BEFORE_WIDENING
    if (update(S, m.s, R, false) || (widen && update(S, m.s, R, true))) rejections = 0
    else rejections++
    update(V, m.speed, m.reportedSpeedSigma ** 2, false)
  }

  return {
    step(m: Measurement): Estimate | null {
      if (m.kind === 'gnss') fix(m)
      else if (x !== null) {
        predict(m.f, m.t - t)
        t = m.t
      }
      // The window keeps filling before the first fix, so a car that starts standing still
      // is recognised at once.
      if (m.kind === 'accel') {
        stillSince = stationary(m) ? (stillSince ?? m.t) : null
        // 1e-9 s absorbs rounding in differences of grid times.
        const due = (since: number) => m.t - since >= ZUPT_INTERVAL - 1e-9
        if (x !== null && stillSince !== null && due(stillSince) && due(lastZupt)) {
          update(V, 0, ZUPT_SIGMA ** 2, false, false)
          lastZupt = m.t
        }
      }
      if (x === null) return null
      return { t: m.t, s: x[S]!, v: x[V]!, sigmaS: Math.sqrt(P[S]![S]!), bias: x[B]! }
    },
  }
}

export const KALMAN: EstimatorEntry = { id: 'A2', create: (map) => createKalman(map) }

function mul(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0]!.map((_, j) => row.reduce((sum, aik, k) => sum + aik * b[k]![j]!, 0)))
}

function transpose(a: number[][]): number[][] {
  return a[0]!.map((_, j) => a.map((row) => row[j]!))
}
