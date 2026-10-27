import { describe, expect, it } from 'vitest'
import { ESTIMATORS } from '../../src/core/estimators/list'
import { evaluateRun } from '../../src/core/eval/metrics'
import { runSingle } from '../../src/core/eval/single-run'
import { STOP_AND_GO } from '../../src/core/scenarios/scenarios'
import { simulateRun } from '../../src/core/sim/run'

describe('runSingle', () => {
  const seed = 1_000_001
  const result = runSingle(STOP_AND_GO.config, seed, ESTIMATORS)
  const run = simulateRun(STOP_AND_GO.config, seed)

  it('gives the same metrics as the Monte Carlo evaluation', () => {
    expect(result.tracks.map((t) => t.id)).toEqual(ESTIMATORS.map((e) => e.id))
    result.tracks.forEach((track, i) => expect(track.metrics).toEqual(evaluateRun(run, ESTIMATORS[i]!)))
  })

  it('lines up estimates and errors with the truth samples', () => {
    const n = result.truth.samples.length
    expect(result.accel).toHaveLength(n)
    for (const track of result.tracks) {
      expect(track.estimates).toHaveLength(n)
      const k = n - 1
      expect(track.errors[k]).toBe(track.estimates[k]!.s - result.truth.samples[k]!.s)
    }
  })

  it('places announcement events where the metrics measured them', () => {
    for (const track of result.tracks) {
      track.announcements.forEach((event, i) => {
        const metric = track.metrics.announcements[i]!
        expect(event.lead).toBe(metric.lead)
        expect(result.truth.samples[event.kEst!]!.s - event.target).toBe(metric.distanceError)
      })
    }
  })

  it('pairs each GNSS fix with the truth at its time and finds the reacquisition', () => {
    const fixes = run.measurements.filter((m) => m.kind === 'gnss')
    expect(result.gnss).toHaveLength(fixes.length)
    const fix = result.gnss[0]!
    const truth = result.truth.samples[Math.round(fix.t * result.truth.rateHz)]!
    expect(fix.positionError).toBe(fix.s - truth.s)
    expect(result.reacquisitionTime).toBe(fixes.find((m) => m.t > run.truth.exitTime)!.t)
  })
})
