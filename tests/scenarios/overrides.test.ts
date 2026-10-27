import { describe, expect, it } from 'vitest'
import { applyOverrides, GRADE_RAMP_LENGTH } from '../../src/core/scenarios/overrides'
import { BASELINE, GRADED, LONG, SCENARIOS, STOP_AND_GO } from '../../src/core/scenarios/scenarios'
import { validateScenario } from '../../src/core/scenarios/validate'
import { simulateRun } from '../../src/core/sim/run'

describe('validateScenario', () => {
  it.each(SCENARIOS)('accepts the built-in scenario $id', (scenario) => {
    expect(() => validateScenario(scenario.config)).not.toThrow()
  })

  it.each([499, 5001, Number.NaN])('rejects tunnel length %s m (A-02)', (length) => {
    const map = { ...BASELINE.config.map, tunnelLength: length }
    expect(() => validateScenario({ ...BASELINE.config, map })).toThrow(/A-02/)
  })

  it('rejects |grade| above 5 % (A-18)', () => {
    const map = { ...BASELINE.config.map, grade: BASELINE.config.map.grade.map((p) => ({ ...p, grade: 0.051 })) }
    expect(() => validateScenario({ ...BASELINE.config, map })).toThrow(/A-18/)
  })

  it('applies the physical checks: exit outside the tunnel, profile too short', () => {
    const exitOut = { ...BASELINE.config.map, exitS: 1000 }
    expect(() => validateScenario({ ...BASELINE.config, map: exitOut })).toThrow(/Exit position/)
    const short = [{ t: 0, v: 10 }, { t: 10, v: 10 }]
    expect(() => validateScenario({ ...BASELINE.config, speedProfile: short })).toThrow(/road end/)
  })
})

describe('applyOverrides', () => {
  it.each(SCENARIOS)('without overrides leaves $id unchanged', (scenario) => {
    expect(applyOverrides(scenario, {})).toEqual(scenario.config)
  })

  it('scales the exit with the tunnel length and keeps approach and departure', () => {
    const short = applyOverrides(BASELINE, { tunnelLength: 500 })
    expect(short.map).toMatchObject({ tunnelLength: 500, exitS: 300, approachLength: 2000, departureLength: 1000 })
    expect(applyOverrides(LONG, { tunnelLength: 1300 }).map.exitS).toBe(1040)
  })

  it('maps grade keypoints: inside scaled, past the far portal shifted, approach unchanged', () => {
    const map = applyOverrides(GRADED, { tunnelLength: 4000 }).map
    expect(map.grade.map((p) => p.s)).toEqual([-2000, 0, 200, 2000, 2200, 4000, 4100, 5000])
    expect(map.grade.map((p) => p.grade)).toEqual(GRADED.config.map.grade.map((p) => p.grade))
  })

  it('replaces the grade profile with a constant in-tunnel grade and portal ramps', () => {
    const map = applyOverrides(GRADED, { tunnelLength: 1000, grade: -0.03 }).map
    expect(map.grade).toEqual([
      { s: -2000, grade: 0 },
      { s: 0, grade: 0 },
      { s: GRADE_RAMP_LENGTH, grade: -0.03 },
      { s: 1000 - GRADE_RAMP_LENGTH, grade: -0.03 },
      { s: 1000, grade: 0 },
      { s: 2000, grade: 0 },
    ])
  })

  it('extends the speed profile at its final speed when the road gets longer', () => {
    const config = applyOverrides(BASELINE, { tunnelLength: 5000 })
    const added = config.speedProfile[config.speedProfile.length - 1]!
    expect(config.speedProfile.slice(0, -1)).toEqual(BASELINE.config.speedProfile)
    expect(added.v).toBe(BASELINE.config.speedProfile[1]!.v)
    expect(() => simulateRun(config, 1)).not.toThrow()
  })

  it('keeps time-based events of stop-and-go at the same times', () => {
    const config = applyOverrides(STOP_AND_GO, { tunnelLength: 500 })
    expect(config.speedProfile).toEqual(STOP_AND_GO.config.speedProfile)
  })

  it('sets a fixed turn-on bias without touching the other accelerometer terms', () => {
    const config = applyOverrides(BASELINE, { accelBias: 0.1 })
    expect(config.accelerometer).toEqual({ ...BASELINE.config.accelerometer, turnOnBiasFixed: 0.1 })
  })

  it.each([
    [{ tunnelLength: 400 }, /A-02/],
    [{ grade: 0.06 }, /A-18/],
    [{ accelBias: Number.NaN }, /finite/],
  ])('rejects invalid overrides %o', (overrides, message) => {
    expect(() => applyOverrides(BASELINE, overrides)).toThrow(message)
  })
})
