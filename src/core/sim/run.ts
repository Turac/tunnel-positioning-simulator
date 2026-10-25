// One simulation run: ground truth plus the measurement stream for one seed. See ADR-0007.
//
// The result is plain data (no functions or class instances), so it can be passed to a
// web worker with structuredClone. Estimators must receive only `map` and `measurements`;
// `truth` is for evaluation and display.

import { createTunnelMap, type TunnelMap } from '../map/tunnel'
import { simulateAccelerometer, type AccelerometerConfig } from '../sensors/accelerometer'
import { simulateGnss, type GnssConfig } from '../sensors/gnss'
import { lastSampleIndex, sampleTime, type Measurement } from '../sensors/measurement'
import { createSpeedProfile, type SpeedKeypoint } from '../world/speed-profile'
import { createTrajectory, truthAt, type TruthState } from '../world/trajectory'

export interface RunConfig {
  readonly map: TunnelMap
  readonly speedProfile: readonly SpeedKeypoint[]
  readonly accelerometer: AccelerometerConfig
  readonly gnss: GnssConfig
}

export interface RunTruth {
  /** True state on the accelerometer grid, t = k / rateHz up to runEnd. */
  readonly samples: readonly TruthState[]
  readonly rateHz: number
  readonly entryTime: number
  readonly exitTime: number
  readonly runEnd: number
}

export interface RunResult {
  /** The map as known to the estimators. */
  readonly map: TunnelMap
  readonly truth: RunTruth
  /** All measurements sorted by t; at equal t, accelerometer before GNSS. */
  readonly measurements: readonly Measurement[]
}

export function simulateRun(config: RunConfig, seed: number): RunResult {
  const map = createTunnelMap(config.map)
  const trajectory = createTrajectory(map, createSpeedProfile(config.speedProfile))

  const rateHz = config.accelerometer.rateHz
  const n = lastSampleIndex(trajectory.runEnd, rateHz) + 1
  const samples = Array.from({ length: n }, (_, k) => truthAt(trajectory, sampleTime(k, rateHz)))

  const accel = simulateAccelerometer(trajectory, config.accelerometer, seed)
  const gnss = simulateGnss(trajectory, config.gnss, seed)

  // Merge two time-sorted streams; ties go to the accelerometer.
  const measurements: Measurement[] = []
  let i = 0
  let j = 0
  while (i < accel.length || j < gnss.length) {
    if (j >= gnss.length || (i < accel.length && accel[i]!.t <= gnss[j]!.t)) {
      measurements.push(accel[i++]!)
    } else {
      measurements.push(gnss[j++]!)
    }
  }

  return {
    map,
    truth: {
      samples,
      rateHz,
      entryTime: trajectory.entryTime,
      exitTime: trajectory.exitTime,
      runEnd: trajectory.runEnd,
    },
    measurements,
  }
}
