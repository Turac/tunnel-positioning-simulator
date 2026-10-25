// Evaluation scenarios as plain objects (A-44). Every scenario has its exit inside the
// tunnel.

import { DEFAULT_APPROACH_LENGTH, DEFAULT_DEPARTURE_LENGTH, type GradePoint, type TunnelMap } from '../map/tunnel'
import { DEFAULT_ACCELEROMETER } from '../sensors/accelerometer'
import { DEFAULT_GNSS } from '../sensors/gnss'
import type { RunConfig } from '../sim/run'
import type { SpeedKeypoint } from '../world/speed-profile'

export interface Scenario {
  readonly id: string
  readonly description: string
  readonly config: RunConfig
}

/** Free-flow speed in the tunnel, m/s: 70 km/h (A-15). */
export const FREE_FLOW_SPEED = 70 / 3.6

/** Default approach and departure; flat unless a grade profile is given. */
function road(tunnelLength: number, exitS: number, grade?: GradePoint[]): TunnelMap {
  return {
    approachLength: DEFAULT_APPROACH_LENGTH,
    tunnelLength,
    departureLength: DEFAULT_DEPARTURE_LENGTH,
    exitS,
    grade: grade ?? [
      { s: -DEFAULT_APPROACH_LENGTH, grade: 0 },
      { s: tunnelLength + DEFAULT_DEPARTURE_LENGTH, grade: 0 },
    ],
  }
}

/** Constant free-flow speed until tEnd; the run itself ends at the road end. */
function cruise(tEnd: number): SpeedKeypoint[] {
  return [
    { t: 0, v: FREE_FLOW_SPEED },
    { t: tEnd, v: FREE_FLOW_SPEED },
  ]
}

const SENSORS = { accelerometer: DEFAULT_ACCELEROMETER, gnss: DEFAULT_GNSS }

export const BASELINE: Scenario = {
  id: 'baseline',
  description: '1 km flat tunnel at constant free-flow speed, exit at 600 m',
  // 4000 m at 70 km/h take about 206 s.
  config: { map: road(1000, 600), speedProfile: cruise(300), ...SENSORS },
}

export const LONG: Scenario = {
  id: 'long',
  description: '5 km flat tunnel at constant free-flow speed (about 260 s without GNSS), exit at 4000 m',
  // 8000 m take about 411 s.
  config: { map: road(5000, 4000), speedProfile: cruise(600), ...SENSORS },
}

export const STOP_AND_GO: Scenario = {
  id: 'stop-and-go',
  description: '2 km flat tunnel: a 30 s stop, slow driving and a 20 s crawl at 0.5 m/s, exit at 1500 m',
  config: {
    map: road(2000, 1500),
    // Entry at about 103 s. Positions inside the tunnel are approximate: brake from 110 s
    // (s ≈ 140 m), stand 120–150 s (s ≈ 236 m), 8 m/s 155–185 s, crawl 190–210 s at 0.5 m/s
    // (s ≈ 517–527 m), back to free flow at 220 s (s ≈ 627 m); exit branch at about 265 s.
    speedProfile: [
      { t: 0, v: FREE_FLOW_SPEED },
      { t: 110, v: FREE_FLOW_SPEED },
      { t: 120, v: 0 },
      { t: 150, v: 0 },
      { t: 155, v: 8 },
      { t: 185, v: 8 },
      { t: 190, v: 0.5 },
      { t: 210, v: 0.5 },
      { t: 220, v: FREE_FLOW_SPEED },
      { t: 500, v: FREE_FLOW_SPEED },
    ],
    ...SENSORS,
  },
}

export const GRADED: Scenario = {
  id: 'graded',
  description: '2 km tunnel climbing at +4 % then descending at −2 %, exit at 1500 m',
  config: {
    map: road(2000, 1500, [
      { s: -DEFAULT_APPROACH_LENGTH, grade: 0 },
      { s: 0, grade: 0 },
      { s: 100, grade: 0.04 },
      { s: 1000, grade: 0.04 },
      { s: 1100, grade: -0.02 },
      { s: 2000, grade: -0.02 },
      { s: 2100, grade: 0 },
      { s: 2000 + DEFAULT_DEPARTURE_LENGTH, grade: 0 },
    ]),
    speedProfile: cruise(400),
    ...SENSORS,
  },
}

export const POOR_SENSOR: Scenario = {
  id: 'poor-sensor',
  description:
    '2 km flat tunnel with a poor accelerometer (3× noise and bias, 10× drift, 2° mount ' +
    'error, 0.4 % scale error) and a 30 m GNSS jump for 5 s after reacquisition; exit at 1500 m',
  config: {
    map: road(2000, 1500),
    speedProfile: cruise(400),
    accelerometer: {
      ...DEFAULT_ACCELEROMETER,
      noiseDensity: 3 * DEFAULT_ACCELEROMETER.noiseDensity,
      turnOnBiasSigma: 3 * DEFAULT_ACCELEROMETER.turnOnBiasSigma,
      biasDriftQ: 10 * DEFAULT_ACCELEROMETER.biasDriftQ,
      pitchMisalignment: (2 * Math.PI) / 180,
      scaleFactorError: 0.004, // A-33
    },
    gnss: { ...DEFAULT_GNSS, exitJumpOffset: 30, exitJumpDuration: 5 }, // A-39
  },
}

export const SCENARIOS: readonly Scenario[] = [BASELINE, LONG, STOP_AND_GO, GRADED, POOR_SENSOR]
