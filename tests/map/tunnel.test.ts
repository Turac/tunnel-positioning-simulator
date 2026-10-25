import { describe, expect, it } from 'vitest'
import {
  createTunnelMap,
  gradeAt,
  isInTunnel,
  pitchAt,
  roadEnd,
  roadStart,
  segmentAt,
  type GradePoint,
  type TunnelMap,
} from '../../src/core/map/tunnel'

// Road: approach [-200, 0), tunnel [0, 1000], departure (1000, 1100].
// Grade: flat approach, rises to +4 % at s = 500, falls to -2 % at s = 1000, then constant.
// Expected values below are computed by hand from these keypoints.
const SPEC: TunnelMap = {
  approachLength: 200,
  tunnelLength: 1000,
  departureLength: 100,
  exitS: 600,
  grade: [
    { s: -200, grade: 0 },
    { s: 0, grade: 0 },
    { s: 500, grade: 0.04 },
    { s: 1000, grade: -0.02 },
    { s: 1100, grade: -0.02 },
  ],
}

const map = createTunnelMap(SPEC)

function withGrade(grade: GradePoint[]): TunnelMap {
  return { ...SPEC, grade }
}

describe('road extent and segments', () => {
  it('spans [-approachLength, tunnelLength + departureLength]', () => {
    expect(roadStart(map)).toBe(-200)
    expect(roadEnd(map)).toBe(1100)
  })

  it.each([
    [-200, 'approach'], // exact road start
    [-0.001, 'approach'],
    [0, 'tunnel'], // entrance portal counts as inside
    [600, 'tunnel'],
    [1000, 'tunnel'], // exit portal counts as inside
    [1000.001, 'departure'],
    [1100, 'departure'], // exact road end
  ] as const)('s = %d m is in the %s segment', (s, segment) => {
    expect(segmentAt(map, s)).toBe(segment)
    expect(isInTunnel(map, s)).toBe(segment === 'tunnel')
  })

  it.each([-200.001, 1100.001, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects s = %d m outside the road',
    (s) => {
      expect(() => segmentAt(map, s)).toThrow(RangeError)
      expect(() => isInTunnel(map, s)).toThrow(RangeError)
      expect(() => gradeAt(map, s)).toThrow(RangeError)
    },
  )
})

describe('grade profile', () => {
  it.each([
    [-200, 0], // exact road start
    [-100, 0],
    [0, 0],
    [250, 0.02], // halfway from 0 to 4 %
    [500, 0.04], // keypoint
    [750, 0.01], // halfway from +4 % to -2 %
    [1000, -0.02],
    [1100, -0.02], // exact road end
  ])('grade at s = %d m is %d', (s, grade) => {
    expect(gradeAt(map, s)).toBeCloseTo(grade, 12)
  })

  it('is continuous across a keypoint', () => {
    expect(gradeAt(map, 500 - 1e-9)).toBeCloseTo(0.04, 9)
    expect(gradeAt(map, 500 + 1e-9)).toBeCloseTo(0.04, 9)
  })

  it('pitch is atan(grade)', () => {
    expect(pitchAt(map, 500)).toBe(Math.atan(0.04))
    expect(pitchAt(map, 250)).toBeCloseTo(Math.atan(0.02), 12)
  })
})

describe('grade sign convention: positive = uphill in the direction of increasing s', () => {
  it('a rising road has positive grade and pitch', () => {
    // From s = 0 to s = 500 the road climbs: elevation gain = mean grade 2 % · 500 m = 10 m.
    expect(gradeAt(map, 250)).toBeGreaterThan(0)
    expect(pitchAt(map, 500)).toBeGreaterThan(0)
    expect(pitchAt(map, 500)).toBeCloseTo(0.0399787, 6) // atan(0.04) ≈ 2.291°
  })

  it('a falling road has negative grade and pitch', () => {
    expect(gradeAt(map, 1050)).toBeLessThan(0)
    expect(pitchAt(map, 1050)).toBeCloseTo(-0.0199973, 6) // atan(-0.02) ≈ -1.146°
  })
})

describe('validation', () => {
  it.each([
    ['approachLength', 0],
    ['approachLength', -1],
    ['tunnelLength', 0],
    ['tunnelLength', Number.NaN],
    ['departureLength', -5],
    ['departureLength', Number.POSITIVE_INFINITY],
  ] as const)('rejects %s = %d', (field, value) => {
    expect(() => createTunnelMap({ ...SPEC, [field]: value })).toThrow(/length > 0/)
  })

  it.each([0, 1000, -1, 1001, Number.NaN])('rejects exit position %d outside (0, L)', (exitS) => {
    expect(() => createTunnelMap({ ...SPEC, exitS })).toThrow(/Exit position/)
  })

  it('accepts an exit just inside the tunnel', () => {
    expect(createTunnelMap({ ...SPEC, exitS: 0.001 }).exitS).toBe(0.001)
    expect(createTunnelMap({ ...SPEC, exitS: 999.999 }).exitS).toBe(999.999)
  })

  it.each([1, -1, 4, Number.NaN, Number.POSITIVE_INFINITY])('rejects grade %d', (bad) => {
    const grade = [{ s: -200, grade: 0 }, { s: 1100, grade: bad }]
    expect(() => createTunnelMap(withGrade(grade))).toThrow(/\|grade\| < 1/)
  })

  it('accepts grades steeper than 5 % (real tunnels exceed the directive limit)', () => {
    const grade = [{ s: -200, grade: 0.12 }, { s: 1100, grade: -0.99 }]
    expect(gradeAt(createTunnelMap(withGrade(grade)), -200)).toBe(0.12)
  })

  it('rejects fewer than two keypoints', () => {
    expect(() => createTunnelMap(withGrade([]))).toThrow(/at least 2/)
    expect(() => createTunnelMap(withGrade([{ s: -200, grade: 0 }]))).toThrow(/at least 2/)
  })

  it.each([
    [[{ s: -200, grade: 0 }, { s: -200, grade: 0 }, { s: 1100, grade: 0 }], 'repeated s'],
    [[{ s: -200, grade: 0 }, { s: 500, grade: 0 }, { s: 400, grade: 0 }, { s: 1100, grade: 0 }], 'decreasing s'],
  ])('rejects keypoints with %j (%s)', (grade) => {
    expect(() => createTunnelMap(withGrade(grade))).toThrow(/strictly increasing/)
  })

  it.each([
    [[{ s: -199.999, grade: 0 }, { s: 1100, grade: 0 }], 'starts after the road start'],
    [[{ s: -200, grade: 0 }, { s: 1099.999, grade: 0 }], 'ends before the road end'],
  ])('rejects a profile that %s', (grade) => {
    expect(() => createTunnelMap(withGrade(grade))).toThrow(/cover the whole road/)
  })

  it('accepts a profile that extends beyond the road', () => {
    const grade = [{ s: -500, grade: 0 }, { s: 2000, grade: 0 }]
    expect(gradeAt(createTunnelMap(withGrade(grade)), 1100)).toBe(0)
  })
})

describe('createTunnelMap returns an independent frozen copy', () => {
  it('is not affected by later changes to the spec', () => {
    const grade = [{ s: -200, grade: 0 }, { s: 1100, grade: 0.03 }]
    const copy = createTunnelMap(withGrade(grade))
    grade[1] = { s: 1100, grade: 0.5 }
    expect(gradeAt(copy, 1100)).toBe(0.03)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(map)).toBe(true)
    expect(Object.isFrozen(map.grade)).toBe(true)
    expect(Object.isFrozen(map.grade[0])).toBe(true)
  })
})
