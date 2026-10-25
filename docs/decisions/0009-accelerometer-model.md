# 0009. Accelerometer model

- Status: accepted
- Date: 2026-10-25
- Phase: 1

## Context

The estimators integrate the phone's forward acceleration through the tunnel, so every
accelerometer error grows into a position error: a constant 0.098 m/s² bias gives
½ · 0.098 · 60² ≈ 177 m after 60 s. The simulator must model the error sources of a consumer
MEMS accelerometer realistically, and may model more than the estimators do (no inverse
crime).

## Decision

```
f = (1 + sf)·[a·cos δ + g·sin(θ + δ)] + b0 + b_drift(t) + n_sensor + n_vib(t, v)
```

sampled at `t = k / rateHz` (A-22, 100 Hz) up to the run end.

- **Raw specific force, not the OS "linear acceleration" sensor.** An accelerometer senses
  specific force, so a car standing on a grade reads `g·sin θ` (0.39 m/s² on 4 %). Android's
  `TYPE_LINEAR_ACCELERATION` and iOS `userAcceleration` remove gravity with the OS's own
  attitude filter, which is a black box and can misattribute sustained acceleration. Using
  the raw signal lets the estimator remove gravity explicitly with the known grade (A-12).
- **Phone-to-car axes** are known from calibration before the tunnel (A-21). The simulator
  produces the forward-axis projection; the remaining error is a residual pitch
  misalignment `δ`, a scenario parameter, default 0. A pitched phone sees part of the
  vertical specific force: `g·sin(θ + δ)` (1° adds ≈ 0.17 m/s²). Yaw misalignment only scales
  the forward axis by `cos ψ` on a road without lateral acceleration, which the scale-factor
  term already covers.
- **Error terms** (values and sources in A-23, A-30..A-33):
  - sensor white noise, `σ = density·√(rateHz / 2)`;
  - turn-on bias `b0`, one draw per run at datasheet scale (no OS calibration assumed);
  - bias drift, a random walk with continuous-time intensity `q`; the discrete increment
    has variance `q·Δt`, so the drift variance at a given time does not depend on the rate;
  - vehicle vibration, a sinusoid `√2·σ(v)·sin(2πft + φ)` with RMS `σ(v) = σ0 + k·v` and a
    phase drawn once per run. A real vibration has zero mean. Modelled as white noise it
    would integrate into a random walk (σ = 0.8 m/s² at 100 Hz gives ≈ 180 m after 250 s)
    whose size depends on the sample rate. The integrated sinusoid gives a bounded velocity
    error, with a constant offset `A·cos φ / ω` that moves position by at most ≈ 1 m in 250 s.
    `f` must be below Nyquist (`rateHz / 2`);
  - scale-factor error `sf`, off by default.
- **Gravity** is the standard value 9.80665 m/s² (A-30), in `src/core/physics/constants.ts`,
  which estimators may import and which may not import world/, sensors/ or sim/ (lint rule).
- **Random streams** (ADR-0006, append-only): `accelerometer: 1` sensor white noise,
  `accelBiasInitial: 3`, `accelBiasDrift: 4`, `accelVibration: 5`. Every stream is drawn
  whether or not its term is switched on, so enabling one term leaves the others' draws
  unchanged.

## Alternatives considered

- **OS linear-acceleration sensor:** gravity removal by an unknown filter.
- **Vibration as white noise:** integrates into a rate-dependent random walk that a real,
  zero-mean vibration does not produce.
- **Gauss–Markov bias drift:** needs a correlation time the datasheet does not give.
- **Turn-on bias as 1σ = 20 mg:** the datasheet value is a lifetime upper bound.
- **Scale-factor error out of scope:** it costs one factor and is useful in a sensitivity
  analysis, so it is included, off by default.

## Consequences

- With all terms off, the sensor returns the exact specific force, which tests use.
- The vibration source is a bus-seat measurement, not a phone mount; its values are an
  order of magnitude and a candidate for the sensitivity analysis.
- A single vibration frequency is a simplification; real vibration is broadband.
- Not modelled: quantisation, saturation, timestamp latency and jitter (E2), and a phone
  that moves in its mount (E6).
