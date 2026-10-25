import { describe, expect, it } from 'vitest'
import {
  accelerationAt,
  createSpeedProfile,
  distanceAt,
  endTime,
  MAX_SPEED,
  speedAt,
  type SpeedKeypoint,
} from '../../src/core/world/speed-profile'

// Expected values are computed by hand from s = v0·t + ½·a·t².

describe('constant speed', () => {
  const p = createSpeedProfile([{ t: 0, v: 15 }, { t: 100, v: 15 }])

  it('distance is v·t', () => {
    expect(distanceAt(p, 0)).toBe(0)
    expect(distanceAt(p, 37)).toBe(555)
    expect(distanceAt(p, 100)).toBe(1500)
  })

  it('acceleration is 0', () => {
    expect(accelerationAt(p, 50)).toBe(0)
  })
})

describe('constant deceleration: 20 m/s to 10 m/s in 10 s (a = -1 m/s²)', () => {
  const p = createSpeedProfile([{ t: 0, v: 20 }, { t: 10, v: 10 }])

  it('at t = 4 s: v = 16 m/s, s = 20·4 - ½·1·4² = 72 m', () => {
    expect(speedAt(p, 4)).toBe(16)
    expect(distanceAt(p, 4)).toBe(72)
  })

  it('at the end: s = 10·(20 + 10)/2 = 150 m', () => {
    expect(distanceAt(p, 10)).toBe(150)
    expect(endTime(p)).toBe(10)
  })

  it('acceleration is -1 m/s², also at the final keypoint (left limit)', () => {
    expect(accelerationAt(p, 0)).toBe(-1)
    expect(accelerationAt(p, 10)).toBe(-1)
  })
})

describe('multi-segment profile with a stop', () => {
  // Segments: a = +1 (0→20 s), cruise 20 m/s (20→30 s), a = -2 (30→40 s),
  // stopped (40→50 s), a = +1 (50→60 s).
  // Distances: 200 m at 20 s, 400 m at 30 s, 500 m at 40 s, 500 m at 50 s, 550 m at 60 s.
  const p = createSpeedProfile([
    { t: 0, v: 0 },
    { t: 20, v: 20 },
    { t: 30, v: 20 },
    { t: 40, v: 0 },
    { t: 50, v: 0 },
    { t: 60, v: 10 },
  ])

  it.each([
    [20, 200],
    [30, 400],
    [35, 475], // 400 + 20·5 - ½·2·5²
    [40, 500],
    [45, 500], // stopped
    [50, 500],
    [60, 550],
  ])('distance at t = %d s is %d m', (t, s) => {
    expect(distanceAt(p, t)).toBe(s)
  })

  it('does not move while stopped', () => {
    expect(speedAt(p, 45)).toBe(0)
    expect(accelerationAt(p, 45)).toBe(0)
  })

  it.each([
    [0, 1],
    [19.999, 1],
    [20, 0], // right-continuous: the cruise segment starts here
    [30, -2],
    [40, 0],
    [50, 1],
    [60, 1], // final keypoint: slope of the last segment
  ])('acceleration at t = %d s is %d m/s² (right-continuous)', (t, a) => {
    expect(accelerationAt(p, t)).toBe(a)
  })

  it.each([20, 30, 40, 50])('speed and distance are continuous at the keypoint t = %d s', (t) => {
    const eps = 1e-9
    expect(speedAt(p, t - eps)).toBeCloseTo(speedAt(p, t), 6)
    expect(speedAt(p, t + eps)).toBeCloseTo(speedAt(p, t), 6)
    expect(distanceAt(p, t - eps)).toBeCloseTo(distanceAt(p, t), 6)
    expect(distanceAt(p, t + eps)).toBeCloseTo(distanceAt(p, t), 6)
  })
})

describe('segment lookup on a long profile', () => {
  // 201 keypoints alternating 10 and 20 m/s every 5 s: each segment covers 75 m.
  const keypoints: SpeedKeypoint[] = Array.from({ length: 201 }, (_, i) => ({
    t: 5 * i,
    v: i % 2 === 0 ? 10 : 20,
  }))
  const p = createSpeedProfile(keypoints)

  it('finds the right segment at every keypoint and midpoint', () => {
    for (let i = 0; i < 200; i++) {
      expect(distanceAt(p, 5 * i)).toBe(75 * i)
      expect(speedAt(p, 5 * i + 2.5)).toBe(15)
      expect(accelerationAt(p, 5 * i)).toBe(i % 2 === 0 ? 2 : -2)
    }
    expect(distanceAt(p, 1000)).toBe(15000)
  })
})

describe('queries outside the profile', () => {
  const p = createSpeedProfile([{ t: 0, v: 10 }, { t: 60, v: 10 }])

  it.each([-0.001, 60.001, Number.NaN, Number.POSITIVE_INFINITY])('reject t = %d s', (t) => {
    expect(() => speedAt(p, t)).toThrow(RangeError)
    expect(() => accelerationAt(p, t)).toThrow(RangeError)
    expect(() => distanceAt(p, t)).toThrow(RangeError)
  })
})

describe('validation', () => {
  it('rejects fewer than two keypoints', () => {
    expect(() => createSpeedProfile([])).toThrow(/at least 2/)
    expect(() => createSpeedProfile([{ t: 0, v: 10 }])).toThrow(/at least 2/)
  })

  it('rejects a profile that does not start at t = 0', () => {
    expect(() => createSpeedProfile([{ t: 1, v: 10 }, { t: 2, v: 10 }])).toThrow(/t = 0/)
  })

  it.each([
    [[{ t: 0, v: 10 }, { t: 0, v: 20 }], 'repeated t (instant speed jump)'],
    [[{ t: 0, v: 10 }, { t: 10, v: 10 }, { t: 5, v: 10 }], 'decreasing t'],
  ])('rejects %j (%s)', (keypoints) => {
    expect(() => createSpeedProfile(keypoints)).toThrow(/strictly increasing/)
  })

  it.each([-0.001, MAX_SPEED + 0.001, 80, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects speed %d m/s',
    (v) => {
      expect(() => createSpeedProfile([{ t: 0, v: 10 }, { t: 10, v }])).toThrow(/v must be/)
    },
  )

  it('rejects a non-finite time', () => {
    expect(() => createSpeedProfile([{ t: 0, v: 10 }, { t: Number.NaN, v: 10 }])).toThrow(
      /t must be finite/,
    )
  })

  it('accepts the limits 0 and MAX_SPEED = 50 m/s (180 km/h)', () => {
    expect(MAX_SPEED).toBe(50)
    const p = createSpeedProfile([{ t: 0, v: 0 }, { t: 10, v: MAX_SPEED }])
    expect(speedAt(p, 10)).toBe(50)
  })

  it('allows hard braking (no acceleration limit)', () => {
    // 30 m/s to 0 in 2 s: -15 m/s², beyond 1 g.
    const p = createSpeedProfile([{ t: 0, v: 30 }, { t: 2, v: 0 }])
    expect(accelerationAt(p, 1)).toBe(-15)
  })
})

describe('createSpeedProfile returns an independent frozen copy', () => {
  it('is not affected by later changes to the keypoints', () => {
    const keypoints = [{ t: 0, v: 10 }, { t: 10, v: 10 }]
    const p = createSpeedProfile(keypoints)
    keypoints[1] = { t: 10, v: 40 }
    expect(speedAt(p, 10)).toBe(10)
  })

  it('is frozen', () => {
    const p = createSpeedProfile([{ t: 0, v: 10 }, { t: 10, v: 10 }])
    expect(Object.isFrozen(p)).toBe(true)
    expect(Object.isFrozen(p.points)).toBe(true)
    expect(Object.isFrozen(p.points[0])).toBe(true)
    expect(Object.isFrozen(p.distances)).toBe(true)
  })
})
