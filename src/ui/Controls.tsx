import { useEffect, useState } from 'react'
import type { ScenarioOverrides } from '../core/scenarios/overrides'
import type { Scenario } from '../core/scenarios/scenarios'
import { MAX_TUNNEL_LENGTH, MIN_TUNNEL_LENGTH, MAX_SCENARIO_GRADE } from '../core/scenarios/validate'
import { estimatorColor } from './theme'

/** Bias slider range, m/s² (A-45). */
const MAX_BIAS = 0.3

interface Props {
  scenarios: readonly Scenario[]
  scenario: Scenario
  onScenario: (id: string) => void
  seed: number
  onSeed: (seed: number) => void
  estimatorIds: readonly string[]
  shown: ReadonlySet<string>
  onToggle: (id: string) => void
  bandId: string
  onBand: (id: string) => void
  overrides: ScenarioOverrides
  onOverrides: (o: ScenarioOverrides) => void
}

export function Controls(p: Props) {
  const defaultLength = p.scenario.config.map.tunnelLength
  const set = (patch: ScenarioOverrides) => p.onOverrides({ ...p.overrides, ...patch })

  return (
    <aside className="controls">
      <h1>Through the Tunnel</h1>

      <div className="control">
        <label htmlFor="scenario">Scenario</label>
        <select id="scenario" value={p.scenario.id} onChange={(e) => p.onScenario(e.target.value)}>
          {p.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}
            </option>
          ))}
        </select>
        <div className="value" style={{ marginTop: 4 }}>{p.scenario.description}</div>
      </div>

      <SeedControl seed={p.seed} onSeed={p.onSeed} />

      <div className="control">
        <div className="label">Estimators <span className="value">show · ±2σ band</span></div>
        <div className="estimators">
          {p.estimatorIds.map((id) => (
            <EstimatorRow
              key={id}
              id={id}
              shown={p.shown.has(id)}
              band={p.bandId === id}
              onToggle={() => p.onToggle(id)}
              onBand={() => p.onBand(id)}
            />
          ))}
        </div>
      </div>

      <RangeControl
        label="Tunnel length"
        min={MIN_TUNNEL_LENGTH}
        max={MAX_TUNNEL_LENGTH}
        step={100}
        value={p.overrides.tunnelLength ?? defaultLength}
        format={(v) => `${v} m`}
        fallback={p.overrides.tunnelLength === undefined ? `${defaultLength} m (scenario)` : undefined}
        onCommit={(v) => set({ tunnelLength: v === defaultLength ? undefined : v })}
      />
      <RangeControl
        label="Accelerometer bias"
        min={-MAX_BIAS}
        max={MAX_BIAS}
        step={0.01}
        value={p.overrides.accelBias ?? 0}
        format={(v) => `${v.toFixed(2)} m/s²`}
        fallback={p.overrides.accelBias === undefined ? 'drawn from seed' : undefined}
        onCommit={(v) => set({ accelBias: v })}
      />
      <RangeControl
        label="Tunnel grade"
        min={-MAX_SCENARIO_GRADE * 100}
        max={MAX_SCENARIO_GRADE * 100}
        step={0.5}
        value={(p.overrides.grade ?? 0) * 100}
        format={(v) => `${v.toFixed(1)} %`}
        fallback={p.overrides.grade === undefined ? 'scenario profile' : undefined}
        onCommit={(v) => set({ grade: v / 100 })}
      />

      <button onClick={() => p.onOverrides({})}>Reset to scenario defaults</button>
    </aside>
  )
}

function EstimatorRow(p: { id: string; shown: boolean; band: boolean; onToggle: () => void; onBand: () => void }) {
  return (
    <>
      <label style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={p.shown} onChange={p.onToggle} />
        <span className="swatch" style={{ background: estimatorColor(p.id) }} />
        {p.id}
      </label>
      <span />
      <input type="radio" name="band" aria-label={`±2σ band of ${p.id}`} checked={p.band} onChange={p.onBand} />
    </>
  )
}

function SeedControl(p: { seed: number; onSeed: (seed: number) => void }) {
  const [draft, setDraft] = useState(String(p.seed))
  useEffect(() => setDraft(String(p.seed)), [p.seed])
  const commit = () => {
    const n = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(n)) p.onSeed(n)
    else setDraft(String(p.seed))
  }
  return (
    <div className="control">
      <label htmlFor="seed">Seed</label>
      <div className="row">
        <input
          id="seed"
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <button onClick={() => p.onSeed(p.seed + 1)}>Next</button>
      </div>
    </div>
  )
}

/** A slider that shows its value while dragging and commits on release, so a drag runs once. */
function RangeControl(p: {
  label: string
  min: number
  max: number
  step: number
  value: number
  format: (v: number) => string
  /** Shown instead of the value while the scenario's own setting is in use. */
  fallback?: string
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const shown = draft ?? p.value
  const commit = () => {
    if (draft !== null && draft !== p.value) p.onCommit(draft)
    setDraft(null)
  }
  return (
    <div className="control">
      <label>
        {p.label} <span className="value">{draft !== null ? p.format(draft) : (p.fallback ?? p.format(p.value))}</span>
      </label>
      <input
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={shown}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  )
}
