import { useMemo, useRef, useState } from 'react'
import { ESTIMATORS } from '../core/estimators/list'
import { SEED_SETS } from '../core/eval/monte-carlo'
import { runSingle, type SingleRunResult } from '../core/eval/single-run'
import { applyOverrides, type ScenarioOverrides } from '../core/scenarios/overrides'
import { SCENARIOS } from '../core/scenarios/scenarios'
import { Controls } from './Controls'
import { RoadView } from './RoadView'

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
  const t = Math.min(p.time, truth.runEnd)
  const k = Math.min(truth.samples.length - 1, Math.round(t * truth.rateHz))
  return (
    <>
      <div className="panel time">
        <span>Time</span>
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
      </div>
      <RoadView result={p.result} k={k} shown={p.shown} bandId={p.bandId} />
    </>
  )
}
