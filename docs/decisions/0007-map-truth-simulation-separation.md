# 0007. Separate the known map, the ground truth and the simulation run

- Status: accepted
- Date: 2026-10-25
- Phase: 1

## Context

Estimators must never see ground truth (CLAUDE.md hard rule 1). But some of what the
simulator knows is not truth about the car: it is map data that a navigation app has too.
The tunnel geometry (A-10), the grade profile (A-12) and the exit position (A-14) are known
in advance. Estimators need them for the exit announcement, for grade compensation and for
GNSS gating near the tunnel end.

The first Phase 1 plan put this map data in `world/`, which estimators may not import, and
put the function that runs a scenario (`simulateRun`) in `sensors/`, which estimators may
import for the `Measurement` types. Both were found in review:

- With map data in `world/`, estimators could not use legitimate prior knowledge without
  weakening the truth-isolation rule.
- `simulateRun` returns the true trajectory, and every sensor file imports `world/`. If
  estimators could import anything from `sensors/`, they could reach the truth indirectly.

## Decision

### Modules and what they may import

```
map/          known map data                → no world, sensors, sim, eval, scenarios
world/        ground truth (truthAt)        → map
sensors/      measurement generation        → world, map, random
  measurement.ts  Measurement types         → same restrictions as estimators; no siblings
sim/          simulateRun (returns truth)   → world, sensors, map, random
estimators/   position estimators           → map and sensors/measurement only
```

Enforced in `eslint.config.js` and proved by `tests/lint-boundaries.test.ts`, including a
check that a later `sensors/**` lint block cannot silently replace the `measurement.ts`
block (flat config uses the options of the last matching block).

### Map data (`src/core/map/tunnel.ts`)

- **Road on the 1D centerline (ADR-0002):** approach `[−L_pre, 0)` (A-16), tunnel
  `[0, L]`, departure `(L, L + L_post]` (A-17). The tunnel interval is closed: both portals
  count as inside, which is also the GNSS outage boundary.
- **One exit, `exitS: number`,** with `0 < exitS < L`. Nothing in the core or in the
  planned extensions uses more than one exit (E8 asks whether the car took this one exit),
  and CLAUDE.md asks for no abstractions the core does not use. Moving to an array later is
  a contained change.
- **Grade profile:** keypoints `{ s, grade }`, linearly interpolated (A-18). Grade is rise
  over run, a fraction (0.04 = 4 %). Pitch is `atan(grade)`.
- **Sign convention:** positive grade is uphill in the direction of increasing `s`; pitch
  has the same sign. Written in the code, in A-18 and pinned by a test. Phase 2 grade
  compensation subtracts `g · sin θ`; with the sign flipped it would add the error twice
  instead of removing it (on 4 %: 2 · 0.39 m/s² instead of 0).
- **Validation (`RangeError`), physical consistency only:** lengths finite and > 0; exit
  strictly inside the tunnel; at least two keypoints with strictly increasing `s`; the
  profile covers the whole road (no clamping, so a scenario error is not hidden);
  `|grade| < 1`, which rejects a percent typed as a fraction (4 instead of 0.04). The map
  does not reject grades above 5 %, because steeper tunnels exist. The task's length range
  (A-02) is checked by scenario validation in Phase 2.
- **Queries outside the road throw.** A speed profile that drives past the road end is a
  scenario error; how a run ends at the road end is decided with the true trajectory.
- `createTunnelMap` returns a frozen copy, so a map cannot change after validation.
- Elevation is not computed: nothing in Phase 1 uses it. If added, `dh/ds = sin θ`.

## Alternatives considered

- **Map data in `world/`** (first plan): estimators could not use known map data.
- **`simulateRun` in `sensors/`** (first plan): an indirect path from estimators to truth.
- **Restricting estimators to `sensors/` as a whole, without a measurement-only rule:** any
  sensor file imports `world/`, so this leaves the indirect path open.
- **`exits: [{ s }]` or `exit: { s }`:** ready for several exits or more exit attributes,
  but every use in the core would be `exits[0]`, an unused generalisation.
- **Piecewise-constant grade:** a step from 0 % to 4 % puts a 0.39 m/s² step into the
  accelerometer signal, which roads with vertical curves do not produce. **Splines:** smooth,
  but more complex than needed; linear interpolation is already continuous.
- **Clamping the grade beyond the keypoints:** convenient, but hides scenario errors.

## Consequences

- Estimators can use the map freely, and the lint test shows that no estimator-visible
  file leads to truth.
- The estimator and the simulator currently receive the same map. This is the place for a
  later **map error component**, off by default: the estimator would receive the true map
  plus an error (for example a grade or exit-position offset), while `world/` keeps the
  true map. Not implemented now; `sim/` will pass the map to its consumers explicitly so
  this can be added without changing existing results.
- A later **helper that compiles distance-based speed segments into time keypoints** (for
  example "40 km/h from 300 m to 600 m") would make live-demo scenarios easier to write.
  Not implemented now.
- New core directories must be placed with these rules in mind: a directory named
  `world`, `sim`, `eval`, `scenarios` or `sensors` under `estimators/` or `map/` is blocked.
