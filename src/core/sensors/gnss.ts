// GNSS fixes: map-matched position along the centerline and speed. See ADR-0010.
//
// Errors evolve on a fixed grid t = k / rateHz for the whole run, inside the tunnel too;
// the tunnel only blocks publication. So the draws at a given time do not depend on the
// tunnel length or on when fixes are published.

import { createStreamRng } from '../random/rng'
import { truthAt, type Trajectory } from '../world/trajectory'
import { lastSampleIndex, sampleTime, type GnssMeasurement } from './measurement'

export interface GnssConfig {
  /** Fix rate, Hz (A-24). */
  readonly rateHz: number
  /** Open-sky along-track position error σ, m (A-25). */
  readonly positionSigma: number
  /** Correlation time of the position error (first-order Gauss–Markov), s (A-34). */
  readonly positionTau: number
  /** Speed error σ (white), m/s (A-35). */
  readonly speedSigma: number
  /** Reacquisition delay after the exit, drawn once per run from U(min, max), s (A-36). */
  readonly reacquisitionDelayMin: number
  readonly reacquisitionDelayMax: number
  /** Extra position error after reacquisition: σ_r·exp(−(t − t_reacq)/τ_r) (A-37). */
  readonly reacquisitionSigma: number
  readonly reacquisitionTau: number
  /** Reported σ as a fraction of the model σ: open sky and extra error (A-38). */
  readonly reportedScaleOpen: number
  readonly reportedScaleReacquisition: number
  /**
   * Off-by-default exit jump: a constant along-track offset on every fix in
   * [t_reacq, t_reacq + exitJumpDuration), not reflected in the reported σ, m (A-39).
   */
  readonly exitJumpOffset: number
  readonly exitJumpDuration: number
}

/** Default phone GNSS (A-24, A-25, A-34..A-39). */
export const DEFAULT_GNSS: GnssConfig = {
  rateHz: 1,
  positionSigma: 2.0,
  positionTau: 60,
  speedSigma: 0.5,
  reacquisitionDelayMin: 1,
  reacquisitionDelayMax: 20,
  reacquisitionSigma: 20,
  reacquisitionTau: 10,
  reportedScaleOpen: 1,
  reportedScaleReacquisition: 0.5,
  exitJumpOffset: 0,
  exitJumpDuration: 0,
}

export function simulateGnss(
  trajectory: Trajectory,
  config: GnssConfig,
  seed: number,
): GnssMeasurement[] {
  const { rateHz, positionSigma, positionTau } = config
  if (!(config.reacquisitionDelayMin >= 0 && config.reacquisitionDelayMin <= config.reacquisitionDelayMax)) {
    throw new RangeError(
      `Reacquisition delay range must satisfy 0 <= min <= max, got [${config.reacquisitionDelayMin}, ${config.reacquisitionDelayMax}]`,
    )
  }
  if (!(positionTau > 0) || !(config.reacquisitionTau > 0)) {
    throw new RangeError('Correlation and decay times must be > 0 s')
  }

  const positionRng = createStreamRng(seed, 'gnss')
  const speedRng = createStreamRng(seed, 'gnssSpeed')
  const extraRng = createStreamRng(seed, 'gnssReacquisitionError')
  const delay =
    config.reacquisitionDelayMin +
    (config.reacquisitionDelayMax - config.reacquisitionDelayMin) *
      createStreamRng(seed, 'gnssReacquisitionDelay').uniform()
  const reacquisitionTime = trajectory.exitTime + delay

  // Exact discretisation of a first-order Gauss–Markov process with stationary σ.
  const phi = Math.exp(-1 / (rateHz * positionTau))
  const stepSigma = positionSigma * Math.sqrt(1 - phi * phi)
  const tunnelLength = trajectory.map.tunnelLength

  const out: GnssMeasurement[] = []
  let positionError = 0
  const n = lastSampleIndex(trajectory.runEnd, rateHz) + 1
  for (let k = 0; k < n; k++) {
    const t = sampleTime(k, rateHz)
    // Every stream is drawn at every grid step, published or not.
    positionError =
      k === 0
        ? positionRng.gaussian(0, positionSigma) // start from the stationary distribution
        : phi * positionError + positionRng.gaussian(0, stepSigma)
    const speedError = speedRng.gaussian(0, config.speedSigma)
    const extraUnit = extraRng.gaussian(0, 1)

    const truth = truthAt(trajectory, t)
    // Before the tunnel, or after it once the car is outside AND the delay has passed. At
    // exitTime the car is still at the portal (inside), so both conditions are needed.
    const published = truth.s < 0 || (truth.s > tunnelLength && t >= reacquisitionTime)
    if (!published) continue

    const extraSigma =
      t >= reacquisitionTime
        ? config.reacquisitionSigma * Math.exp(-(t - reacquisitionTime) / config.reacquisitionTau)
        : 0
    const jump =
      t >= reacquisitionTime && t < reacquisitionTime + config.exitJumpDuration
        ? config.exitJumpOffset
        : 0
    out.push({
      kind: 'gnss',
      t,
      s: truth.s + positionError + extraSigma * extraUnit + jump,
      // Receivers report speed >= 0; clamping biases the reading slightly near a stop.
      speed: Math.max(0, truth.v + speedError),
      reportedSigma: Math.hypot(
        config.reportedScaleOpen * positionSigma,
        config.reportedScaleReacquisition * extraSigma,
      ),
      reportedSpeedSigma: config.reportedScaleOpen * config.speedSigma,
    })
  }
  return out
}
