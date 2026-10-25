# 0013. Kalman filter A2: bias state, grade compensation and GNSS gating

- Status: accepted
- Date: 2026-10-25
- Phase: 2

## Context

Pure integration (A1) fails because the accelerometer bias is unknown: 0.1 m/s² over 250 s
is about 3 km by ½·b·t². The bias must be learned before the tunnel while GNSS is
available. After the tunnel, the first fixes can be tens of metres wrong while the receiver
reports them as good (A-37, A-38), so the filter must not accept every fix blindly, and it
must not reject GNSS forever either.

## Decision

- **State** `[s, v, b]`. Initialised at the first fix: `s`, `v` from the fix, `b = 0`;
  `P0 = diag(σ_fix², σ_speed², σ_b0²)` with σ_b0 ≈ 0.44 m/s² (A-51).
- **Prediction** at every accelerometer sample: `â = f − g·sin θ(ŝ) − b`,
  `s += v·Δt + ½·â·Δt²`, `v += â·Δt`.
- **Extended filter.** `â` depends on `ŝ` through the grade, so the Jacobian has
  `∂â/∂s = −g·cos θ·dθ/ds` with `dθ/ds = (d grade/ds)/(1 + grade²)` (`gradeSlopeAt`). It is
  zero on a constant grade; on a 4 % change over 100 m it is about 0.004 m/s² per metre of
  position error, about 0.08 m/s² at σ_s = 20 m, the size of the bias itself. Leaving it out
  would make the covariance ignore that a position error becomes an acceleration error.
- **Process noise** from the sensor model: velocity random walk ND²/2 (A-50) plus an extra
  margin `q_extra` (A-53), bias random walk (A-52). Vibration is assumed zero-mean and
  high-frequency, so its integral is bounded and it is not added as white noise; whatever
  it and other unmodelled terms leave is covered by `q_extra`.
- **Updates:** GNSS position and speed are separate scalar updates with
  `R = (gnssRScale·reportedSigma)²` (A-54) and `reportedSpeedSigma²`.
- **Gate:** each scalar update is rejected when `ν²/(P_ii + R) > 6.63` (χ²₁, 99 %, A-55).
- **No permanent rejection:** after 3 consecutive rejected position fixes,
  `P_ss ← max(P_ss, ν²/6.63 − R)` and the normal update follows. The innovation then sits
  exactly at the gate, so the fix is accepted with the filter's own weight; the counter
  restarts after an accepted fix.
- **Tuning:** `q_extra` and `gnssRScale` are the only tuned values, on the tuning seeds of
  baseline, long, stop-and-go and graded (A-53, A-54).

## Alternatives considered

- **Linear KF without the grade Jacobian:** identical on constant grades, over-confident on
  grade changes.
- **Joint 2-D gate (χ²₂ = 9.21):** rejects position and speed together; a bad position would
  also discard a good speed.
- **Resetting `s` and `v` to the fix after repeated rejections:** just after the exit the
  fix itself can carry about 15 m of extra error; the filter would adopt it.
- **A Gauss–Markov state for the GNSS error:** models the correlation (τ = 60 s) properly
  but adds a state and needs τ, which has no source (A-34). Scaling R is the simpler
  first step.
- **Vibration as white noise in Q:** σ = 0.8 m/s² integrated as white noise grows the
  speed σ by about 0.8 m/s in 100 s, far more than the bounded effect of a vibration.

## Consequences

- The filter treats GNSS errors as independent although they are correlated; until
  `gnssRScale` is tuned, it is over-confident (first baseline runs: in-tunnel coverage
  13–100 % across seeds).
- The vibration assumption fails for broadband vibration with energy at low frequencies;
  that would show as low coverage.
- With 3 rejections at 1 Hz, a genuine jump in GNSS is followed after 3 s, not ignored.
