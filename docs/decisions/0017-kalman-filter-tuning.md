# 0017. Kalman filter tuning

- Status: accepted
- Date: 2026-10-25
- Phase: 2

## Context

ADR-0013 left two values of the Kalman filter A2 to be tuned (A-53, A-54). Untuned
(`q_extra = 0`, `gnssRScale = 1`), the filter was over-confident: mean in-tunnel ±2σ
coverage 0.70 in baseline, 0.87 in long and 0.79 in graded, against about 0.95 for a
consistent estimate.

## Decision

**Two parameters were tuned, on the tuning seed set only** (seeds 1–50, ADR-0016), on
baseline, long, stop-and-go and graded. poor-sensor is a model-mismatch case and was not
used.

- **`gnssRScale = 2`** compensates for the time-correlated GNSS error (τ = 60 s, A-34) that
  the filter models as white. It multiplies the reported **σ**, so `R = (2·reportedSigma)²`
  and the variance is 4 times larger.
- **`q_extra = 3·10⁻⁴ (m/s²)²·s`** covers unmodelled errors that accumulate in long tunnels
  (vibration residual, scale factor, misalignment), added to the velocity random walk.

Criterion: mean in-tunnel coverage closest to 95 % across baseline, long and graded. The
exit error barely depends on these values; they mainly change how honestly the filter
reports its own uncertainty.

### Tuning grid

A2, tuning set, 50 runs per scenario. Coverage = mean over runs of the in-tunnel ±2σ
coverage (P10 in brackets). Exit error = median / P95, m.

| q_extra, gnssRScale | baseline | long | graded | stop-and-go | Exit error baseline · long · graded |
|---|---|---|---|---|---|
| 0, 1 | 0.70 (0.00) | 0.87 (0.68) | 0.79 (0.34) | 0.42 | 4.6/12.5 · 80/210 · 17/47 |
| 0, 1.5 | 0.76 (0.10) | 0.91 (0.79) | 0.85 (0.60) | 0.45 | — |
| 0, 2 | 0.85 (0.45) | 0.93 (0.85) | 0.91 (0.74) | 0.48 | 4.7/12.0 · 65/198 · 17/50 |
| 10⁻⁴, 1 | 0.77 (0.26) | 0.93 (0.83) | 0.90 (0.72) | 0.46 | 3.8/11.8 · 71/201 · 16/46 |
| 10⁻⁴, 1.5 | 0.85 (0.41) | 0.94 (0.87) | 0.93 (0.79) | 0.48 | — |
| 3·10⁻⁴, 1.5 | 0.90 (0.62) | 0.96 (0.92) | 0.95 (0.85) | 0.49 | 4.2/12.6 · 68/193 · 14/50 |
| **3·10⁻⁴, 2** | **0.93 (0.77)** | **0.97 (0.95)** | **0.96 (0.90)** | 0.50 | 4.4/12.9 · 74/199 · 17/50 |
| 10⁻³, 1 | 0.91 (0.78) | 0.98 (0.96) | 0.96 (0.90) | 0.51 | 4.4/13.8 · 73/192 · 16/49 |
| 10⁻³, 1.5 | 0.94 (0.83) | 0.99 (0.97) | 0.97 (0.92) | 0.52 | 5.1/14.6 · 76/206 · 17/51 |
| 10⁻³, 2 | 0.95 (0.88) | 0.99 (0.98) | 0.98 (0.94) | 0.52 | 5.3/14.8 · 76/214 · 17/52 |
| 3·10⁻³, 1 | 0.95 (0.85) | 0.99 (0.97) | 0.98 (0.93) | 0.57 | 5.8/16.1 · 82/194 · 20/55 |

"—": exit error not recorded for that point.

## Alternatives considered

- **`10⁻³, 2`:** baseline exactly at 0.95, but long and graded at 0.98–0.99, more cautious
  than needed and with slightly larger errors.
- **Only one parameter:** the two address different problems. Scaling R fixes the
  over-confidence at the tunnel entrance in a short tunnel; q_extra fixes the growth in a
  long one. Either alone needs an extreme value to fix the other case.
- **A Gauss–Markov state for the GNSS error** instead of scaling R: see ADR-0013.

## Consequences

- **Known limitation: stop-and-go coverage stays about 0.5** for every value in the grid.
  The crawl at 0.5 m/s is taken as standing (ADR-0014). The error is systematic, so
  repeated ZUPTs accumulate it, and no process noise makes the filter doubt a belief it
  keeps confirming. It is not tuned for and is reported as it is.
- Baseline stays slightly over-confident (0.93) and long slightly cautious (0.97).
- The results on the report seeds are the check that the tuning did not overfit.
