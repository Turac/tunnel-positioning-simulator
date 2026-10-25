// Scenario validation: the task's ranges on top of the physical checks of map, speed profile
// and trajectory. Built-in scenarios and parameter overrides go through the same function.

import { createTunnelMap } from '../map/tunnel'
import type { RunConfig } from '../sim/run'
import { createSpeedProfile } from '../world/speed-profile'
import { createTrajectory } from '../world/trajectory'

/** Tunnel length range given by the task, m (A-02). */
export const MIN_TUNNEL_LENGTH = 500
export const MAX_TUNNEL_LENGTH = 5000

/** Largest |grade| in a scenario (A-18); the map itself accepts steeper roads. */
export const MAX_SCENARIO_GRADE = 0.05

/** Throws a RangeError if the configuration is not a valid scenario. */
export function validateScenario(config: RunConfig): void {
  const { tunnelLength } = config.map
  if (!(tunnelLength >= MIN_TUNNEL_LENGTH && tunnelLength <= MAX_TUNNEL_LENGTH)) {
    throw new RangeError(
      `Tunnel length must be in [${MIN_TUNNEL_LENGTH}, ${MAX_TUNNEL_LENGTH}] m (A-02), got ${tunnelLength}`,
    )
  }
  config.map.grade.forEach((p, i) => {
    if (!(Math.abs(p.grade) <= MAX_SCENARIO_GRADE)) {
      throw new RangeError(
        `Grade keypoint ${i}: |grade| must be at most ${MAX_SCENARIO_GRADE} (A-18), got ${p.grade}`,
      )
    }
  })
  // Physical consistency: exit inside the tunnel, grade covers the road, the speed profile
  // reaches the road end.
  createTrajectory(createTunnelMap(config.map), createSpeedProfile(config.speedProfile))
  const bias = config.accelerometer.turnOnBiasFixed
  if (bias !== undefined && !Number.isFinite(bias)) {
    throw new RangeError(`Fixed turn-on bias must be finite, got ${bias}`)
  }
}
