import { useMemo, useRef, useState } from 'react'
import { ESTIMATORS } from '../core/estimators/list'
import { SEED_SETS } from '../core/eval/monte-carlo'
import { runSingle, type SingleRunResult } from '../core/eval/single-run'
import { applyOverrides, type ScenarioOverrides } from '../core/scenarios/overrides'
import { SCENARIOS } from '../core/scenarios/scenarios'
import { Controls } from './Controls'
import { AccelChart, ErrorChart, GnssCharts } from './Charts'
import { AnnouncementTable, MetricsPanel } from './MetricsPanel'
import { RoadView } from './RoadView'
import { usePlayback } from './usePlayback'

const ESTIMATOR_IDS = ESTIMATORS.map((e) => e.id)

type Computed = { result: SingleRunResult; error: null } | { result: null; error: string }

export function App() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.id)
  // First report seed: the demo shows report-set runs, not tuning seeds (A-43).
  const [seed, setSeed] = useState(SEED_SETS.report.first)
  const [overrides, setOverrides] = useState<ScenarioOverrides>({})
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set(ESTIMATOR_IDS))
  const [bandId, setBandId] = useState('A2')
  const [time, setTime] = useState(0)

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!

  // Recomputed only when a parameter is committed; moving the time cursor reuses it.
  const computed = useMemo((): Computed => {
    try {
      return { result: runSingle(applyOverrides(scenario, overrides), seed, ESTIMATORS), error: null }
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [scenario, seed, overrides])

  // On an invalid parameter the last valid run stays on screen with the error above it.
  const lastGood = useRef<SingleRunResult | null>(null)
  if (computed.result) lastGood.current = computed.result
  const result = computed.result ?? lastGood.current

  const toggle = (id: string) =>
    setShown((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="app">
      <Controls
        scenarios={SCENARIOS}
        scenario={scenario}
        onScenario={(id) => {
          setScenarioId(id)
          setOverrides({})
        }}
        seed={seed}
        onSeed={setSeed}
        estimatorIds={ESTIMATOR_IDS}
        shown={shown}
        onToggle={toggle}
        bandId={bandId}
        onBand={setBandId}
        overrides={overrides}
        onOverrides={setOverrides}
      />
      <main className="main">
        {computed.error && <div className="panel error-banner">Invalid parameters: {computed.error}</div>}
        {result && <RunView result={result} time={time} onTime={setTime} shown={shown} bandId={bandId} />}
      </main>
    </div>
  )
}

function RunView(p: {
  result: SingleRunResult
  time: number
  onTime: (t: number) => void
  shown: ReadonlySet<string>
  bandId: string
}) {
  const { truth } = p.result
  const t = Math.min(Math.max(p.time, 0), truth.runEnd)
  const k = Math.min(truth.samples.length - 1, Math.round(t * truth.rateHz))
  const playback = usePlayback(t, p.onTime, truth.runEnd)
  // GNSS is out from the entry until the first fix after the exit.
  const outage: [number, number] = [truth.entryTime, p.result.reacquisitionTime ?? truth.runEnd]
  return (
    <>
      <div className="panel time">
        <button onClick={playback.toggle} aria-label={playback.playing ? 'Pause' : 'Play'} style={{ width: 70 }}>
          {playback.playing ? 'Pause' : 'Play'}
        </button>
        <select aria-label="Playback speed" value={playback.speed} onChange={(e) => playback.setSpeed(Number(e.target.value))}>
          {[1, 10, 30].map((s) => (
            <option key={s} value={s}>
              ×{s}
            </option>
          ))}
        </select>
        <input
          type="range"
          aria-label="Time"
          min={0}
          max={truth.runEnd}
          step={0.1}
          value={t}
          onChange={(e) => p.onTime(Number(e.target.value))}
        />
        <span className="value">
          {t.toFixed(1)} / {truth.runEnd.toFixed(0)} s
        </span>
        <span className="hint">Space: play · ←/→: 1 s</span>
      </div>
      <RoadView result={p.result} k={k} shown={p.shown} bandId={p.bandId} />
      <div className="panel charts">
        <ErrorChart result={p.result} cursor={t} outage={outage} shown={p.shown} bandId={p.bandId} />
        <AccelChart result={p.result} cursor={t} outage={outage} />
        <GnssCharts result={p.result} cursor={t} outage={outage} />
        <p className="note">Shaded: GNSS outage, from the tunnel entry to the first fix after the exit.</p>
      </div>
      <MetricsPanel result={p.result} shown={p.shown} />
      <AnnouncementTable result={p.result} shown={p.shown} />
    </>
  )
}
