// Named random streams: one per independent random source, not one per sensor, so that
// adding a new error term later never shifts the draws of existing ones. See ADR-0006.
//
// IDs are PERMANENT and APPEND-ONLY. Never renumber an entry and never reuse the ID of a
// retired one: changing an ID changes every recorded result that uses that stream.
// tests/random/streams.test.ts pins this table. IDs start at 1 (see streamInput in rng.ts).

export const STREAM_IDS = {
  accelerometer: 1, // accelerometer sensor white noise (ADR-0009)
  gnss: 2,
  accelBiasInitial: 3, // accelerometer turn-on bias, one draw per run
  accelBiasDrift: 4, // accelerometer bias random-walk increments
  accelVibration: 5, // vibration phase, one draw per run
  gnssSpeed: 6, // GNSS speed white noise (ADR-0010); gnss: 2 is the position error
  gnssReacquisitionDelay: 7, // reacquisition delay, one draw per run
  gnssReacquisitionError: 8, // extra position error after reacquisition
} as const

export type StreamName = keyof typeof STREAM_IDS
