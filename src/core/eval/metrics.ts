// Per-run metrics: the only place where truth meets estimates. See ADR-0012.

import type { Estimate, EstimatorEntry } from '../estimators/estimator'
import { runEstimator } from '../estimators/estimator'
import type { RunResult } from '../sim/run'

/** Exit announcement lead distances before the exit, m (A-40). */
export const ANNOUNCEMENT_LEADS = [400, 100] as const

/** Position error below which the estimate counts as recovered after the tunnel, m (A-41). */
export const RECOVERY_THRESHOLD = 5

export interface AnnouncementMetric {
  readonly lead: number
  /**
   * True position minus the announcement point when the estimate reaches it, m; negative =
   * early, positive = late. null if the estimate never reaches it.
   */
  readonly distanceError: number | null
  /** Announcement time minus the time the car truly reaches the point, s. null if missed. */
  readonly timeError: number | null
}

/** Where an estimator triggered one exit announcement, as sample indices. */
export interface AnnouncementEvent {
  readonly lead: number
  /** Announcement point exitS − lead, m. */
  readonly target: number
  /** First sample with ŝ ≥ target; null if the estimate never reaches it. */
  readonly kEst: number | null
  /** First sample with true s ≥ target. */
  readonly kTrue: number
}

/** Announcement events at each lead distance (A-40), shared by the metrics and the UI. */
export function announcementEvents(
  run: RunResult,
  estimates: readonly (Estimate | null)[],
): AnnouncementEvent[] {
  const truth = run.truth.samples
  return ANNOUNCEMENT_LEADS.map((lead): AnnouncementEvent => {
    const target = run.map.exitS - lead
    const kEst = estimates.findIndex((e) => e !== null && e.s >= target)
    return { lead, target, kEst: kEst < 0 ? null : kEst, kTrue: truth.findIndex((x) => x.s >= target) }
  })
}

export interface RunMetrics {
  /** |ŝ − s| at the last sample inside the tunnel, m. */
  readonly exitError: number
  /** Largest |ŝ − s| over the samples inside the tunnel, m. */
  readonly maxTunnelError: number
  readonly announcements: readonly AnnouncementMetric[]
  /** Fraction of samples inside the tunnel with |ŝ − s| ≤ 2·sigmaS. */
  readonly coverage: number
  /** Largest step in ŝ after the exit beyond the estimator's own motion, |Δŝ − v̂·Δt|, m. */
  readonly returnJump: number
  /**
   * Time from the first GNSS fix after the exit until |ŝ − s| stays below
   * RECOVERY_THRESHOLD to the end of the run, s. null if it never does.
   */
  readonly recoveryTime: number | null
}

export function evaluateRun(run: RunResult, entry: EstimatorEntry): RunMetrics {
  return computeMetrics(run, runEstimator(entry, run.map, run.measurements))
}

/** Metrics of estimates given at each truth sample (same index). */
export function computeMetrics(run: RunResult, estimates: readonly (Estimate | null)[]): RunMetrics {
  const truth = run.truth.samples
  if (estimates.length !== truth.length) {
    throw new RangeError(`Expected ${truth.length} estimates, got ${estimates.length}`)
  }
  const L = run.map.tunnelLength
  const at = (k: number): Estimate => {
    const e = estimates[k]
    if (!e) throw new RangeError(`No estimate at sample ${k} (t = ${truth[k]!.t} s)`)
    return e
  }
  const error = (k: number): number => at(k).s - truth[k]!.s

  // Inside the tunnel: s ∈ [0, L], one contiguous block since the car never reverses.
  let maxTunnelError = 0
  let covered = 0
  let inside = 0
  let lastInside = -1
  for (let k = 0; k < truth.length; k++) {
    const s = truth[k]!.s
    if (s < 0 || s > L) continue
    const err = Math.abs(error(k))
    maxTunnelError = Math.max(maxTunnelError, err)
    if (err <= 2 * at(k).sigmaS) covered++
    inside++
    lastInside = k
  }
  if (inside === 0) throw new RangeError('No truth sample lies inside the tunnel')

  const announcements = announcementEvents(run, estimates).map(
    ({ lead, target, kEst, kTrue }): AnnouncementMetric =>
      kEst === null
        ? { lead, distanceError: null, timeError: null }
        : { lead, distanceError: truth[kEst]!.s - target, timeError: truth[kEst]!.t - truth[kTrue]!.t },
  )

  let returnJump = 0
  let lastBad = -1
  for (let k = lastInside + 1; k < truth.length; k++) {
    const prev = at(k - 1)
    const cur = at(k)
    returnJump = Math.max(returnJump, Math.abs(cur.s - prev.s - prev.v * (cur.t - prev.t)))
    if (Math.abs(error(k)) >= RECOVERY_THRESHOLD) lastBad = k
  }

  const firstFix = run.measurements.find((m) => m.kind === 'gnss' && m.t > run.truth.exitTime)
  let recoveryTime: number | null = null
  if (firstFix && lastBad < truth.length - 1) {
    recoveryTime = lastBad < 0 ? 0 : Math.max(0, truth[lastBad + 1]!.t - firstFix.t)
  }

  return {
    exitError: Math.abs(error(lastInside)),
    maxTunnelError,
    announcements,
    coverage: covered / inside,
    returnJump,
    recoveryTime,
  }
}
