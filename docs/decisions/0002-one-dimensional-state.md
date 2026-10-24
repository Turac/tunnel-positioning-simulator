# 0002. Estimate position as distance along the tunnel centerline

- Status: accepted
- Date: 2026-10-24
- Phase: 0

## Context

Each tunnel has a single lane (A-01) and the road geometry is known from the navigation map
(A-10). Inside the tunnel the car cannot leave the road, except at the known exit (A-14).

## Decision

Represent position as `s`, the distance in metres along the tunnel centerline, with `s = 0` at
the entrance. The 2D map position for display is derived from `s` and the known geometry.
The core estimation question becomes "how far has the car travelled?", i.e. estimating
speed well.

## Alternatives considered

- **Full 2D (x, y, heading) estimation:** more general, but adds heading drift and lateral
  error that cannot occur on a single-lane road, making results harder to interpret.

## Consequences

- Simpler, explainable estimators and metrics (along-track error in metres).
- The exit branch is a point on the 1D line in the core scope. Deciding whether the car
  actually took the exit would need a branching model; this is a stretch goal.
- Lateral position, lane changes and map geometry errors are out of scope and listed as
  limitations.
