// True speed of the car over time, as time–speed keypoints (A-19).
//
// Between keypoints speed changes linearly, so acceleration is constant on each segment and
// distance follows in closed form: no numerical integration error enters the ground truth.
// Acceleration is right-continuous: at a keypoint it is the slope of the segment that
// starts there. At the final keypoint, where no segment starts, it is the slope of the last
// segment.

/** Upper speed limit, m/s (180 km/h). Catches km/h typed as m/s (A-19). */
export const MAX_SPEED = 50

export interface SpeedKeypoint {
  /** Time since scenario start, s. */
  readonly t: number
  /** Speed along the road, m/s; 0 <= v <= MAX_SPEED. */
  readonly v: number
}

export interface SpeedProfile {
  /** Keypoints, t strictly increasing, first t = 0. */
  readonly points: readonly SpeedKeypoint[]
  /** Distance travelled from t = 0 to each keypoint, m. */
  readonly distances: readonly number[]
}

/** Validates keypoints and returns a frozen profile with precomputed keypoint distances. */
export function createSpeedProfile(keypoints: readonly SpeedKeypoint[]): SpeedProfile {
  if (keypoints.length < 2) {
    throw new RangeError(`Speed profile needs at least 2 keypoints, got ${keypoints.length}`)
  }
  keypoints.forEach((p, i) => {
    if (!Number.isFinite(p.t)) {
      throw new RangeError(`Speed keypoint ${i}: t must be finite, got ${p.t}`)
    }
    if (!Number.isFinite(p.v) || p.v < 0 || p.v > MAX_SPEED) {
      throw new RangeError(
        `Speed keypoint ${i}: v must be in [0, ${MAX_SPEED}] m/s, got ${p.v} (km/h typed as m/s?)`,
      )
    }
    const prev = keypoints[i - 1]
    if (prev !== undefined && p.t <= prev.t) {
      throw new RangeError(
        `Speed keypoints must have strictly increasing t; keypoint ${i} has t = ${p.t} after ${prev.t}`,
      )
    }
  })
  if (keypoints[0]!.t !== 0) {
    throw new RangeError(`Speed profile must start at t = 0, got ${keypoints[0]!.t}`)
  }

  const points = keypoints.map((p) => Object.freeze({ t: p.t, v: p.v }))
  const distances = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    // Exact for constant acceleration: mean speed times duration.
    distances.push(distances[i - 1]! + ((a.v + b.v) / 2) * (b.t - a.t))
  }
  return Object.freeze({ points: Object.freeze(points), distances: Object.freeze(distances) })
}

/** Time of the final keypoint, s. */
export function endTime(profile: SpeedProfile): number {
  return profile.points[profile.points.length - 1]!.t
}

interface SegmentState {
  /** Speed at the segment start, m/s. */
  v0: number
  /** Constant acceleration on the segment, m/s². */
  a: number
  /** Time since the segment start, s. */
  dt: number
  /** Distance travelled up to the segment start, m. */
  d0: number
}

/**
 * Segment i with t_i <= t < t_(i+1) (right-continuous); the final keypoint belongs to the
 * last segment.
 */
function segmentAt(profile: SpeedProfile, t: number): SegmentState {
  const { points, distances } = profile
  if (!Number.isFinite(t) || t < 0 || t > endTime(profile)) {
    throw new RangeError(`t = ${t} s is outside the speed profile [0, ${endTime(profile)}] s`)
  }
  // Binary search for the last segment start <= t, at most points.length - 2.
  let lo = 0
  let hi = points.length - 2
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid]!.t <= t) lo = mid
    else hi = mid - 1
  }
  const a = points[lo]!
  const b = points[lo + 1]!
  return { v0: a.v, a: (b.v - a.v) / (b.t - a.t), dt: t - a.t, d0: distances[lo]! }
}

/** Speed at t, m/s. */
export function speedAt(profile: SpeedProfile, t: number): number {
  const { v0, a, dt } = segmentAt(profile, t)
  return v0 + a * dt
}

/** Acceleration at t, m/s². Right-continuous; the left limit at the final keypoint. */
export function accelerationAt(profile: SpeedProfile, t: number): number {
  return segmentAt(profile, t).a
}

/** Distance travelled since t = 0, m. */
export function distanceAt(profile: SpeedProfile, t: number): number {
  const { v0, a, dt, d0 } = segmentAt(profile, t)
  return d0 + v0 * dt + 0.5 * a * dt * dt
}
