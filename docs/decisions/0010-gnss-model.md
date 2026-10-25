# 0010. GNSS model: outage, reacquisition and reported accuracy

- Status: accepted
- Date: 2026-10-25
- Phase: 1

## Context

GNSS anchors the estimate before the tunnel (bias learning) and corrects it after the exit.
The interesting failures happen at the boundaries: when the fix disappears, when it comes
back, and how wrong the first fixes are while the receiver still reports them as good. The
simulator must also keep the extension invariant: changing the tunnel length or adding an
error term must not shift the noise of other fixes.

## Decision

- **Fixes** at `t = k / rateHz` (A-24, 1 Hz): map-matched position `s` along the
  centerline, speed, reported position σ and reported speed σ.
- **Open-sky position error:** first-order Gauss–Markov with stationary σ = 2.0 m (A-25) and
  correlation time τ = 60 s (A-34), discretised exactly: `e_k = φ·e_(k−1) + w_k`,
  `φ = e^(−Δt/τ)`, `Var(w) = σ²(1 − φ²)`. The first value is drawn from the stationary
  distribution `N(0, σ²)`, so the variance is σ² from the first fix on. Real GNSS errors are
  correlated over tens of seconds; an estimator that assumes white noise may be
  over-confident, which is a realistic failure mode, not a simulator defect.
- **Speed error:** white, σ = 0.5 m/s (A-35); the reported speed is clamped to ≥ 0.
- **Draws are independent of publication.** All streams are drawn at every grid step for the
  whole run, inside the tunnel too. The tunnel only blocks publication. The draws at a given
  time therefore do not depend on the tunnel length.
- **Publication rule:** a fix is published when `s < 0` (before the tunnel), or when
  `s > L` **and** `t ≥ t_exit + d`. Both conditions are needed: at `t_exit` the car is at the
  portal, which counts as inside (ADR-0008), so with `d = 0` a time rule alone would
  contradict the position rule.
- **Reacquisition delay** `d ~ U(1 s, 20 s)`, one draw per run (A-36).
- **Extra error after reacquisition:** `σ_extra(t) = σ_r·exp(−(t − t_reacq)/τ_r)` with
  `t_reacq = t_exit + d`, σ_r = 20 m, τ_r = 10 s (A-37), white per fix. The decay depends on
  time since reacquisition, not on the number of fixes, so it does not change with the rate.
- **Reported accuracy** is deterministic (A-38):
  `reportedSigma = √((κ_open·σ)² + (κ_reacq·σ_extra)²)`, `reportedSpeedSigma = κ_open·σ_speed`,
  with κ_open = 1 and κ_reacq = 0.5: the receiver understates the extra error just after
  reacquisition, which is where gating matters.
- **Random streams** (ADR-0006, append-only): `gnss: 2` position error, `gnssSpeed: 6`,
  `gnssReacquisitionDelay: 7`, `gnssReacquisitionError: 8`.

## Alternatives considered

- **White position error:** simpler, but hides the correlated-error failure mode.
- **Starting the Gauss–Markov process at 0:** the first fixes would be too accurate.
- **Drawing only when a fix is published:** the tunnel length would shift every later draw.
- **Publication by time only (`t ≥ t_exit + d`):** contradicts the position rule for `d = 0`.
- **Decay counted in fixes:** would depend on the fix rate.
- **Random reported accuracy (its own stream):** more realism, but nothing in the core
  needs it.

## Consequences

- Four values have no published source (τ, σ_r, τ_r, κ_reacq); they are marked as our
  choices in ASSUMPTIONS.md and are candidates for the sensitivity analysis.
- A deterministic "GNSS jump on exit" offset is not part of this model; it belongs to the
  scenario that needs it.
- Not modelled: gradual degradation at the portal and stale fixes (E3), multipath, and
  differences between phones.
