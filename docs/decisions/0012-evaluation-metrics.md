# 0012. Per-run evaluation metrics

- Status: accepted
- Date: 2026-10-25
- Phase: 2

## Context

The estimators are compared on what matters for a navigation app in a tunnel: how far off
the position is, whether the exit is announced at the right moment, whether the reported
uncertainty can be trusted, and how the estimate behaves when GNSS returns. Metrics are the
only place where truth meets estimates (`eval/`).

## Decision

Estimates are taken at every accelerometer sample and paired with the truth sample of the
same index (ADR-0011). "Inside the tunnel" means true `s ∈ [0, L]`.

- **Exit error:** `|ŝ − s|` at the last sample inside the tunnel.
- **Max tunnel error:** largest `|ŝ − s|` inside the tunnel.
- **Exit announcement** at lead distances `D` = 400 m and 100 m (A-40). The announcement
  fires at the first sample where `ŝ ≥ exitS − D`. Distance error = true `s` at that moment
  minus `exitS − D`; time error = announcement time minus the time the car truly reaches
  `exitS − D`. Negative = early, positive = late. If the estimate never reaches the point
  the announcement is counted as missed.
- **Coverage:** fraction of samples inside the tunnel with `|ŝ − s| ≤ 2·sigmaS`. For a
  consistent Gaussian estimate this is about 95 %.
- **GNSS return jump:** after the tunnel, the largest `|ŝ_k − ŝ_(k−1) − v̂_(k−1)·Δt|`, the part
  of a step not explained by the estimator's own speed. It uses estimates only, so it shows
  what the driver sees on screen.
- **Recovery time:** from the first GNSS fix after the exit until `|ŝ − s|` falls below
  5 m (A-41) and stays below to the end of the run; not recovered if it never does.

## Alternatives considered

- **Error at the exit branch `exitS` instead of the portal:** the announcement metrics
  already cover the exit branch; the portal error is where the GNSS outage ends.
- **First time below the recovery threshold:** a transient crossing during a jump would
  count as recovery.
- **Announcement error in distance only:** time is what the driver experiences; at low
  speed a small distance error is a long wait.

## Consequences

- An estimator that falls behind and never reaches the announcement point shows as missed,
  not as an extreme number.
- The coverage metric is the Phase 2 consistency check; full NEES analysis is extension E4.
