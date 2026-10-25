# 0015. Weaker, rate-limited zero-velocity update

- Status: accepted; supersedes the update rule of ADR-0014 (the detector is unchanged)
- Date: 2026-10-25
- Phase: 2

## Context

ADR-0014 applied `v = 0` with σ = 0.05 m/s at every accelerometer sample while the detector
held. The stop-and-go scenario showed three problems (A2, seeds 1–6, before tuning):

- **False triggers at starts and stops.** When the car starts from a stop or slows down,
  the speed is below 1 m/s for a fraction of a second and the detector fires. Forcing a
  moving car to `v = 0` made the filter explain the difference with the bias (0.048 →
  0.072 m/s² at one start), and the wrong bias gave about 18 m of error in the next 30 s.
- **The crawl costs more than the lost distance.** At 0.5 m/s the car is taken as standing
  (the known limitation); the filter also adjusts the bias to match, about 50 m in total.
- **False certainty.** The same information repeated 100 times per second shrank the
  covariance: exit error 60–73 m with in-tunnel coverage 0.01–0.20.

## Decision

The detector (0.5 s window, threshold 0.23 m/s², A-56) is kept. The update changes:

- **σ = 0.5 m/s.** The detector only knows "speed below about 1 m/s", not "speed is
  exactly 0"; the pseudo-measurement must not claim more than that.
- **At most once per second** while the detector holds, not at every sample: repeating
  the same information makes the filter falsely certain.
- **1 s hold** before the first ZUPT of a stationary stretch: brief dips below 1 m/s when
  the car starts or stops do not trigger it.

## Alternatives considered

- **1 s hold only (σ = 0.05 m/s, every sample):** exit error 54–67 m, coverage still
  0.04–0.47.
- **Gating the ZUPT (χ²₁ 6.63):** results split in two, 4–84 m.
- **No ZUPT:** 9–91 m; the stop then costs whatever the speed error is.
- **σ = 0.2 m/s alone:** 65–78 m, coverage 0.11–0.31.

## Consequences

- Stop-and-go, A2, seeds 1–3: exit error 63–87 m (before: 61–68 m), coverage 0.41–0.49
  (before: 0.01–0.17). The error is slightly larger but the filter no longer claims an
  accuracy it does not have.
- A stop now corrects the speed slowly, over several seconds, instead of at once.
- The crawl below 1 m/s remains a failure by design (ADR-0014), and ZUPT stays optimistic
  because its threshold comes from the simulator's own vibration law.
