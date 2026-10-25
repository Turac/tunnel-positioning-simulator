import { describe, expect, it } from 'vitest'
import { runEstimator } from '../../src/core/estimators/estimator'
import { ESTIMATORS } from '../../src/core/estimators/list'
import { DEFAULT_ACCELEROMETER } from '../../src/core/sensors/accelerometer'
import { DEFAULT_GNSS } from '../../src/core/sensors/gnss'
import { simulateRun } from '../../src/core/sim/run'

// Approach 500 m, tunnel 500 m, departure 500 m at 20 m/s: 75 s.
const run = simulateRun(
  {
    map: {
      approachLength: 500,
      tunnelLength: 500,
      departureLength: 500,
      exitS: 300,
      grade: [{ s: -500, grade: 0 }, { s: 1000, grade: 0.03 }],
    },
    speedProfile: [{ t: 0, v: 20 }, { t: 100, v: 20 }],
    accelerometer: DEFAULT_ACCELEROMETER,
    gnss: DEFAULT_GNSS,
  },
  7,
)

describe.each(ESTIMATORS)('$id is online', (entry) => {
  it('gives the same estimates up to t* when the measurements after t* are removed', () => {
    const tStar = 40
    const full = runEstimator(entry, run.map, run.measurements)
    const cut = runEstimator(
      entry,
      run.map,
      run.measurements.filter((m) => m.t <= tStar),
    )
    expect(cut.length).toBeLessThan(full.length)
    expect(full.slice(0, cut.length)).toEqual(cut)
  })
})
