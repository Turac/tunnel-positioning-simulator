// Accelerometer along the phone's forward axis. See ADR-0009.
//
//   f = (1 + sf)·[a·cos δ + g·sin(θ + δ)] + b0 + b_drift(t) + n_sensor + n_vib(t, v)
//
// Every error source draws from its own named stream, and draws happen whether or not the
// term is switched on, so enabling one term never shifts another term's noise.

import { STANDARD_GRAVITY } from '../physics/constants'
import { createStreamRng } from '../random/rng'
import { truthAt, type Trajectory } from '../world/trajectory'
import { lastSampleIndex, sampleTime, type AccelMeasurement } from './measurement'

export interface AccelerometerConfig {
  /** Sample rate, Hz (A-22). */
  readonly rateHz: number
  /** Sensor white-noise density, (m/s²)/√Hz; sample σ = density·√(rateHz / 2) (A-23). */
  readonly noiseDensity: number
  /** σ of the turn-on bias b0, drawn once per run, m/s² (A-23). */
  readonly turnOnBiasSigma: number
  /** Bias random-walk intensity q, (m/s²)²/s; increment variance q·Δt (A-31). */
  readonly biasDriftQ: number
  /** Vibration amplitude σ(v) = sigma0 + slope·v, as an RMS value, m/s² (A-32). */
  readonly vibrationSigma0: number
  readonly vibrationSlope: number
  /** Vibration frequency, Hz; must be below rateHz / 2 (A-32). */
  readonly vibrationFrequencyHz: number
  /** Scale-factor error sf, unitless (A-33). */
  readonly scaleFactorError: number
  /** Residual pitch misalignment of the phone relative to the car δ, rad (A-21). */
  readonly pitchMisalignment: number
}

/** Default phone accelerometer (A-22, A-23, A-30..A-33). Mounting and scale errors off. */
export const DEFAULT_ACCELEROMETER: AccelerometerConfig = {
  rateHz: 100,
  noiseDensity: 160e-6 * STANDARD_GRAVITY,
  turnOnBiasSigma: 10e-3 * STANDARD_GRAVITY,
  biasDriftQ: 8.0e-8,
  vibrationSigma0: 0.2,
  vibrationSlope: 0.03,
  vibrationFrequencyHz: 25,
  scaleFactorError: 0,
  pitchMisalignment: 0,
}

/**
 * Specific force along the phone's forward axis, m/s²: a·cos δ + g·sin(θ + δ). An
 * accelerometer senses gravity as well as acceleration, so a car standing on an uphill grade
 * (θ > 0) reads +g·sin θ.
 */
export function specificForce(a: number, theta: number, pitchMisalignment = 0): number {
  return a * Math.cos(pitchMisalignment) + STANDARD_GRAVITY * Math.sin(theta + pitchMisalignment)
}

/** Vibration RMS amplitude at speed v, m/s². */
export function vibrationSigma(config: AccelerometerConfig, v: number): number {
  return config.vibrationSigma0 + config.vibrationSlope * v
}

export function simulateAccelerometer(
  trajectory: Trajectory,
  config: AccelerometerConfig,
  seed: number,
): AccelMeasurement[] {
  const { rateHz } = config
  if (!(config.vibrationFrequencyHz >= 0 && config.vibrationFrequencyHz < rateHz / 2)) {
    throw new RangeError(
      `Vibration frequency must be in [0, ${rateHz / 2}) Hz (below Nyquist), got ${config.vibrationFrequencyHz}`,
    )
  }

  const whiteRng = createStreamRng(seed, 'accelerometer')
  const driftRng = createStreamRng(seed, 'accelBiasDrift')
  const turnOnBias = createStreamRng(seed, 'accelBiasInitial').gaussian(0, config.turnOnBiasSigma)
  const phase = 2 * Math.PI * createStreamRng(seed, 'accelVibration').uniform()

  const whiteSigma = config.noiseDensity * Math.sqrt(rateHz / 2)
  const driftStepSigma = Math.sqrt(config.biasDriftQ / rateHz)
  const omega = 2 * Math.PI * config.vibrationFrequencyHz

  const n = lastSampleIndex(trajectory.runEnd, rateHz) + 1
  const out: AccelMeasurement[] = new Array(n)
  let drift = 0
  for (let k = 0; k < n; k++) {
    const t = sampleTime(k, rateHz)
    const truth = truthAt(trajectory, t)
    if (k > 0) drift += driftRng.gaussian(0, driftStepSigma)
    const white = whiteRng.gaussian(0, whiteSigma)
    // A sinusoid with RMS σ(v) has amplitude √2·σ(v); its integral stays bounded.
    const vibration = Math.SQRT2 * vibrationSigma(config, truth.v) * Math.sin(omega * t + phase)
    const ideal = specificForce(truth.a, truth.theta, config.pitchMisalignment)
    out[k] = {
      kind: 'accel',
      t,
      f: (1 + config.scaleFactorError) * ideal + turnOnBias + drift + white + vibration,
    }
  }
  return out
}
