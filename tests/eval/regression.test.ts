// Scenario regression on fixed seeds (CLAUDE.md, Testing): every metric of every scenario
// and estimator, at full precision. A change here means a result changed; it must be called
// out, never re-recorded silently.

import { describe, expect, it } from 'vitest'
import { ESTIMATORS } from '../../src/core/estimators/list'
import { evaluateRun } from '../../src/core/eval/metrics'
import { SEED_SETS } from '../../src/core/eval/monte-carlo'
import { SCENARIOS } from '../../src/core/scenarios/scenarios'
import { simulateRun } from '../../src/core/sim/run'

// First tuning seed and first report seed (A-43).
const SEEDS = [SEED_SETS.tuning.first, SEED_SETS.report.first]

describe.each(SCENARIOS)('scenario $id', (scenario) => {
  it.each(SEEDS)('seed %i gives unchanged metrics', (seed) => {
    const run = simulateRun(scenario.config, seed)
    const metrics = Object.fromEntries(ESTIMATORS.map((e) => [e.id, evaluateRun(run, e)]))
    expect(metrics).toMatchSnapshot()
  })
})
