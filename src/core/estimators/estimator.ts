// Common estimator interface. See ADR-0011.
//
// An estimator is created from the known map and then fed measurements one at a time, in
// time order. It never sees a future sample and never receives ground truth (CLAUDE.md hard
// rule 1).

import { roadEnd, roadStart, type TunnelMap } from '../map/tunnel'
import type { Measurement } from '../sensors/measurement'

export interface Estimate {
  readonly t: number
  /** Estimated position along the centerline, m. */
  readonly s: number
  /** Estimated speed, m/s. */
  readonly v: number
  /** The estimator's own 1σ position uncertainty, m. */
  readonly sigmaS: number
  /** Estimated accelerometer bias, m/s² (estimators with a bias state only). */
  readonly bias?: number
}

export interface Estimator {
  /** Consumes one measurement; returns the estimate at its time, or null before the first fix. */
  step(m: Measurement): Estimate | null
}

export interface EstimatorEntry {
  readonly id: string
  create(map: TunnelMap): Estimator
}

/** An estimate can leave the road; map lookups use the nearest point on it. */
export function clampToRoad(map: TunnelMap, s: number): number {
  return Math.min(Math.max(s, roadStart(map)), roadEnd(map))
}

/** Runs an estimator over a measurement stream and returns its output at each accel sample. */
export function runEstimator(
  entry: EstimatorEntry,
  map: TunnelMap,
  measurements: readonly Measurement[],
): (Estimate | null)[] {
  const estimator = entry.create(map)
  const out: (Estimate | null)[] = []
  for (const m of measurements) {
    const estimate = estimator.step(m)
    if (m.kind === 'accel') out.push(estimate)
  }
  return out
}
