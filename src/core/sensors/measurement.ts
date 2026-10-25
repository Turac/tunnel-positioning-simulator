// What estimators see: a time-stamped stream of measurements and nothing else. See ADR-0007.
//
// This is the one sensor file estimators may import, so it holds types and pure time-grid
// helpers only. It must never carry ground truth (true position, true bias, ...) and must not
// import world/, sim/ or other sensor files (enforced by eslint.config.js).

/** One accelerometer sample. */
export interface AccelMeasurement {
  readonly kind: 'accel'
  /** Sample time since scenario start, s. */
  readonly t: number
  /**
   * Specific force along the phone's forward axis, m/s². Not the acceleration: an
   * accelerometer also senses gravity, so a car standing on a grade reads g·sin θ.
   */
  readonly f: number
}

/** One GNSS fix. */
export interface GnssMeasurement {
  readonly kind: 'gnss'
  /** Fix time since scenario start, s. */
  readonly t: number
  /** Map-matched position along the centerline, m. */
  readonly s: number
  /** Speed along the road, m/s. */
  readonly speed: number
  /** Position accuracy reported by the receiver (1σ), m. Not necessarily the true error. */
  readonly reportedSigma: number
  /** Speed accuracy reported by the receiver (1σ), m/s. Not necessarily the true error. */
  readonly reportedSpeedSigma: number
}

export type Measurement = AccelMeasurement | GnssMeasurement

function assertRate(rateHz: number): void {
  if (!Number.isFinite(rateHz) || rateHz <= 0) {
    throw new RangeError(`Sample rate must be a finite number > 0 Hz, got ${rateHz}`)
  }
}

/**
 * Time of sample k on a grid of rateHz, s: k / rateHz.
 *
 * Computed from the integer index, never by accumulating 1 / rateHz: adding 0.01 30 000 times
 * gives 299.99999999987216, not 300.
 */
export function sampleTime(k: number, rateHz: number): number {
  if (!Number.isSafeInteger(k) || k < 0) {
    throw new RangeError(`Sample index must be a safe integer >= 0, got ${k}`)
  }
  assertRate(rateHz)
  return k / rateHz
}

/**
 * Largest k with sampleTime(k, rateHz) <= tEnd.
 *
 * Math.floor(tEnd · rateHz) alone can be wrong in both directions because of rounding in the
 * product: for tEnd = 0.29 at 100 Hz it gives 28 (the answer is 29), and for
 * tEnd = 0.049999999999999996 it gives 5 (the answer is 4). The estimate is corrected
 * against the definition.
 */
export function lastSampleIndex(tEnd: number, rateHz: number): number {
  if (!Number.isFinite(tEnd) || tEnd < 0) {
    throw new RangeError(`End time must be a finite number >= 0 s, got ${tEnd}`)
  }
  assertRate(rateHz)
  let k = Math.floor(tEnd * rateHz)
  while (k > 0 && k / rateHz > tEnd) k--
  while ((k + 1) / rateHz <= tEnd) k++
  return k
}
