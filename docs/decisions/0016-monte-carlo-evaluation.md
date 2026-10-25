# 0016. Monte Carlo evaluation and seed sets

- Status: accepted
- Date: 2026-10-25
- Phase: 2

## Context

A single run says little: GNSS errors, bias and reacquisition delay all change with the
seed. The estimators are compared over many seeds, and the Kalman filter has two tuned
values (A-53, A-54) that must not be judged on the seeds they were tuned on (CLAUDE.md hard
rule 4).

## Decision

- **Runner in the core** (`eval/monte-carlo.ts`, pure): for each scenario and seed, one
  `simulateRun`; every estimator is evaluated on that same run, so methods differ only by
  the estimator, not by the noise.
- **Seed sets** (A-43): tuning seeds 1, 2, …; report seeds 1 000 001, 1 000 002, …; at most
  1 000 000 runs per set, so the ranges never overlap. The tuning set leaves out
  poor-sensor, which tests errors the filter does not model (A-53).
- **Runs** (A-42): 200 per scenario for the report set, 50 for the tuning set.
- **Report:** one markdown table per scenario, one row per method, each metric as
  "median / P95" with linear interpolation. Missed announcements and runs that never recover
  are counted in their own columns. Written to `out/eval-<set>.md`, which is not committed.
- **Script** (`scripts/eval.ts`): a thin Node wrapper with `--set`, `--runs` and, for
  tuning, `--q-extra` and `--r-scale`. Node cannot run the TypeScript sources directly (the
  imports have no file extensions), so `npm run eval` first bundles the script with Vite's
  SSR build. No new dependency.

## Alternatives considered

- **Mean and standard deviation:** a few failed runs dominate both; median and P95 show the
  typical case and the tail separately.
- **Random seeds per invocation:** results would change between runs of the script.
- **`tsx` to run TypeScript directly:** simpler command, but a new dependency.

## Consequences

- P95 of coverage describes the best runs, not the worst; low coverage shows in the median.
- A curated copy of the report set table can go into `docs/results/` for the report.
