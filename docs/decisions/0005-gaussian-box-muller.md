# 0005. Gaussian sampling with Box–Muller

- Status: accepted
- Date: 2026-10-24
- Phase: 0

## Context

Sensor noise (accelerometer white noise, GNSS position and speed error) is modelled as
normally distributed. The seeded generator (ADR-0004) produces only uniform samples in
[0, 1), so a transform from uniform to normal samples is needed.

Two properties matter more than speed here:

- **Predictable stream consumption.** Results must be reproducible, and changing one part
  of a scenario should not silently shift the noise of everything drawn after it. That is
  easiest to reason about when every normal sample consumes a fixed number of uniforms.
- **Verifiable correctness.** Unlike xoshiro128** and SplitMix64, there is no official
  reference file with test vectors to compare against.

Scale: about 30 000 noise samples per run (100 Hz IMU over a few minutes, plus 1 Hz GNSS),
so the cost of a transform is negligible.

## Decision

- Use the **Box–Muller transform**, cosine branch only:
  `z = √(−2 ln(1 − u1)) · cos(2π u2)`, then `mean + sigma · z`.
- **Exactly two uniforms per sample**, drawn in the order u1 then u2. The sine branch,
  which would give a second independent normal sample, is discarded.
- **ln(1 − u1) instead of ln(u1).** `uniform()` can return 0 but never 1, so `1 − u1` lies
  in (0, 1] and the logarithm is always finite. With ln(u1), u1 = 0 would give −∞.
- Invalid parameters (non-finite mean or sigma, negative sigma) throw `RangeError`.
  `sigma = 0` returns the mean exactly.

### How correctness is verified without an official reference

- **Analytic inputs with known outputs.** For u1 = 1 − e^(−1/2) the radius is exactly 1, so
  u2 = 0, 0.5 and 0.25 must give 1, −1 and 0 (cos 0, cos π, cos π/2). u1 = 0 must give a
  finite 0. The expected values follow from the formula by hand, not from running our code.
- **Consumption order.** `gaussian()` must equal `boxMuller(u1, u2)` computed from two
  `uniform()` calls on a second generator with the same seed, and the next uniform after
  that must also match. This proves exactly two uniforms are consumed, in order.
- **Moments on a fixed seed.** Over 10⁵ samples: mean 0 ± 0.02 and standard deviation
  1 ± 0.02 (about 6 standard errors); for `gaussian(3, 0.5)`: 3 ± 0.01 and 0.5 ± 0.01.
- **±1σ / ±2σ coverage.** The fraction of samples within ±1σ and ±2σ must be within ±0.005
  of 0.6827 = erf(1/√2) and 0.9545 = erf(√2); these constants were verified independently.
  This is also the basis of the Phase 2 consistency metric (fraction of time the truth lies
  within the filter's ±2σ band).
- **Mutation check.** Each part of the transform and its wiring was broken deliberately
  (sine instead of cosine, radius factor, ln(u1), π instead of 2π, swapped draw order,
  sigma ignored, an extra uniform consumed, negative sigma accepted). Every mutation made
  at least one test fail, so the tests are not always-green.

Because the seed is fixed, the statistical tests are deterministic, not flaky.

## Alternatives considered

- **Marsaglia polar method:** avoids the trigonometric call, but uses rejection sampling, so
  the number of uniforms consumed per sample varies. Stream consumption then depends on
  the values drawn, which is harder to reason about.
- **Ziggurat:** fastest in practice, but needs precomputed tables and a more complex
  implementation with no official reference here. The speed gain does not matter at this
  scale.
- **Caching the sine value for the next call:** halves the uniform draws, but adds hidden
  state to the generator. Whether a call returns the cached value or draws fresh uniforms
  then depends on how many calls came before, so inserting a single `gaussian()` call
  shifts every later sample and interleaving `uniform()` with `gaussian()` becomes
  order-sensitive.
- **Inverse CDF (e.g. Acklam's approximation):** one uniform per sample, but relies on a
  rational approximation whose coefficients would have to come from an external source.

## Consequences

- Each normal sample costs two uniforms, one logarithm, one square root and one cosine;
  negligible at this scale.
- Stream consumption is simple to state: n normal samples consume 2n uniforms.
- Results depend on `Math.log` and `Math.cos`. ECMAScript does not require these to return
  identical results on every engine, so different JavaScript engines could differ in the
  last bit of a normal sample. The integer generator and uniform samples are exact
  everywhere. Determinism is guaranteed for a given runtime (e.g. Node and Chromium share
  V8); bit-for-bit equality across engines is not, and the analytic tests use tolerances.
