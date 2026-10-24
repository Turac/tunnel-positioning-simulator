// Named random streams: one per independent random source, not one per sensor, so that
// adding a new error term later never shifts the draws of existing ones. See ADR-0006.
//
// IDs are PERMANENT and APPEND-ONLY. Never renumber an entry and never reuse the ID of a
// retired one: changing an ID changes every recorded result that uses that stream.
// tests/random/streams.test.ts pins this table. IDs start at 1 (see streamInput in rng.ts).

export const STREAM_IDS = {
  accelerometer: 1,
  gnss: 2,
} as const

export type StreamName = keyof typeof STREAM_IDS
