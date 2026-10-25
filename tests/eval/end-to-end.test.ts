import { describe, expect, it } from 'vitest'
import { ESTIMATORS } from '../../src/core/estimators/list'
import { evaluateRun } from '../../src/core/eval/metrics'
import { SCENARIOS } from '../../src/core/scenarios/scenarios'
import { simulateRun } from '../../src/core/sim/run'

describe.each(SCENARIOS)('scenario $id', (scenario) => {
  const run = simulateRun(scenario.config, 1)

  it.each(ESTIMATORS)('evaluates $id end to end', (entry) => {
    const m = evaluateRun(run, entry)
    expect(Number.isFinite(m.exitError)).toBe(true)
    expect(m.maxTunnelError).toBeGreaterThanOrEqual(m.exitError)
    expect(m.coverage).toBeGreaterThanOrEqual(0)
    expect(m.coverage).toBeLessThanOrEqual(1)
    expect(m.announcements.map((a) => a.lead)).toEqual([400, 100])
  })
})
