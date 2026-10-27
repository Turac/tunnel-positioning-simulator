import type { SingleRunResult } from '../core/eval/single-run'
import { linearScale, ticks, type Scale } from './lib/scale'
import { estimatorColor, GNSS_COLOR, TRUTH_COLOR } from './theme'
import { useWidth } from './useWidth'

const PAD = 20
/** Below this drawing width the announcement labels use the short form, px. */
const COMPACT_W = 600
/** Half-width of the zoom strip around the true car, m. */
const ZOOM_HALF = 200

interface Props {
  result: SingleRunResult
  k: number
  shown: ReadonlySet<string>
  bandId: string
}

export function RoadView({ result, k, shown, bandId }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const compact = W < COMPACT_W
  const { map } = result
  const truth = result.truth.samples[k]!
  const tracks = result.tracks.filter((tr) => shown.has(tr.id))

  const roadStart = -map.approachLength
  const roadEnd = map.tunnelLength + map.departureLength
  const overview = linearScale([roadStart, roadEnd], [PAD, W - PAD])
  // Centred on the car, but kept on the road near either end.
  const centre = Math.min(Math.max(truth.s, roadStart + ZOOM_HALF), roadEnd - ZOOM_HALF)
  const zoom = linearScale([centre - ZOOM_HALF, centre + ZOOM_HALF], [PAD, W - PAD])

  const rowsBottom = 30 + tracks.length * 16
  const zoomH = rowsBottom + 32
  const recentFixes = result.gnss.filter(
    (f) => f.t <= truth.t && Math.abs(f.s - centre) <= ZOOM_HALF,
  )
  // Announcements made so far, drawn at the car's true position when each was made.
  const announced = (draw: (s: number) => number, top: number) =>
    tracks.flatMap((tr) =>
      tr.announcements.map((a) =>
        a.kEst !== null && a.kEst <= k ? (
          <path key={`${tr.id}-${a.lead}`} d={triangle(draw(result.truth.samples[a.kEst]!.s), top)} fill={estimatorColor(tr.id)}>
            <title>{`${tr.id} announced "${a.lead} m to exit" here (true position)`}</title>
          </path>
        ) : null,
      ),
    )

  return (
    <div className="panel" ref={ref}>
      <h2>Road: whole route</h2>
      <svg width={W} height={74} viewBox={`0 0 ${W} 74`} role="img" aria-label="Whole road with the tunnel">
        <Features x={overview} result={result} y0={22} y1={48} labels compact={compact} />
        {announced(overview, 56)}
        {tracks.map((tr) => {
          const e = tr.estimates[k]
          return e ? <Marker key={tr.id} x={overview(e.s)} y={35} color={estimatorColor(tr.id)} width={W} /> : null
        })}
        <rect x={overview(truth.s) - 3} y={27} width={6} height={16} fill={TRUTH_COLOR} />
      </svg>
      <Legend />

      <h2 style={{ marginTop: 8 }}>Road: {2 * ZOOM_HALF} m around the true car</h2>
      <svg width={W} height={zoomH} viewBox={`0 0 ${W} ${zoomH}`} role="img" aria-label="Zoomed road around the car">
        <defs>
          <clipPath id="zoom-clip">
            <rect x={PAD} y={0} width={W - 2 * PAD} height={zoomH} />
          </clipPath>
        </defs>
        <g clipPath="url(#zoom-clip)">
          <Features x={zoom} result={result} y0={8} y1={zoomH - 18} labels compact={compact} />
          <rect x={zoom(truth.s) - 3} y={12} width={6} height={rowsBottom - 12} fill={TRUTH_COLOR} />
          {announced(zoom, rowsBottom + 4)}
          {recentFixes.map((f) => (
            <circle key={f.t} cx={zoom(f.s)} cy={20} r={3} fill={GNSS_COLOR}>
              <title>{`GNSS fix t = ${f.t} s`}</title>
            </circle>
          ))}
          {tracks.map((tr, i) => {
            const e = tr.estimates[k]
            if (!e) return null
            const y = 40 + i * 16
            const color = estimatorColor(tr.id)
            return (
              <g key={tr.id}>
                {tr.id === bandId && (
                  <rect
                    x={zoom(e.s - 2 * e.sigmaS)}
                    y={y - 6}
                    width={Math.max(1, zoom(e.s + 2 * e.sigmaS) - zoom(e.s - 2 * e.sigmaS))}
                    height={12}
                    fill={color}
                    opacity={0.2}
                  />
                )}
                <Marker x={zoom(e.s)} y={y} color={color} width={W} />
              </g>
            )
          })}
        </g>
        {/* About one distance label per 90 px. */}
        {ticks(zoom.domain, Math.max(3, Math.min(8, Math.floor(W / 90)))).map((s) => (
          <text key={s} x={zoom(s)} y={zoomH - 4} textAnchor="middle">
            {Math.round(s)}
          </text>
        ))}
        <text x={PAD + 4} y={22}>GNSS</text>
        {tracks.map((tr, i) => (
          <text key={tr.id} x={PAD + 4} y={44 + i * 16}>
            {tr.id}
          </text>
        ))}
      </svg>
      <Legend />

      <div className="readout">
        <span>t = {truth.t.toFixed(1)} s</span>
        <span>true s = {truth.s.toFixed(1)} m</span>
        <span>v = {(truth.v * 3.6).toFixed(1)} km/h</span>
        <span>error = estimate − true</span>
        {tracks.map((tr) => {
          const err = tr.errors[k]
          const e = tr.estimates[k]
          return (
            <span key={tr.id} style={{ color: estimatorColor(tr.id) }}>
              {tr.id}:{' '}
              {err === null || err === undefined || !e
                ? '—'
                : `${err >= 0 ? '+' : ''}${err.toFixed(1)} m (±${round2Sigma(2 * e.sigmaS)} m)`}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Approach, shaded tunnel, departure, exit branch and announcement points. */
function Features(p: { x: Scale; result: SingleRunResult; y0: number; y1: number; labels?: boolean; compact?: boolean }) {
  const { x, result, y0, y1, labels, compact } = p
  const { map } = result
  const mid = (y0 + y1) / 2
  const exitX = x(map.exitS)
  return (
    <g>
      <line x1={x(-map.approachLength)} x2={x(map.tunnelLength + map.departureLength)} y1={mid} y2={mid} stroke="var(--road)" strokeWidth={2} />
      <rect x={x(0)} y={y0} width={x(map.tunnelLength) - x(0)} height={y1 - y0} fill="var(--tunnel)" />
      <line x1={exitX} x2={exitX + 14} y1={mid} y2={y0 - 2} stroke="var(--road)" strokeWidth={2} />
      <line x1={exitX} x2={exitX} y1={y0} y2={y1} stroke="var(--text)" strokeWidth={1.5} />
      {labels && (
        <text x={exitX + 16} y={y0 + 4}>
          exit
        </text>
      )}
      {[400, 100].map((lead, i) => {
        const ax = x(map.exitS - lead)
        return (
          <g key={lead}>
            <line x1={ax} x2={ax} y1={y0} y2={y1} stroke="var(--text)" strokeDasharray="3 3" />
            {/* Staggered so the two labels do not overlap on a short tunnel. */}
            {labels && (
              <text x={ax - 3} y={y0 + 11 + i * 11} textAnchor="end">
                {compact ? `${lead} m` : `${lead} m before exit`}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

/** Estimate marker (○); dashed at the edge when the estimate lies outside the strip. */
function Marker({ x, y, color, width }: { x: number; y: number; color: string; width: number }) {
  const lo = PAD + 6
  const hi = width - PAD - 6
  const outside = x < lo || x > hi
  return (
    <circle
      cx={Math.min(Math.max(x, lo), hi)}
      cy={y}
      r={5}
      fill="var(--panel)"
      stroke={color}
      strokeWidth={2.5}
      strokeDasharray={outside ? '3 2' : undefined}
    />
  )
}

function Legend() {
  return <p className="note">▮ true car · ○ estimate · ▲ true position when each method announced</p>
}

/** 2σ for the readout: whole metres from 10 m, one decimal below. */
function round2Sigma(v: number): string {
  return v >= 10 ? v.toFixed(0) : v.toFixed(1)
}

function triangle(cx: number, top: number): string {
  return `M${cx},${top}L${cx - 5},${top + 9}L${cx + 5},${top + 9}Z`
}
