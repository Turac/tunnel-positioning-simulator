// Default seed per scenario: the report-set seed whose A2 exit error is closest to the
// report median, so the demo opens on a representative run, not the best one (A-43).
// Copied from the "Representative seeds" line of `npm run eval` (200 report seeds);
// rerun it and update this table when an estimator or the simulator changes.

import { SEED_SETS } from '../core/eval/monte-carlo'

const DEFAULT_SEEDS: Readonly<Record<string, number>> = {
  baseline: 1_000_017,
  long: 1_000_042,
  'stop-and-go': 1_000_162,
  graded: 1_000_117,
  'poor-sensor': 1_000_066,
}

export function defaultSeed(scenarioId: string): number {
  return DEFAULT_SEEDS[scenarioId] ?? SEED_SETS.report.first
}
