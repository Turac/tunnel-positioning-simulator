// B0: constant-velocity baseline. See ADR-0011.
//
// After each GNSS fix the position is extrapolated with the fix's speed. The uncertainty
// grows only with the reported speed error, so it ignores speed changes and is deliberately
// over-confident when the car brakes or stops.

import type { Estimate, Estimator, EstimatorEntry } from './estimator'
import type { GnssMeasurement, Measurement } from '../sensors/measurement'

export function createConstantVelocity(): Estimator {
  let fix: GnssMeasurement | null = null

  return {
    step(m: Measurement): Estimate | null {
      if (m.kind === 'gnss') fix = m
      if (fix === null) return null
      const dt = m.t - fix.t
      return {
        t: m.t,
        s: fix.s + fix.speed * dt,
        v: fix.speed,
        sigmaS: Math.hypot(fix.reportedSigma, fix.reportedSpeedSigma * dt),
      }
    },
  }
}

export const CONSTANT_VELOCITY: EstimatorEntry = { id: 'B0', create: createConstantVelocity }
