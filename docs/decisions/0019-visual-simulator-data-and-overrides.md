# 0019. Visual simulator: single-run data flow, parameter overrides and fixed bias

- Status: accepted
- Date: 2026-10-25
- Phase: 3

## Context

The visual simulator shows one run: the true car, each estimator's position and uncertainty,
the sensor data and the metrics. Its user changes the scenario, seed, tunnel length,
accelerometer bias and grade live. Three constraints apply: estimators see only measurements
and the map (CLAUDE.md hard rule 1), `eval/` is the only place truth meets estimates, and
existing scenarios and seeds must give identical results (fixed-seed regression snapshot,
`tests/eval/regression.test.ts`). The task's tunnel length range (A-02) was documented as
checked by scenario validation, but no such validation existed.

## Decision

### Single-run data flow

- `runSingle(config, seed, estimators)` in `src/core/eval/single-run.ts` returns, as plain
  data, the map, the truth, the measurement series, and per estimator its estimates, its
  `RunMetrics` and its announcement events. It reuses `simulateRun`, `runEstimator` and
  `computeMetrics`; estimators still receive only `map` and `measurements`.
- Announcement metrics and the events the UI draws come from one helper, so they cannot
  disagree.
- `src/ui` may not import `world/` or `sim/` (lint rule with a boundary test): the UI draws
  what `eval/` gives it and does not assemble truth itself.
- The run is recomputed synchronously on the main thread when a parameter is committed; a
  5 km run with three estimators takes a fraction of a second. Series are decimated for
  drawing by keeping the first, minimum, maximum and last sample per pixel bucket, so no
  error peak is dropped.

### Parameter overrides (A-45)

- `applyOverrides(scenario, overrides)` in `src/core/scenarios/overrides.ts` and every
  built-in scenario go through `validateScenario` (`src/core/scenarios/validate.ts`): tunnel
  length in [500, 5000] m (A-02), |grade| ≤ 5 % (A-18), then the existing map, speed-profile
  and trajectory checks.
- Tunnel length L → L′: `exitS′ = round(exitS · L′/L)`; in-tunnel grade keypoints scale by
  L′/L, keypoints past the far portal shift by L′ − L; approach and departure unchanged. A
  profile that no longer reaches the road end gets one keypoint at its final speed.
- Grade: flat outside, constant inside, 100 m linear ramps inside each portal.

### Fixed turn-on bias

- `AccelerometerConfig.turnOnBiasFixed` (optional, undefined by default) replaces the drawn
  turn-on bias b0. b0 is still drawn from its own stream, so no other error term shifts.

## Alternatives considered

- **UI calls `simulateRun` and `runEstimator` itself:** a second place where truth meets
  estimates, and metric logic duplicated in the UI.
- **Web Worker:** not needed at the measured run time; `RunResult` is already plain data, so
  it remains the fallback.
- **Every N-th sample or bucket averages for drawing:** both can hide a single-sample peak.
- **Keep exitS fixed when the length changes:** invalid as soon as L′ ≤ exitS.
- **Bias slider scales `turnOnBiasSigma`:** the slider would be a σ, not the bias the car
  has, and its effect could not be computed by hand. **An additive offset on the drawn b0:**
  same problem.
- **Three separate ADRs:** the three parts serve one feature and are reviewed together.

## Consequences

- A-02 is now enforced for every scenario.
- With a short tunnel, an announcement point can lie before the entrance; it is shown as is.
- Stop-and-go keeps its events at the same times, so a shorter tunnel moves them relative to
  the portals: at 500 m the crawl (s ≈ 517–527 m) happens after the far portal.
- The regression snapshot proves the overrides and the fixed-bias option leave every
  existing scenario and seed unchanged.
