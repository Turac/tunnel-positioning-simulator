// Known map data for one tunnel: geometry, exit position and grade profile. See ADR-0007.
//
// The map is neutral: world/ uses it to build the true trajectory and estimators/ use it as
// prior knowledge (A-10, A-12, A-14). It holds no ground truth about the car and imports
// nothing that does (enforced by eslint.config.js).
//
// Position is s, metres along the centerline, s = 0 at the tunnel entrance (A-11):
//   approach   [-approachLength, 0)
//   tunnel     [0, tunnelLength]          (closed: both portals count as inside)
//   departure  (tunnelLength, tunnelLength + departureLength]
//
// Grade sign convention: grade is rise over run in the direction of increasing s.
// Positive = uphill, negative = downhill. pitchAt() has the same sign. Phase 2 grade
// compensation depends on this sign; a flipped sign would double the error, not remove it.

/** Default length of open-sky road before the entrance (A-16). Adjustable per scenario. */
export const DEFAULT_APPROACH_LENGTH = 2000

/** Default length of road after the exit portal (A-17). Adjustable per scenario. */
export const DEFAULT_DEPARTURE_LENGTH = 1000

export interface GradePoint {
  /** Position along the centerline, m. */
  readonly s: number
  /** Rise over run, unitless (0.04 = 4 %). Positive uphill in the direction of increasing s. */
  readonly grade: number
}

export interface TunnelMap {
  /** Road before the entrance, m (> 0). */
  readonly approachLength: number
  /** Tunnel length, m (> 0). */
  readonly tunnelLength: number
  /** Road after the exit portal, m (> 0). */
  readonly departureLength: number
  /** Position of the exit branch inside the tunnel, m; 0 < exitS < tunnelLength (A-14). */
  readonly exitS: number
  /**
   * Grade keypoints, s strictly increasing, covering the whole road. Grade between
   * keypoints is linearly interpolated (A-18).
   */
  readonly grade: readonly GradePoint[]
}

export type RoadSegment = 'approach' | 'tunnel' | 'departure'

function assertPositiveLength(value: number, what: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${what} must be a finite length > 0 m, got ${value}`)
  }
}

/**
 * Validates a map and returns a frozen copy. Checks physical consistency only; the task's
 * tunnel length range (A-02) is checked by scenario validation, not here.
 */
export function createTunnelMap(spec: TunnelMap): TunnelMap {
  assertPositiveLength(spec.approachLength, 'Approach length')
  assertPositiveLength(spec.tunnelLength, 'Tunnel length')
  assertPositiveLength(spec.departureLength, 'Departure length')

  if (!Number.isFinite(spec.exitS) || spec.exitS <= 0 || spec.exitS >= spec.tunnelLength) {
    throw new RangeError(
      `Exit position must lie inside the tunnel (0, ${spec.tunnelLength}) m, got ${spec.exitS}`,
    )
  }

  const points = spec.grade
  if (points.length < 2) {
    throw new RangeError(`Grade profile needs at least 2 keypoints, got ${points.length}`)
  }
  points.forEach((p, i) => {
    if (!Number.isFinite(p.s)) {
      throw new RangeError(`Grade keypoint ${i}: s must be finite, got ${p.s}`)
    }
    // |grade| >= 1 means a 45° slope or steeper: almost certainly a percent typed as a
    // fraction (4 instead of 0.04).
    if (!Number.isFinite(p.grade) || Math.abs(p.grade) >= 1) {
      throw new RangeError(
        `Grade keypoint ${i}: grade must be a fraction with |grade| < 1 (0.04 = 4 %), got ${p.grade}`,
      )
    }
    const prev = points[i - 1]
    if (prev !== undefined && p.s <= prev.s) {
      throw new RangeError(
        `Grade keypoints must have strictly increasing s; keypoint ${i} has s = ${p.s} after ${prev.s}`,
      )
    }
  })

  const start = -spec.approachLength
  const end = spec.tunnelLength + spec.departureLength
  const first = points[0]!
  const last = points[points.length - 1]!
  if (first.s > start || last.s < end) {
    throw new RangeError(
      `Grade profile must cover the whole road [${start}, ${end}] m, covers [${first.s}, ${last.s}]`,
    )
  }

  return Object.freeze({
    approachLength: spec.approachLength,
    tunnelLength: spec.tunnelLength,
    departureLength: spec.departureLength,
    exitS: spec.exitS,
    grade: Object.freeze(points.map((p) => Object.freeze({ s: p.s, grade: p.grade }))),
  })
}

/** First position on the road, m: -approachLength. */
export function roadStart(map: TunnelMap): number {
  return -map.approachLength
}

/** Last position on the road, m: tunnelLength + departureLength. */
export function roadEnd(map: TunnelMap): number {
  return map.tunnelLength + map.departureLength
}

function assertOnRoad(map: TunnelMap, s: number): void {
  if (!Number.isFinite(s) || s < roadStart(map) || s > roadEnd(map)) {
    throw new RangeError(`s = ${s} m is outside the road [${roadStart(map)}, ${roadEnd(map)}] m`)
  }
}

export function segmentAt(map: TunnelMap, s: number): RoadSegment {
  assertOnRoad(map, s)
  if (s < 0) return 'approach'
  if (s <= map.tunnelLength) return 'tunnel'
  return 'departure'
}

/** True on the closed interval [0, tunnelLength]: both portals count as inside. */
export function isInTunnel(map: TunnelMap, s: number): boolean {
  return segmentAt(map, s) === 'tunnel'
}

/** Grade at s, linearly interpolated between keypoints. Positive uphill. */
export function gradeAt(map: TunnelMap, s: number): number {
  assertOnRoad(map, s)
  const points = map.grade
  // Keypoints are few; a linear scan is clear and fast enough.
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (s <= b.s) {
      return a.grade + ((b.grade - a.grade) * (s - a.s)) / (b.s - a.s)
    }
  }
  // Unreachable: createTunnelMap guarantees the profile covers the road.
  throw new RangeError(`No grade keypoint covers s = ${s} m`)
}

/** Road pitch angle at s, rad: atan(grade). Positive uphill. */
export function pitchAt(map: TunnelMap, s: number): number {
  return Math.atan(gradeAt(map, s))
}
