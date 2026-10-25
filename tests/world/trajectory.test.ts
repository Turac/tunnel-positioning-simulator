import { describe, expect, it } from 'vitest'
import { createTunnelMap, pitchAt, type TunnelMap } from '../../src/core/map/tunnel'
import { createSpeedProfile } from '../../src/core/world/speed-profile'
import { createTrajectory, truthAt } from '../../src/core/world/trajectory'

// Road: approach [-200, 0), tunnel [0, 1000], departure (1000, 1100]; 1300 m in total.
// Grade rises linearly from 0 at s = 0 to 4 % at s = 500, then stays at 4 %.
const SPEC: TunnelMap = {
  approachLength: 200,
  tunnelLength: 1000,
  departureLength: 100,
  exitS: 600,
  grade: [
    { s: -200, grade: 0 },
    { s: 0, grade: 0 },
    { s: 500, grade: 0.04 },
    { s: 1100, grade: 0.04 },
  ],
}
const map = createTunnelMap(SPEC)

describe('constant 20 m/s over a 1300 m road', () => {
  const traj = createTrajectory(map, createSpeedProfile([{ t: 0, v: 20 }, { t: 100, v: 20 }]))

  it('starts at the road start: s(0) = -approachLength', () => {
    expect(truthAt(traj, 0).s).toBe(-200)
  })

  it('s(t) = -200 + 20·t', () => {
    expect(truthAt(traj, 30).s).toBe(400)
    expect(truthAt(traj, 30).v).toBe(20)
    expect(truthAt(traj, 30).a).toBe(0)
    expect(truthAt(traj, 30).t).toBe(30)
  })

  it('theta is the map pitch at s: atan(0.032) at s = 400 m', () => {
    expect(truthAt(traj, 30).theta).toBe(pitchAt(map, 400))
    expect(truthAt(traj, 30).theta).toBeCloseTo(Math.atan(0.032), 12)
  })

  it('enters at 200 / 20 = 10 s, leaves the tunnel at 1200 / 20 = 60 s', () => {
    expect(traj.entryTime).toBe(10)
    expect(traj.exitTime).toBe(60)
  })

  it('the run ends when the car first reaches the road end: 1300 / 20 = 65 s', () => {
    expect(traj.runEnd).toBe(65)
    expect(truthAt(traj, 65).s).toBe(1100)
  })

  it.each([-0.001, 65.001, 100, Number.NaN])('rejects t = %d s outside the run', (t) => {
    expect(() => truthAt(traj, t)).toThrow(RangeError)
  })
})

describe('profile length', () => {
  it('ignores the part of the profile after the road end', () => {
    const short = createTrajectory(map, createSpeedProfile([{ t: 0, v: 20 }, { t: 65, v: 20 }]))
    const long = createTrajectory(map, createSpeedProfile([{ t: 0, v: 20 }, { t: 500, v: 20 }]))
    expect(short.runEnd).toBe(65)
    expect(long.runEnd).toBe(65)
  })

  it('ends on arrival when the car stops exactly at the road end, not when it moves on', () => {
    // 20 m/s for 55 s (1100 m), brake to 0 over 20 s (200 m): at the road end at 75 s, then
    // stopped until 90 s.
    const profile = createSpeedProfile([
      { t: 0, v: 20 },
      { t: 55, v: 20 },
      { t: 75, v: 0 },
      { t: 90, v: 0 },
    ])
    expect(createTrajectory(map, profile).runEnd).toBe(75)
  })

  it('rejects a profile that does not reach the road end (64.9 s · 20 m/s = 1298 m)', () => {
    const profile = createSpeedProfile([{ t: 0, v: 20 }, { t: 64.9, v: 20 }])
    expect(() => createTrajectory(map, profile)).toThrow(/road is 1300 m long/)
  })
})

describe('stop exactly at the exit portal', () => {
  // 20 m/s for 50 s (1000 m), brake to 0 over 20 s (200 m): stopped at s = 1000 from 70 s to
  // 80 s, then accelerate at 1 m/s². Remaining 100 m: ½·τ² = 100, τ = √200.
  const traj = createTrajectory(
    map,
    createSpeedProfile([
      { t: 0, v: 20 },
      { t: 50, v: 20 },
      { t: 70, v: 0 },
      { t: 80, v: 0 },
      { t: 100, v: 20 },
    ]),
  )

  it('exitTime is when the car leaves the portal (end of the stop), not when it arrives', () => {
    expect(truthAt(traj, 70).s).toBe(1000)
    expect(traj.exitTime).toBe(80)
  })

  it('the car stands at the portal during the stop', () => {
    expect(truthAt(traj, 75)).toMatchObject({ s: 1000, v: 0, a: 0 })
  })

  it('the run ends √200 s after the stop', () => {
    expect(traj.runEnd).toBeCloseTo(80 + Math.sqrt(200), 12)
  })
})

describe('rounding at the road end', () => {
  it('clamps s onto the road at t = runEnd', () => {
    // approachLength 0.1 · 3 = 0.30000000000000004 at 16.5 m/s: without the clamp, s at
    // runEnd is 1101.0000000000002, past the road end, and pitchAt would throw.
    const odd = createTunnelMap({
      approachLength: 0.1 * 3,
      tunnelLength: 1000.7,
      departureLength: 100.3,
      exitS: 500,
      grade: [{ s: -1, grade: 0 }, { s: 1200, grade: 0 }],
    })
    const traj = createTrajectory(odd, createSpeedProfile([{ t: 0, v: 16.5 }, { t: 100, v: 16.5 }]))
    const unclamped = -odd.approachLength + 16.5 * traj.runEnd
    expect(unclamped).toBeGreaterThan(1101) // the edge case really occurs
    expect(truthAt(traj, traj.runEnd).s).toBe(1101)
  })
})

describe('createTrajectory returns a frozen value', () => {
  it('is frozen', () => {
    const traj = createTrajectory(map, createSpeedProfile([{ t: 0, v: 20 }, { t: 100, v: 20 }]))
    expect(Object.isFrozen(traj)).toBe(true)
  })
})
