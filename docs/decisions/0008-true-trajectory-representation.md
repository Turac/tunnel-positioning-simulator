# 0008. True trajectory from a piecewise-linear speed profile and the map

- Status: accepted
- Date: 2026-10-25
- Phase: 1

## Context

Every sensor in the simulator reads the car's true state, and every metric in Phase 2
compares an estimate against it. If the ground truth itself carried numerical error, part
of the measured estimation error would belong to the simulator, not to the estimator.

The truth also has to be easy to write as a scenario (cruise, braking, stop-and-go, hard
braking), and it must work with the map (ADR-0007): the map is defined on the road
`[−L_pre, L + L_post]` and rejects positions outside it.

Two GNSS rules in Phase 1 depend on when the car enters and leaves the tunnel, and the
tunnel is a closed interval `[0, L]`. If the car stands still exactly at a portal, "the
moment it arrives" and "the moment it leaves" are different times.

## Decision

### Speed profile (`src/core/world/speed-profile.ts`, A-19)

- Time–speed keypoints, the first at `t = 0`, `t` strictly increasing. Speed is linear
  between keypoints, so acceleration is constant on each segment and distance has a closed
  form, `d = d0 + v0·τ + ½·a·τ²`. No numerical integration enters the truth.
- Acceleration is right-continuous: at a keypoint it is the slope of the segment that starts
  there. At the final keypoint, where no segment starts, it is the last segment's slope.
- `0 ≤ v ≤ 50 m/s`. The upper limit catches km/h typed as m/s; there is no acceleration
  limit, so hard-braking scenarios remain possible.
- Queries outside `[0, t_end]` throw, the same rule as the map.

### Time at a distance (inverse)

On the segment where distance `d` is first reached, `τ` is solved from
`Δd = v0·τ + ½·a·τ²` in the form

```
τ = 2·Δd / (v0 + √(v0² + 2·a·Δd))
```

It is accurate for small `a` and works for `a = 0`, unlike `(−v0 + √(…))/a`, which loses
precision as `a → 0` and is `0/0` at `a = 0`. Rounding is handled explicitly:

- The radicand is the squared speed at `d`, analytically `≥ 0`. When the car brakes to a
  stop exactly at `d` it can come out as a tiny negative number (e.g. `−1.4·10⁻¹⁷` for
  0.3 m/s → 0 in 7 s), so it is clamped to 0 instead of producing `NaN`.
- `τ` is clamped to the segment end.
- Stops (`v0 = 0`, `a = 0`) are skipped by construction: the distance does not grow on them,
  so `d` is always reached on a moving segment.

`firstTimeAtDistance` returns the arrival time. `lastTimeAtDistance` returns the time the
car leaves `d`; the two differ only when the car stands still at `d`.

### Trajectory (`src/core/world/trajectory.ts`)

- `s(t) = −L_pre + d(t)`: the car starts at the road start, so `s(0) = −L_pre` by
  construction (pinned by a test).
- `truthAt(t)` returns `{ t, s, v, a, θ }`, with `θ = pitchAt(map, s)`.
- **The run ends the first time the car reaches the road end** (`runEnd`). The rest of the
  speed profile is ignored, so a scenario only needs a profile that is long enough. A
  profile that does not reach the road end is rejected. `truthAt` outside `[0, runEnd]`
  throws.
- Rounding can put `s(runEnd)` a hair past the road end (e.g. `1101.0000000000002` for a
  road ending at 1101 m); `s` is clamped onto the road.
- **Entry time:** first arrival at `s = 0`. **Exit time:** the moment the car leaves the
  exit portal, the last time with `s ≤ L`. A car waiting at the exit portal is still in the
  tunnel, so GNSS reacquisition must not start before it moves on.

## Alternatives considered

- **Smooth (cosine) speed transitions:** continuous acceleration, closer to real driving,
  but a more complex closed form; acceleration steps at keypoints are not a hard case for
  the estimators.
- **An acceleration profile integrated numerically:** puts integration error into the truth.
- **Zero acceleration at the final keypoint:** an invented value outside the profile.
- **Requiring the profile to end exactly at the road end:** hard to write by hand, especially
  with stops. **Rejecting longer profiles:** same problem.
- **Exit time as first arrival at `s = L`:** for a car waiting at the portal, reacquisition
  would start while the car is still inside the tunnel.

## Consequences

- Metrics measure estimator error only; the truth is exact up to floating-point rounding.
- Scenario authors write time keypoints. A helper that compiles distance-based segments into
  time keypoints (ADR-0007) would make live-demo scenarios easier; not implemented now.
- At `t_exit` the car is at `s = L`, which counts as inside the tunnel. The GNSS publication
  rule must therefore combine the time condition (delay elapsed since `t_exit`) with the
  position condition (outside the tunnel); otherwise a zero delay would contradict the
  position rule. Decided with the GNSS model.
- Acceleration has steps at keypoints (infinite jerk). Real cars have finite jerk; this is a
  known simplification of the truth, not of the sensors.
