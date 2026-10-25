// The estimators' own model of the phone's accelerometer, from datasheet values. These are
// deliberately separate from the simulator's sensor config: estimators must not read the
// simulator's parameters (CLAUDE.md hard rules 1 and 3).

import { STANDARD_GRAVITY } from '../physics/constants'

/** Accelerometer white noise density, (m/s²)/√Hz: 160 µg/√Hz, BMI270 datasheet (A-50). */
export const ACCEL_NOISE_DENSITY = 160e-6 * STANDARD_GRAVITY

/**
 * Velocity random-walk intensity of the white noise, (m/s²)²·s: sample variance ND²·fs/2
 * times Δt = 1/fs per sample gives ND²/2 per second, independent of the rate.
 */
export const VELOCITY_RANDOM_WALK = ACCEL_NOISE_DENSITY ** 2 / 2

/**
 * Prior 1σ of the constant accelerometer offset, m/s² (A-51): the turn-on bias, 10 mg
 * (datasheet ±20 mg as 2σ, A-23), combined with the offset g·sin δ of a residual mount
 * misalignment up to 5° taken as 2σ (A-21), which looks like a bias on a flat road.
 */
export const INITIAL_BIAS_SIGMA = Math.hypot(
  10e-3 * STANDARD_GRAVITY,
  (STANDARD_GRAVITY * Math.sin((5 * Math.PI) / 180)) / 2,
)
