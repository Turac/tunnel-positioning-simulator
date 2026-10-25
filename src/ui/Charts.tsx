import { useMemo } from 'react'
import type { SingleRunResult } from '../core/eval/single-run'
import { decimate } from './lib/decimate'
import { linePath } from './lib/scale'
import { CHART_BUCKETS, chartScales, LegendItem, TimeChart } from './TimeChart'
import { estimatorColor, GNSS_COLOR, TRUTH_COLOR } from './theme'

interface ChartProps {
  result: SingleRunResult
  cursor: number
  /** GNSS outage [from, to], s. */
  outage: readonly [number, number]
}

/** [min, max] over the given indices of one or more series, padded by 5 %. */
function extent(series: readonly { values: ArrayLike<number | null>; idx: readonly number[] }[], include: number[] = []): [number, number] {
  let lo = Math.min(...include, Infinity)
  let hi = Math.max(...include, -Infinity)
  for (const { values, idx } of series) {
    for (const k of idx) {
      const v = values[k]
      if (v === null || v === undefined) continue
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (!(hi > lo)) return [lo - 1, lo + 1]
  const pad = (hi - lo) * 0.05
  return [lo - pad, hi + pad]
}

/** Trailing mean over `window` samples. */
function movingMean(values: readonly number[], window: number): number[] {
  const out: number[] = new Array(values.length)
  let sum = 0
  for (let k = 0; k < values.length; k++) {
    sum += values[k]!
    if (k >= window) sum -= values[k - window]!
    out[k] = sum / Math.min(k + 1, window)
  }
  return out
}

export function AccelChart({ result, cursor, outage }: ChartProps) {
  const H = 110
  const { truth } = result
  const plot = useMemo(() => {
    const f = result.accel.map((m) => m.f)
    const mean = movingMean(f, Math.round(truth.rateHz)) // 1 s
    const a = truth.samples.map((s) => s.a)
    const fIdx = decimate(f, CHART_BUCKETS)
    const meanIdx = decimate(mean, CHART_BUCKETS)
    const aIdx = decimate(a, CHART_BUCKETS)
    const domain = extent([{ values: f, idx: fIdx }, { values: a, idx: aIdx }])
    const { x, y } = chartScales(truth.runEnd, domain, H)
    const tx = (k: number) => x(k / truth.rateHz)
    return {
      domain,
      node: (
        <>
          <path d={linePath(fIdx, tx, (k) => y(f[k]!))} stroke="#c4c4c4" strokeWidth={0.6} fill="none" />
          <path d={linePath(meanIdx, tx, (k) => y(mean[k]!))} stroke="#555" strokeWidth={1.4} fill="none" />
          <path d={linePath(aIdx, tx, (k) => y(a[k]!))} stroke={TRUTH_COLOR} strokeWidth={1.2} strokeDasharray="5 3" fill="none" />
        </>
      ),
    }
  }, [result, truth])
  return (
    <TimeChart
      id="accel"
      title="Accelerometer specific force"
      legend={
        <>
          <LegendItem color="#c4c4c4" label="measured f" />
          <LegendItem color="#555" label="f, 1 s mean" />
          <LegendItem color={TRUTH_COLOR} label="true acceleration" dashed />
        </>
      }
      height={H}
      tEnd={truth.runEnd}
      yDomain={plot.domain}
      yLabel="m/s²"
      outage={outage}
      cursor={cursor}
    >
      {plot.node}
    </TimeChart>
  )
}

export function GnssCharts({ result, cursor, outage }: ChartProps) {
  const H = 90
  const { truth, gnss } = result
  const speed = useMemo(() => {
    const v = truth.samples.map((s) => s.v * 3.6)
    const vIdx = decimate(v, CHART_BUCKETS)
    const domain = extent([{ values: v, idx: vIdx }], [0, ...gnss.map((f) => f.speed * 3.6)])
    const { x, y } = chartScales(truth.runEnd, domain, H)
    return {
      domain,
      node: (
        <>
          <path d={linePath(vIdx, (k) => x(k / truth.rateHz), (k) => y(v[k]!))} stroke={TRUTH_COLOR} strokeWidth={1.2} fill="none" />
          {gnss.map((f) => (
            <circle key={f.t} cx={x(f.t)} cy={y(f.speed * 3.6)} r={1.8} fill={GNSS_COLOR} />
          ))}
        </>
      ),
    }
  }, [truth, gnss])
  const position = useMemo(() => {
    const reach = gnss.map((f) => Math.abs(f.positionError) + 2 * f.reportedSigma)
    const m = Math.max(5, ...reach)
    const domain: [number, number] = [-m * 1.05, m * 1.05]
    const { x, y } = chartScales(truth.runEnd, domain, H)
    return {
      domain,
      node: (
        <>
          {gnss.map((f) => (
            <g key={f.t}>
              <line
                x1={x(f.t)}
                x2={x(f.t)}
                y1={y(f.positionError - 2 * f.reportedSigma)}
                y2={y(f.positionError + 2 * f.reportedSigma)}
                stroke={GNSS_COLOR}
                strokeOpacity={0.35}
              />
              <circle cx={x(f.t)} cy={y(f.positionError)} r={1.8} fill={GNSS_COLOR} />
            </g>
          ))}
        </>
      ),
    }
  }, [truth, gnss])
  return (
    <>
      <TimeChart
        id="gnss-speed"
        title="GNSS speed"
        legend={
          <>
            <LegendItem color={GNSS_COLOR} label="fix speed" />
            <LegendItem color={TRUTH_COLOR} label="true speed" />
          </>
        }
        height={H}
        tEnd={truth.runEnd}
        yDomain={speed.domain}
        yLabel="km/h"
        outage={outage}
        cursor={cursor}
      >
        {speed.node}
      </TimeChart>
      <TimeChart
        id="gnss-position"
        title="GNSS position error (fix − true) with reported ±2σ"
        height={H}
        tEnd={truth.runEnd}
        yDomain={position.domain}
        yLabel="m"
        outage={outage}
        cursor={cursor}
      >
        {position.node}
      </TimeChart>
    </>
  )
}

export function ErrorChart({ result, cursor, outage, shown, bandId }: ChartProps & { shown: ReadonlySet<string>; bandId: string }) {
  const H = 150
  const { truth } = result
  const plot = useMemo(() => {
    const tracks = result.tracks.filter((tr) => shown.has(tr.id))
    const series = tracks.map((tr) => ({ tr, idx: decimate(tr.errors, CHART_BUCKETS) }))
    const band = result.tracks.find((tr) => tr.id === bandId && shown.has(tr.id))
    const upper = band?.estimates.map((e) => (e ? 2 * e.sigmaS : null)) ?? []
    const lower = upper.map((v) => (v === null ? null : -v))
    const upIdx = band ? decimate(upper, CHART_BUCKETS, 'max') : []
    const loIdx = band ? decimate(lower, CHART_BUCKETS, 'min') : []
    const domain = extent(
      [...series.map(({ tr, idx }) => ({ values: tr.errors, idx })), { values: upper, idx: upIdx }, { values: lower, idx: loIdx }],
      [0],
    )
    const { x, y } = chartScales(truth.runEnd, domain, H)
    const tx = (k: number) => x(k / truth.rateHz)
    const bandPath =
      upIdx.length > 0
        ? `${linePath(upIdx, tx, (k) => y(upper[k]!))}${linePath([...loIdx].reverse(), tx, (k) => y(lower[k]!)).replace(/^M/, 'L')}Z`
        : ''
    const events = result.tracks[0]?.announcements ?? []
    return {
      domain,
      node: (
        <>
          {band && <path d={bandPath} fill={estimatorColor(band.id)} opacity={0.15} />}
          {events.map((ev, i) => (
            <g key={ev.lead}>
              <line x1={tx(ev.kTrue)} x2={tx(ev.kTrue)} y1={0} y2={H} stroke="var(--text)" strokeDasharray="3 3" strokeOpacity={0.6} />
              <text x={tx(ev.kTrue) + 3} y={20 + i * 12}>
                {ev.lead} m point
              </text>
            </g>
          ))}
          {series.map(({ tr, idx }) => (
            <g key={tr.id}>
              <path d={linePath(idx, tx, (k) => (tr.errors[k] === null ? null : y(tr.errors[k]!)))} stroke={estimatorColor(tr.id)} strokeWidth={1.4} fill="none" />
              {tr.announcements.map((ev) =>
                ev.kEst === null ? null : (
                  <path
                    key={ev.lead}
                    d={`M${tx(ev.kEst)},10L${tx(ev.kEst) - 4},2L${tx(ev.kEst) + 4},2Z`}
                    fill={estimatorColor(tr.id)}
                  >
                    <title>{`${tr.id} announced "${ev.lead} m to exit"`}</title>
                  </path>
                ),
              )}
            </g>
          ))}
        </>
      ),
    }
  }, [result, truth, shown, bandId])
  return (
    <TimeChart
      id="error"
      title={`Position error ŝ − s${shown.has(bandId) ? ` with ±2σ band of ${bandId}` : ''}`}
      legend={result.tracks
        .filter((tr) => shown.has(tr.id))
        .map((tr) => (
          <LegendItem key={tr.id} color={estimatorColor(tr.id)} label={tr.id} />
        ))}
      height={H}
      tEnd={truth.runEnd}
      yDomain={plot.domain}
      yLabel="m"
      outage={outage}
      cursor={cursor}
    >
      {plot.node}
    </TimeChart>
  )
}
