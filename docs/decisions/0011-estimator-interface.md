# 0011. Estimator interface and the constant-velocity baseline

- Status: accepted
- Date: 2026-10-25
- Phase: 2

## Context

Several estimators are compared on the same runs. Each must work as it would on a phone:
online, one measurement at a time, with only the map and the measurement stream (CLAUDE.md
hard rule 1). The evaluator needs one estimate per accelerometer sample to compare with the
truth, which is sampled on the same grid (ADR-0008).

## Decision

- An estimator is created from the map (`create(map)`) and exposes
  `step(measurement) → Estimate | null`. Measurements are given in time order; the estimator
  cannot see a future sample. Before the first GNSS fix it returns `null`.
- `Estimate = { t, s, v, sigmaS, bias? }`: position, speed, the estimator's own 1σ position
  uncertainty and, for estimators with a bias state, the bias estimate.
- `runEstimator` records the output after each accelerometer sample, so estimates line up
  with the truth samples by index. At equal `t` the accelerometer sample comes first
  (ADR-0010), so a GNSS fix shows in the next accelerometer output, 0.01 s later.
- Estimators are listed in `estimators/list.ts`; the evaluator runs every entry.
- **B0, constant velocity:** after each fix, `s = s_fix + v_fix·(t − t_fix)`, `v = v_fix`,
  `sigmaS = √(σ_fix² + (σ_speed·(t − t_fix))²)` from the reported accuracies.

## Alternatives considered

- **Batch interface (whole stream in, trajectory out):** simpler, but allows smoothing with
  future samples, which a live navigation app cannot do.
- **Output at every measurement:** GNSS outputs would not line up with the truth grid.
- **B0 uncertainty with a speed-change term:** needs a tuned acceleration assumption; the
  plain version shows how over-confident a naive baseline is.

## Consequences

- An online test checks that removing the measurements after a time does not change the
  earlier estimates.
- B0's `sigmaS` ignores speed changes, so its coverage is expected to be poor when the car
  brakes or stops; this is the baseline's known weakness, not a defect.
