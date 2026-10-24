# 0006. Named random streams from a permanent ID table

- Status: accepted
- Date: 2026-10-24
- Phase: 0

## Context

If all random sources in a scenario drew from one shared generator, changing one of them
would shift the noise of all the others. Example: at 100 Hz over 300 s the accelerometer
draws 30 000 normal samples (60 000 uniforms). If GNSS shared that stream and its rate
went from 1 Hz to 2 Hz, every accelerometer noise value after the first second would
change, and "did 2 Hz GNSS help?" would be mixed with accelerometer luck. Each random
source therefore needs its own reproducible stream, derived from the scenario seed.

The planned design hashed a stream name with FNV-1a and reduced the result to a 32-bit
seed. FNV-1a would need its own official reference and verification (ADR-0004 requires
expected values from an independent source, not from memory).

## Decision

- **One stream per independent random source, not one per sensor.** For example,
  accelerometer white noise, initial bias and bias drift can each get their own stream, so
  adding a new error term later never shifts the draws of existing ones. The exact
  sources are decided in Phase 1 and their IDs appended to the table.
- **A permanent ID table** in `src/core/random/streams.ts` maps each stream name to an
  integer ID. Initial table: `accelerometer: 1`, `gnss: 2`.
- **IDs are permanent and append-only.** Never renumber an entry and never reuse the ID of
  a retired one: changing an ID changes every recorded result that uses that stream. A
  test pins the table, so accidental renumbering fails.
- **Derivation, no hash and no truncation.** A stream's xoshiro128** state is filled
  directly by SplitMix64 initialised with the 64-bit value `(streamId << 32) | seed`, using
  the same low-then-high word split as `createRng` (ADR-0004).
- **Streams never coincide with plain seeds.** IDs start at 1, so every stream input is
  ≥ 2³², while every plain `createRng(seed)` input is < 2³². This holds for all seeds,
  including 0 and 2³² − 1; a test pins both boundaries.
- **Verification.** The official SplitMix64 harness computes the input and the word split
  in C and prints the resulting state for stream 1 / seed 42, stream 2 / seed 42,
  stream 1 / seed 0 and stream 1 / seed 2³² − 1. The official xoshiro128** harness prints
  the outputs of the stream 1 / seed 42 state for an end-to-end check. Expected values come
  from those outputs and were recomputed independently by the project author.

## Alternatives considered

- **FNV-1a hash of the stream name (the original plan):** any name works without a
  central table, but needs a second official reference source and verification. The
  project has few streams, and a single table is easier to read and review.
- **Reducing the derived value to a 32-bit seed and calling `createRng`:** an unnecessary
  extra step that maps many inputs onto 2³² seeds and loses the separation from plain seeds.
- **Input `(seed << 32) | streamId`:** collides for seed 0. `(0 << 32) | 1 = 1`, so stream 1
  with seed 0 would reproduce `createRng(1)`. Found before implementation and rejected.
- **One stream per sensor:** simpler table, but adding an error term to a sensor would shift
  that sensor's existing draws and change existing results (CLAUDE.md extension points).

## Consequences

- Adding a stream (new sensor or new error term) changes no existing result, which
  supports the extension-point invariant in `CLAUDE.md`.
- The table must be maintained by hand; the pinning test makes changes to it explicit.
- Seeds stay 32-bit and stream IDs are limited to [1, 2³² − 1], far beyond the project's needs.
