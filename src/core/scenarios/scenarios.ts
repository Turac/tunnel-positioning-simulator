// Evaluation scenarios as plain objects. Every scenario has its exit inside the tunnel.

import { DEFAULT_APPROACH_LENGTH, DEFAULT_DEPARTURE_LENGTH } from '../map/tunnel'
import { DEFAULT_ACCELEROMETER } from '../sensors/accelerometer'
import { DEFAULT_GNSS } from '../sensors/gnss'
import type { RunConfig } from '../sim/run'

export interface Scenario {
  readonly id: string
  readonly description: string
  readonly config: RunConfig
}

/** Free-flow speed in the tunnel, m/s: 70 km/h (A-15). */
export const FREE_FLOW_SPEED = 70 / 3.6

export const BASELINE: Scenario = {
  id: 'baseline',
  description: '1 km flat tunnel at constant free-flow speed, exit at 600 m',
  config: {
    map: {
      approachLength: DEFAULT_APPROACH_LENGTH,
      tunnelLength: 1000,
      departureLength: DEFAULT_DEPARTURE_LENGTH,
      exitS: 600,
      grade: [
        { s: -DEFAULT_APPROACH_LENGTH, grade: 0 },
        { s: 1000 + DEFAULT_DEPARTURE_LENGTH, grade: 0 },
      ],
    },
    // 4000 m at 70 km/h take about 206 s; the run ends at the road end.
    speedProfile: [
      { t: 0, v: FREE_FLOW_SPEED },
      { t: 300, v: FREE_FLOW_SPEED },
    ],
    accelerometer: DEFAULT_ACCELEROMETER,
    gnss: DEFAULT_GNSS,
  },
}

export const SCENARIOS: readonly Scenario[] = [BASELINE]
