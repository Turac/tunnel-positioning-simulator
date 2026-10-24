# 0004. Seeded PRNG: xoshiro128** seeded with SplitMix64

- Status: accepted
- Date: 2026-10-24
- Phase: 0

## Context

All noise in the simulator must be reproducible: the same scenario and seed must give
identical output (CLAUDE.md hard rule 2), otherwise a regression test cannot tell a worse
estimator from unlucky noise. For example, an accelerometer bias of 0.05 m/s² alone gives
½ · 0.05 · 60² = 90 m of position error after 60 s; comparing runs only makes sense if the
noise around that is identical. Tuning and reporting seed sets must also be controllable
(hard rule 4).

`Math.random()` cannot be seeded. The generator must run identically in the browser and in
Node, have good statistical quality, and be verifiable against an authoritative source.

## Decision

- **Generator: xoshiro128\*\* version 1.1** (Blackman and Vigna). 128-bit state, period
  2¹²⁸ − 1, uses only 32-bit integer operations, which JavaScript performs exactly with
  `Math.imul` and bitwise operators. Version 1.1 matters: version 1.0 passed `s[0]` instead
  of `s[1]` to the scrambler.
- **Seeding: SplitMix64** (Vigna), as recommended by the xoshiro authors. A seed is an
  integer in [0, 2³² − 1]. Two consecutive SplitMix64 outputs fill the 128-bit state. SplitMix64
  never produces an all-zero state (the one state xoshiro forbids), and nearby seeds
  (1, 2, 3, …) give unrelated states. It needs 64-bit arithmetic, done with `BigInt`; this
  runs only at seeding time, never per sample.
- **Word order (project convention, not specified by the authors):** each 64-bit SplitMix64
  output is split low 32 bits first, then high 32 bits:
  `s[0] = low(z1)`, `s[1] = high(z1)`, `s[2] = low(z2)`, `s[3] = high(z2)`.
- **Uniform samples:** a uint32 output divided by 2³², giving [0, 1); 1 is never returned.
- **Verification against official sources, not memory.** Expected test values come from
  the authors' official C files (`xoshiro128starstar.c`, the `f2x.c` it includes, and
  `splitmix64.c`), downloaded from prng.di.unimi.it, stored unmodified with their URLs and
  SHA-256 hashes in `tests/reference/`, compiled with a separate harness that only adds
  `main()`, and run with fixed inputs. If both the C reference and the TypeScript port
  came from an AI's recollection, a shared mistake would make the test pass. The values
  were also recomputed independently by the project author.

Gaussian sampling and named streams are separate decisions, added on top of this generator.

## Alternatives considered

- **`Math.random()`:** cannot be seeded; forbidden by hard rule 2.
- **mulberry32:** very small, but 32-bit state (period 2³²) and weaker statistical quality.
- **sfc32:** good quality, but less widely documented and no official reference file from
  the same authors.
- **PCG32 / Mersenne Twister:** PCG32 needs 64-bit multiplication on every sample (slow
  with `BigInt`); Mersenne Twister has a large state and is more complex to port.
- **splitmix32 for seeding:** no official reference implementation from the authors, so
  its test values could only come from memory.
- **An npm package (e.g. seedrandom):** a dependency for about 40 lines of code that we can
  verify ourselves.

## Consequences

- Same seed, same sequence, on every platform. Any change to the generator, the seeding or
  the word order changes every recorded result; the reference and end-to-end tests catch
  that.
- Anyone can reproduce the expected values with a C compiler (`tests/reference/README.md`).
- Seeds are limited to 32 bits. That is ample for Monte Carlo seed sets in this project.
