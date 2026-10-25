// One run for the visual simulator: truth, measurements, and per estimator its estimates,
// errors, metrics and announcement events. See ADR-0019.
//
// Estimators still see only the map and the measurements; truth is paired with them here,
// in eval/, so the UI only draws. The result is plain data.

import { runEstimator, type Estimate, type EstimatorEntry } from '../estimators/estimator'
import type { AccelMeasurement, GnssMeasurement } from '../sensors/measurement'
import { simulateRun, type RunConfig, type RunTruth } from '../sim/run'
import type { TunnelMap } from '../map/tunnel'
import { announcementEvents, computeMetrics, type AnnouncementEvent, type RunMetrics } from './metrics'

/** A GNSS fix with the truth at its time. */
export interface GnssFixView extends GnssMeasurement {
  /** Fix position minus true position, m. */
  readonly positionError: number
  /** True speed at the fix time, m/s. */
  readonly trueSpeed: number
}

export interface EstimatorTrack {
  readonly id: string
  /** Output at each truth sample (same index); null before the first fix. */
  readonly estimates: readonly (Estimate | null)[]
  /** ŝ − s at each truth sample, m; null where there is no estimate. */
  readonly errors: readonly (number | null)[]
  readonly metrics: RunMetrics
  readonly announcements: readonly AnnouncementEvent[]
}

export interface SingleRunResult {
  readonly map: TunnelMap
  readonly truth: RunTruth
  readonly accel: readonly AccelMeasurement[]
  readonly gnss: readonly GnssFixView[]
  /** Time of the first GNSS fix after the exit, s; null if none. */
  readonly reacquisitionTime: number | null
  readonly tracks: readonly EstimatorTrack[]
}

export function runSingle(
  config: RunConfig,
  seed: number,
  estimators: readonly EstimatorEntry[],
): SingleRunResult {
  const run = simulateRun(config, seed)
  const { samples, rateHz } = run.truth

  const accel: AccelMeasurement[] = []
  const gnss: GnssFixView[] = []
  for (const m of run.measurements) {
    if (m.kind === 'accel') {
      accel.push(m)
      continue
    }
    // GNSS fixes lie on the accelerometer grid (1 Hz fixes, 100 Hz samples).
    const truth = samples[Math.round(m.t * rateHz)]
    if (!truth || Math.abs(truth.t - m.t) > 1e-9) {
      throw new RangeError(`GNSS fix at t = ${m.t} s is not on the truth grid`)
    }
    gnss.push({ ...m, positionError: m.s - truth.s, trueSpeed: truth.v })
  }

  const tracks = estimators.map((entry): EstimatorTrack => {
    const estimates = runEstimator(entry, run.map, run.measurements)
    return {
      id: entry.id,
      estimates,
      errors: estimates.map((e, k) => (e === null ? null : e.s - samples[k]!.s)),
      metrics: computeMetrics(run, estimates),
      announcements: announcementEvents(run, estimates),
    }
  })

  return {
    map: run.map,
    truth: run.truth,
    accel,
    gnss,
    reacquisitionTime: gnss.find((f) => f.t > run.truth.exitTime)?.t ?? null,
    tracks,
  }
}
