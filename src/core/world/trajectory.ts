// Ground truth: the car's true state over time, composed from the speed profile and the
// map. See ADR-0008. Sensors read the truth only through truthAt().
//
// The car starts at the road start, s(0) = -approachLength, and the run ends the first
// time it reaches the road end. Any part of the speed profile after that is not used.

import { pitchAt, roadEnd, roadStart, type TunnelMap } from '../map/tunnel'
import {
  accelerationAt,
  distanceAt,
  firstTimeAtDistance,
  lastTimeAtDistance,
  speedAt,
  totalDistance,
  type SpeedProfile,
} from './speed-profile'

export interface TruthState {
  /** Time since scenario start, s. */
  readonly t: number
  /** Position along the centerline, m (A-11). */
  readonly s: number
  /** Speed along the road, m/s. */
  readonly v: number
  /** Acceleration along the road, m/s². Right-continuous (A-19). */
  readonly a: number
  /** Road pitch angle at s, rad. Positive uphill (A-18). */
  readonly theta: number
}

export interface Trajectory {
  readonly map: TunnelMap
  readonly profile: SpeedProfile
  /** Time the car first reaches the road end; the run ends here, s. */
  readonly runEnd: number
  /** Time the car first reaches the entrance portal (s = 0), s. */
  readonly entryTime: number
  /**
   * Time the car leaves the exit portal: the last time with s <= tunnelLength, s. If the
   * car stands still at the portal, this is the end of the stop.
   */
  readonly exitTime: number
}

export function createTrajectory(map: TunnelMap, profile: SpeedProfile): Trajectory {
  const roadLength = roadEnd(map) - roadStart(map)
  if (totalDistance(profile) < roadLength) {
    throw new RangeError(
      `Speed profile covers ${totalDistance(profile)} m but the road is ${roadLength} m long; ` +
        'extend the profile so the car reaches the road end',
    )
  }
  return Object.freeze({
    map,
    profile,
    runEnd: firstTimeAtDistance(profile, roadLength),
    entryTime: firstTimeAtDistance(profile, map.approachLength),
    exitTime: lastTimeAtDistance(profile, map.approachLength + map.tunnelLength),
  })
}

/** True state at time t, for t in [0, runEnd]. */
export function truthAt(trajectory: Trajectory, t: number): TruthState {
  const { map, profile, runEnd } = trajectory
  if (!Number.isFinite(t) || t < 0 || t > runEnd) {
    throw new RangeError(`t = ${t} s is outside the run [0, ${runEnd}] s`)
  }
  // Rounding can put the car a hair past the road end at t = runEnd; clamp onto the road.
  const s = Math.min(roadStart(map) + distanceAt(profile, t), roadEnd(map))
  return {
    t,
    s,
    v: speedAt(profile, t),
    a: accelerationAt(profile, t),
    theta: pitchAt(map, s),
  }
}
