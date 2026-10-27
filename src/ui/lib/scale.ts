// Linear scales and axis ticks for hand-written SVG.

export interface Scale {
  (x: number): number
  readonly domain: readonly [number, number]
  readonly range: readonly [number, number]
}

export function linearScale(domain: readonly [number, number], range: readonly [number, number]): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return Object.assign((x: number) => r0 + (x - d0) * k, { domain, range })
}

/** About `count` round tick values (1, 2 or 5 × 10^n steps) covering the domain. */
export function ticks(domain: readonly [number, number], count = 6): number[] {
  const [lo, hi] = domain
  const span = hi - lo
  if (!(span > 0)) return [lo]
  const raw = span / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  // Nearest round step on a log scale, not the next larger one: rounding up could give a
  // step close to the whole span and leave a single tick.
  const r = raw / pow
  const step = (r >= Math.sqrt(50) ? 10 : r >= Math.sqrt(10) ? 5 : r >= Math.sqrt(2) ? 2 : 1) * pow
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  return out
}

/** SVG path through the given indices; `y` may return null to break the line. */
export function linePath(indices: readonly number[], x: (k: number) => number, y: (k: number) => number | null): string {
  let d = ''
  let pen = false
  for (const k of indices) {
    const yk = y(k)
    if (yk === null || !Number.isFinite(yk)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${x(k).toFixed(1)},${yk.toFixed(1)}`
    pen = true
  }
  return d
}
