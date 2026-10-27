import { COLUMNS } from '../core/eval/monte-carlo'
import type { SingleRunResult } from '../core/eval/single-run'
import { Card } from './Card'
import { estimatorColor } from './theme'

interface Props {
  result: SingleRunResult
  shown: ReadonlySet<string>
}

/** Metrics of this run, with the same columns as the Monte Carlo report (ADR-0012). */
export function MetricsPanel({ result, shown }: Props) {
  const tracks = result.tracks.filter((tr) => shown.has(tr.id))
  return (
    <Card tone="result" title="Metrics for this run" subtitle="Same columns as the Monte Carlo report, for this one seed.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              {COLUMNS.map((c) => (
                // Single run: the "(mean / P10)" summary note of the report does not apply.
                <th key={c.title}>{c.title.replace(/ \(mean \/ P10\)$/, '')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tracks.map((tr) => (
              <tr key={tr.id}>
                <td style={{ color: estimatorColor(tr.id), fontWeight: 600 }}>{tr.id}</td>
                {COLUMNS.map((c) => {
                  const v = c.value(tr.metrics)
                  return <td key={c.title}>{v === null ? (c.title.startsWith('Ann.') ? 'missed' : 'never') : v.toFixed(c.digits)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">Announcement errors: negative = early, positive = late.</p>
    </Card>
  )
}

/** Where each estimator announced the exit, against where the car really was. */
export function AnnouncementTable({ result, shown }: Props) {
  const samples = result.truth.samples
  const tracks = result.tracks.filter((tr) => shown.has(tr.id))
  return (
    <Card
      tone="result"
      title={`Exit announcements (exit at ${result.map.exitS} m)`}
      subtitle="When each method said “400 m / 100 m to exit”, and where the car really was."
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Announcement</th>
              <th>Point (m)</th>
              <th>Announced at (s)</th>
              <th>Car really at (m)</th>
              <th>Car reached point at (s)</th>
            </tr>
          </thead>
          <tbody>
            {tracks.flatMap((tr) =>
              tr.announcements.map((ev) => (
                <tr key={`${tr.id}-${ev.lead}`}>
                  <td style={{ color: estimatorColor(tr.id), fontWeight: 600 }}>{tr.id}</td>
                  <td>{ev.lead} m to exit</td>
                  <td>{ev.target.toFixed(0)}</td>
                  <td>{ev.kEst === null ? 'missed' : samples[ev.kEst]!.t.toFixed(2)}</td>
                  <td>{ev.kEst === null ? '—' : samples[ev.kEst]!.s.toFixed(1)}</td>
                  <td>{samples[ev.kTrue]!.t.toFixed(2)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
