import type { ReactNode } from 'react'
import { linearScale, ticks, type Scale } from './lib/scale'

export const CHART_W = 1000
const LEFT = 52
const RIGHT = 12
const TOP = 8
const BOTTOM = 20
/** Buckets for decimation: about one per horizontal pixel of the plot area. */
export const CHART_BUCKETS = CHART_W - LEFT - RIGHT

interface Props {
  /** Unique within the page; used for the clip path. */
  id: string
  title: string
  legend?: ReactNode
  height: number
  tEnd: number
  yDomain: readonly [number, number]
  yLabel: string
  /** GNSS outage [from, to], shaded. */
  outage: readonly [number, number]
  /** Time the car leaves the tunnel, s; marked with a labelled line. */
  exitTime: number
  cursor: number
  /** Plot content drawn with chartScales(); memoise it so the cursor does not redraw it. */
  children: ReactNode
}

/** Scales of a chart; plot content uses the same ones as the frame. */
export function chartScales(tEnd: number, yDomain: readonly [number, number], height: number): { x: Scale; y: Scale } {
  return {
    x: linearScale([0, tEnd], [LEFT, CHART_W - RIGHT]),
    y: linearScale(yDomain, [height - BOTTOM, TOP]),
  }
}

/** A chart on the run's time axis with the GNSS outage shaded and the time cursor. */
export function TimeChart(p: Props) {
  const { x, y } = chartScales(p.tEnd, p.yDomain, p.height)
  return (
    <div className="chart">
      <div className="chart-head">
        <h2>{p.title}</h2>
        <div className="legend">{p.legend}</div>
      </div>
      <svg viewBox={`0 0 ${CHART_W} ${p.height}`} role="img" aria-label={p.title}>
        <defs>
          <clipPath id={`clip-${p.id}`}>
            <rect x={LEFT} y={TOP} width={CHART_W - LEFT - RIGHT} height={p.height - TOP - BOTTOM} />
          </clipPath>
        </defs>
        <rect
          x={x(p.outage[0])}
          y={TOP}
          width={Math.max(0, x(p.outage[1]) - x(p.outage[0]))}
          height={p.height - TOP - BOTTOM}
          fill="var(--outage)"
        />
        {/* Fewer ticks on short charts so the labels do not crowd. */}
        {ticks(p.yDomain, p.height < 100 ? 3 : 4).map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={CHART_W - RIGHT} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1.2 : 0.6} />
            <text x={LEFT - 4} y={y(v) + 3} textAnchor="end">
              {Number(v.toPrecision(4))}
            </text>
          </g>
        ))}
        {/* The last few percent are left for the axis label. */}
        {ticks([0, p.tEnd], 10).filter((t) => t < p.tEnd * 0.96).map((t) => (
          <text key={t} x={x(t)} y={p.height - 6} textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={4} y={TOP + 8}>
          {p.yLabel}
        </text>
        <text x={CHART_W - RIGHT} y={p.height - 6} textAnchor="end">
          t (s)
        </text>
        <line x1={x(p.exitTime)} x2={x(p.exitTime)} y1={TOP} y2={p.height - BOTTOM} stroke="var(--road)" strokeWidth={2.5} />
        <text x={x(p.exitTime) - 3} y={p.height - BOTTOM - 4} textAnchor="end" fill="var(--muted)">
          tunnel exit
        </text>
        <g clipPath={`url(#clip-${p.id})`}>{p.children}</g>
        <line x1={x(p.cursor)} x2={x(p.cursor)} y1={TOP} y2={p.height - BOTTOM} stroke="var(--text)" strokeWidth={1} />
      </svg>
    </div>
  )
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="legend-item">
      <svg width="18" height="8" aria-hidden>
        <line x1="0" x2="18" y1="4" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 2' : undefined} />
      </svg>
      {label}
    </span>
  )
}
