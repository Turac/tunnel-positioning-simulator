// Parameter overrides for the visual simulator: tunnel length, grade and accelerometer bias
// on top of a scenario (A-45, ADR-0019). The result is validated like any scenario.

import type { GradePoint, TunnelMap } from '../map/tunnel'
import type { RunConfig } from '../sim/run'
import { createSpeedProfile, totalDistance, type SpeedKeypoint } from '../world/speed-profile'
import type { Scenario } from './scenarios'
import { validateScenario } from './validate'

export interface ScenarioOverrides {
  /** Tunnel length, m; exit and in-tunnel grade keypoints scale with it (A-45). */
  readonly tunnelLength?: number
  /** Constant in-tunnel grade (fraction), replacing the scenario's grade profile (A-45). */
  readonly grade?: number
  /** Fixed accelerometer turn-on bias, m/s², replacing the drawn one (A-45). */
  readonly accelBias?: number
}

/** Length of the linear grade ramp inside each portal, m (A-45). */
export const GRADE_RAMP_LENGTH = 100

/** Scenario config with the overrides applied; throws a RangeError if the result is invalid. */
export function applyOverrides(scenario: Scenario, overrides: ScenarioOverrides): RunConfig {
  let map = scenario.config.map
  if (overrides.tunnelLength !== undefined) map = withTunnelLength(map, overrides.tunnelLength)
  if (overrides.grade !== undefined) map = withTunnelGrade(map, overrides.grade)

  const accelerometer =
    overrides.accelBias === undefined
      ? scenario.config.accelerometer
      : { ...scenario.config.accelerometer, turnOnBiasFixed: overrides.accelBias }

  const config: RunConfig = {
    ...scenario.config,
    map,
    speedProfile: reachRoadEnd(scenario.config.speedProfile, roadLength(map)),
    accelerometer,
  }
  validateScenario(config)
  return config
}

function roadLength(map: TunnelMap): number {
  return map.approachLength + map.tunnelLength + map.departureLength
}

/**
 * Exit scales with the length, rounded to 1 m; grade keypoints inside [0, L] scale by L′/L,
 * keypoints past the far portal shift by L′ − L, approach keypoints stay.
 */
function withTunnelLength(map: TunnelMap, length: number): TunnelMap {
  const L = map.tunnelLength
  const scale = length / L
  return {
    ...map,
    tunnelLength: length,
    exitS: Math.round(map.exitS * scale),
    grade: map.grade.map(
      (p): GradePoint => ({ s: p.s < 0 ? p.s : p.s <= L ? p.s * scale : p.s + length - L, grade: p.grade }),
    ),
  }
}

/** Flat outside the tunnel, constant grade inside, linear ramps inside each portal. */
function withTunnelGrade(map: TunnelMap, grade: number): TunnelMap {
  const L = map.tunnelLength
  return {
    ...map,
    grade: [
      { s: -map.approachLength, grade: 0 },
      { s: 0, grade: 0 },
      { s: GRADE_RAMP_LENGTH, grade },
      { s: L - GRADE_RAMP_LENGTH, grade },
      { s: L, grade: 0 },
      { s: L + map.departureLength, grade: 0 },
    ],
  }
}

/**
 * Adds one keypoint at the final speed if the profile ends before the road does, so a longer
 * tunnel needs no new profile. Time-based events keep their times.
 */
function reachRoadEnd(profile: readonly SpeedKeypoint[], length: number): readonly SpeedKeypoint[] {
  const distance = totalDistance(createSpeedProfile(profile))
  if (distance >= length) return profile
  const last = profile[profile.length - 1]!
  if (!(last.v > 0)) {
    throw new RangeError('Speed profile ends at a stop before the road end; it cannot be extended')
  }
  // One extra second covers rounding in the distance.
  return [...profile, { t: last.t + Math.ceil((length - distance) / last.v) + 1, v: last.v }]
}
