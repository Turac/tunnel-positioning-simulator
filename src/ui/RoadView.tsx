import type { SingleRunResult } from '../core/eval/single-run'
import { linearScale, ticks, type Scale } from './lib/scale'
import { estimatorColor, GNSS_COLOR, TRUTH_COLOR } from './theme'

const W = 1000
const PAD = 20
/** Half-width of the zoom strip around the true car, m. */
const ZOOM_HALF = 200

interface Props {
  result: SingleRunResult
  k: number
  shown: ReadonlySet<string>
  bandId: string
}

export function RoadView({ result, k, shown, bandId }: Props) {
  const { map } = result
  const truth = result.truth.samples[k]!
  const tracks = result.tracks.filter((tr) => shown.has(tr.id))

  const overview = linearScale([-map.approachLength, map.tunnelLength + map.departureLength], [PAD, W - PAD])
  const zoom = linearScale([truth.s - ZOOM_HALF, truth.s + ZOOM_HALF], [PAD, W - PAD])

  const zoomH = 50 + tracks.length * 16
  const recentFixes = result.gnss.filter(
    (f) => f.t <= truth.t && Math.abs(f.s - truth.s) <= ZOOM_HALF,
  )

  return (
    <div className="panel">
      <h2>Road: whole route</h2>
      <svg viewBox={`0 0 ${W} 74`} role="img" aria-label="Whole road with the tunnel">
        <Features x={overview} result={result} y0={22} y1={48} labels />
        {tracks.map((tr) => {
          return tr.announcements.map((a) =>
            a.kEst !== null && a.kEst <= k ? (
              <path
                key={`${tr.id}-${a.lead}`}
                d={triangle(overview(result.truth.samples[a.kEst]!.s), 56)}
                fill={estimatorColor(tr.id)}
              >
                <title>{`${tr.id} announced "${a.lead} m to exit" here (true position)`}</title>
              </path>
            ) : null,
          )
        })}
        {tracks.map((tr) => {
          const e = tr.estimates[k]
          return e ? <Marker key={tr.id} x={overview(e.s)} y={35} color={estimatorColor(tr.id)} /> : null
        })}
        <rect x={overview(truth.s) - 3} y={27} width={6} height={16} fill={TRUTH_COLOR} />
      </svg>

      <h2 style={{ marginTop: 8 }}>Road: ±{ZOOM_HALF} m around the true car</h2>
      <svg viewBox={`0 0 ${W} ${zoomH}`} role="img" aria-label="Zoomed road around the car">
        <defs>
          <clipPath id="zoom-clip">
            <rect x={PAD} y={0} width={W - 2 * PAD} height={zoomH} />
          </clipPath>
        </defs>
        <g clipPath="url(#zoom-clip)">
          <Features x={zoom} result={result} y0={8} y1={zoomH - 18} labels />
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
                <Marker x={zoom(e.s)} y={y} color={color} />
              </g>
            )
          })}
          <line x1={zoom(truth.s)} x2={zoom(truth.s)} y1={10} y2={zoomH - 20} stroke={TRUTH_COLOR} strokeWidth={2} />
        </g>
        {ticks(zoom.domain, 8).map((s) => (
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

      <div className="readout">
        <span>t = {truth.t.toFixed(1)} s</span>
        <span>true s = {truth.s.toFixed(1)} m</span>
        <span>v = {(truth.v * 3.6).toFixed(1)} km/h</span>
        {tracks.map((tr) => {
          const err = tr.errors[k]
          return (
            <span key={tr.id} style={{ color: estimatorColor(tr.id) }}>
              {tr.id}: {err === null || err === undefined ? '—' : `${err >= 0 ? '+' : ''}${err.toFixed(1)} m`}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Approach, shaded tunnel, departure, exit branch and announcement points. */
function Features({ x, result, y0, y1, labels }: { x: Scale; result: SingleRunResult; y0: number; y1: number; labels?: boolean }) {
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
      {[400, 100].map((lead) => {
        const ax = x(map.exitS - lead)
        return (
          <g key={lead}>
            <line x1={ax} x2={ax} y1={y0} y2={y1} stroke="var(--text)" strokeDasharray="3 3" />
            {labels && (
              <text x={ax - 3} y={y0 + 11} textAnchor="end">
                {lead} m
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

/** Estimate marker; drawn hollow at the edge when the estimate lies outside the strip. */
function Marker({ x, y, color }: { x: number; y: number; color: string }) {
  const lo = PAD + 6
  const hi = W - PAD - 6
  const outside = x < lo || x > hi
  return (
    <circle
      cx={Math.min(Math.max(x, lo), hi)}
      cy={y}
      r={5}
      fill={outside ? 'none' : color}
      stroke={color}
      strokeWidth={outside ? 2 : 0}
    />
  )
}

function triangle(cx: number, top: number): string {
  return `M${cx},${top}L${cx - 5},${top + 9}L${cx + 5},${top + 9}Z`
}
