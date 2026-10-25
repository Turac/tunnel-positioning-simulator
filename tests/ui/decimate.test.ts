import { describe, expect, it } from 'vitest'
import { decimate } from '../../src/ui/lib/decimate'

// 25 000 samples of a small oscillation with one single-sample spike up and one down.
const n = 25_000
const series = Array.from({ length: n }, (_, k) => Math.sin(k / 7) + (k === 12_345 ? 40 : 0) - (k === 20_001 ? 30 : 0))

describe('decimate', () => {
  const idx = decimate(series, 1000)

  it('keeps every peak, the first and the last sample', () => {
    expect(idx).toContain(12_345)
    expect(idx).toContain(20_001)
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(n - 1)
    expect(Math.max(...idx.map((k) => series[k]!))).toBe(Math.max(...series))
    expect(Math.min(...idx.map((k) => series[k]!))).toBe(Math.min(...series))
  })

  it('returns at most four increasing indices per bucket', () => {
    expect(idx.length).toBeLessThanOrEqual(4000)
    expect(idx.every((k, i) => i === 0 || k > idx[i - 1]!)).toBe(true)
  })

  it('keeps only the upper or lower extreme for band edges', () => {
    expect(decimate(series, 1000, 'max')).toContain(12_345)
    expect(decimate(series, 1000, 'max')).not.toContain(20_001)
    expect(decimate(series, 1000, 'min')).toContain(20_001)
  })

  it('returns short series whole and skips nulls', () => {
    expect(decimate([1, null, 3], 10)).toEqual([0, 2])
    const gaps = series.map((v, k) => (k < 5000 ? null : v))
    expect(decimate(gaps, 1000)[0]).toBe(5000)
  })
})
