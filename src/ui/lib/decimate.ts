// Decimation for SVG drawing (ADR-0019). Samples are evenly spaced in time, so index buckets
// are time buckets. Every bucket keeps its extreme sample(s), so no peak is dropped.

export type Keep = 'minmax' | 'max' | 'min'

/**
 * Indices to draw, in increasing order. The series is split into `buckets` index ranges; each
 * keeps its first and last sample and its min and/or max. Null samples are skipped. Series of
 * at most 2·buckets samples are returned whole.
 */
export function decimate(values: ArrayLike<number | null>, buckets: number, keep: Keep = 'minmax'): number[] {
  const n = values.length
  if (!(Number.isInteger(buckets) && buckets >= 1)) {
    throw new RangeError(`Buckets must be an integer >= 1, got ${buckets}`)
  }
  if (n <= 2 * buckets) {
    const all: number[] = []
    for (let k = 0; k < n; k++) if (values[k] !== null) all.push(k)
    return all
  }
  const out: number[] = []
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor((b * n) / buckets)
    const end = Math.floor(((b + 1) * n) / buckets)
    let first = -1
    let last = -1
    let kMin = -1
    let kMax = -1
    for (let k = start; k < end; k++) {
      const v = values[k]
      if (v === null || v === undefined) continue
      if (first < 0) first = k
      last = k
      if (kMin < 0 || v < values[kMin]!) kMin = k
      if (kMax < 0 || v > values[kMax]!) kMax = k
    }
    if (first < 0) continue
    const picked = [first, last]
    if (keep !== 'max') picked.push(kMin)
    if (keep !== 'min') picked.push(kMax)
    for (const k of [...new Set(picked)].sort((a, c) => a - c)) out.push(k)
  }
  return out
}
