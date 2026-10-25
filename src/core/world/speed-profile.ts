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

/** Total distance covered by the profile, m. */
export function totalDistance(profile: SpeedProfile): number {
  return profile.distances[profile.distances.length - 1]!
}

function assertDistanceInRange(profile: SpeedProfile, d: number): void {
  if (!Number.isFinite(d) || d < 0 || d > totalDistance(profile)) {
    throw new RangeError(
      `Distance ${d} m is outside the speed profile [0, ${totalDistance(profile)}] m`,
    )
  }
}

/** Index of the last keypoint whose distance is <= d. Distances are non-decreasing. */
function lastKeypointAtOrBefore(distances: readonly number[], d: number): number {
  let lo = 0
  let hi = distances.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (distances[mid]! <= d) lo = mid
    else hi = mid - 1
  }
  return lo
}

/**
 * First time the car has travelled distance d, s.
 *
 * Solves Δd = v0·τ + ½·a·τ² on the segment where d is reached, in the form
 * τ = 2·Δd / (v0 + √(v0² + 2·a·Δd)). Unlike (−v0 + √…)/a it stays accurate for small a and
 * works for a = 0. Stops (v0 = 0 and a = 0) are skipped: the distance does not grow there, so
 * d is always reached on a moving segment.
 */
export function firstTimeAtDistance(profile: SpeedProfile, d: number): number {
  assertDistanceInRange(profile, d)
  const { points, distances } = profile
  if (d === 0) return 0

  // First keypoint with distance >= d; the segment before it is where d is reached.
  let lo = 0
  let hi = distances.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (distances[mid]! >= d) hi = mid
    else lo = mid + 1
  }
  const i = lo - 1
  const a = points[i]!
  const b = points[i + 1]!
  const v0 = a.v
  const acc = (b.v - a.v) / (b.t - a.t)
  const dd = d - distances[i]!
  // Analytically >= 0 (it is the speed squared at d); rounding can make it a tiny negative
  // number when the car decelerates to a stop exactly at d. Clamp so the result is not NaN.
  const radicand = Math.max(0, v0 * v0 + 2 * acc * dd)
  const tau = (2 * dd) / (v0 + Math.sqrt(radicand))
  // Rounding can also push tau a hair past the segment end.
  return Math.min(a.t + tau, b.t)
}

/**
 * Last time the car is at distance d (has travelled no more than d), s. Equal to
 * firstTimeAtDistance unless the car stands still at d; then it is the end of that stop.
 */
export function lastTimeAtDistance(profile: SpeedProfile, d: number): number {
  assertDistanceInRange(profile, d)
  const j = lastKeypointAtOrBefore(profile.distances, d)
  return profile.distances[j] === d ? profile.points[j]!.t : firstTimeAtDistance(profile, d)
}
