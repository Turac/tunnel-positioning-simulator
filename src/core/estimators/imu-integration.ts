// A1: grade-corrected accelerometer integration from the last GNSS fix, without a bias
// estimate. Shows what the Kalman filter (A2) gains by estimating the bias.
//
// At each fix the position and speed restart from the fix. In between,
// â = f − g·sin θ(ŝ) is integrated exactly for a constant â over each sample interval.

import { pitchAt, type TunnelMap } from '../map/tunnel'
import { STANDARD_GRAVITY } from '../physics/constants'
import type { Measurement } from '../sensors/measurement'
import { clampToRoad, type Estimate, type Estimator, type EstimatorEntry } from './estimator'
import { INITIAL_BIAS_SIGMA, VELOCITY_RANDOM_WALK } from './sensor-model'

export function createImuIntegration(map: TunnelMap): Estimator {
  let initialised = false
  let s = 0
  let v = 0
  let t = 0
  // Fix time and reported accuracies, for the uncertainty since the fix.
  let tFix = 0
  let sigmaFix = 0
  let sigmaSpeedFix = 0

  return {
    step(m: Measurement): Estimate | null {
      if (m.kind === 'gnss') {
        initialised = true
        s = m.s
        v = m.speed
        t = tFix = m.t
        sigmaFix = m.reportedSigma
        sigmaSpeedFix = m.reportedSpeedSigma
      } else if (initialised) {
        const dt = m.t - t
        const a = m.f - STANDARD_GRAVITY * Math.sin(pitchAt(map, clampToRoad(map, s)))
        s += v * dt + 0.5 * a * dt * dt
        v += a * dt
        t = m.t
      }
      if (!initialised) return null
      // Independent error terms after Δt: fix position, fix speed·Δt, unknown bias·Δt²/2 and
      // white noise integrated twice (variance VRW·Δt³/3).
      const dt = m.t - tFix
      return {
        t: m.t,
        s,
        v,
        sigmaS: Math.hypot(
          sigmaFix,
          sigmaSpeedFix * dt,
          (INITIAL_BIAS_SIGMA * dt * dt) / 2,
          Math.sqrt((VELOCITY_RANDOM_WALK * dt ** 3) / 3),
        ),
      }
    },
  }
}

export const IMU_INTEGRATION: EstimatorEntry = { id: 'A1', create: createImuIntegration }
