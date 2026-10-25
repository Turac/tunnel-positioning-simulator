# 0018. Coverage as mean and P10 in the report

- Status: accepted; changes the coverage column of the report in ADR-0016
- Date: 2026-10-25
- Phase: 2

## Context

ADR-0016 reports every metric as median / P95 over the runs. For the in-tunnel ±2σ
coverage this hides the information that matters. Coverage is a fraction bounded by 1; on
the report set the A2 cell read 1.00 / 1.00 in four of five scenarios, although the mean
coverage the filter was tuned for (ADR-0017) is lower and some runs are badly
over-confident. The P95 describes the best runs, but for coverage the worst runs matter.

## Decision

The coverage column shows **mean / P10** over the runs; all other columns stay median /
P95.

- **Mean**, because it is the tuning target (ADR-0017) and, with runs of similar length, it
  is close to the fraction of all in-tunnel samples covered.
- **P10**, the coverage that 90 % of the runs exceed, to show over-confident runs.

## Alternatives considered

- **Keep median / P95:** shows 1.00 / 1.00 for an estimator that is over-confident in one
  run of ten.
- **Mean only:** a mean of 0.9 can be every run at 0.9 or most runs at 1.0 and a few near 0.
- **Pooled fraction over all samples:** about the same as the mean here, but needs sample
  counts the per-run metrics do not keep.

## Consequences

Report set, A2 (mean / P10), previously all shown as 1.00 / 1.00 except stop-and-go:

| Scenario | Coverage |
|---|---|
| baseline | 0.95 / 0.87 |
| long | 0.98 / 0.97 |
| stop-and-go | 0.51 / 0.49 |
| graded | 0.98 / 0.94 |
| poor-sensor | 0.81 / 0.13 |

The report seeds confirm the tuning (baseline 0.95), and the new column shows that A2 is
over-confident in part of the poor-sensor runs, which the old column hid.
