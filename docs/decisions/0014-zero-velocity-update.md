# 0014. Zero-velocity update in the Kalman filter

- Status: accepted
- Date: 2026-10-25
- Phase: 2

## Context

In stop-and-go traffic inside the tunnel, the filter has no GNSS. While the car stands
still, any speed error keeps moving the estimate, and the bias keeps integrating. A
standing car is the one moment when the speed is known exactly: zero. The filter needs a
way to detect that from the accelerometer alone.

## Decision

- **Detector:** the sample standard deviation of `f` over the last 0.5 s. The mean (grade,
  bias, steady acceleration) does not matter, only the spread. The car is taken as standing
  when the spread is below 0.23 m/s².
- **Threshold from the vibration law** σ(v) = 0.2 + 0.03·v (A-32): 0.23 m/s² is the
  vibration RMS at 1 m/s. A standing car reads about 0.20 m/s² (vibration plus 0.011 m/s²
  white noise), 2 m/s reads 0.26 m/s².
- **Window** 0.5 s: about 12 periods of the 25 Hz vibration, so the spread estimate is
  stable, and short against a stop of several seconds. No detection during the first 0.5 s
  of data.
- **Update:** a pseudo-measurement `v = 0` with σ = 0.05 m/s at every accelerometer sample
  while stationary, not gated (A-56). Over a stop it also makes the bias observable.

## Alternatives considered

- **Threshold on |f − g·sin θ| (the mean):** a car cruising at constant speed also reads
  near zero mean.
- **Longer window (2 s):** more stable, but the start and end of every stop are missed.
- **Speed-based detection (|v̂| small):** circular; the speed estimate is what drifts.

## Consequences

- **Limitation: the threshold comes from the simulator's own vibration law**, so ZUPT works
  better here than on a real phone, where vibration differs between cars, roads and mounts.
- **Fails for crawling below about 1 m/s:** the car is taken as standing, the speed is
  forced to 0 and the estimate falls behind (0.5 m/s for 30 s is 15 m). The stop-and-go
  scenario contains such a crawl on purpose, and a test documents it.
- An accelerometer with almost no vibration (or a noise-free test input) looks stationary
  even at speed; the filter's own tests therefore feed a vibrating signal.
