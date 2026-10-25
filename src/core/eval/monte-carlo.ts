// Monte Carlo evaluation over seed sets and its markdown report. See ADR-0016.

import type { EstimatorEntry } from '../estimators/estimator'
import { SCENARIOS, type Scenario } from '../scenarios/scenarios'
import { simulateRun } from '../sim/run'
import { evaluateRun, type RunMetrics } from './metrics'

export type SeedSetName = 'tuning' | 'report'

export interface SeedSet {
  /** First seed; the set is first, first + 1, ... (A-43). */
  readonly first: number
  readonly defaultRuns: number
  readonly scenarios: readonly Scenario[]
}

/** Largest number of runs per set; keeps the two seed ranges disjoint (A-43). */
export const MAX_RUNS = 1_000_000

/**
 * Tuning and reporting seeds are disjoint ranges (CLAUDE.md hard rule 4, A-43). The tuning
 * set leaves out poor-sensor, a model-mismatch case (A-53).
 */
export const SEED_SETS: Readonly<Record<SeedSetName, SeedSet>> = {
  tuning: {
    first: 1,
    defaultRuns: 50,
    scenarios: SCENARIOS.filter((s) => s.id !== 'poor-sensor'),
  },
  report: { first: MAX_RUNS + 1, defaultRuns: 200, scenarios: SCENARIOS },
}

export function seedsOf(set: SeedSetName, runs: number): number[] {
  if (!Number.isSafeInteger(runs) || runs < 1 || runs > MAX_RUNS) {
    throw new RangeError(`Runs must be an integer in [1, ${MAX_RUNS}], got ${runs}`)
  }
  return Array.from({ length: runs }, (_, i) => SEED_SETS[set].first + i)
}

export interface ResultRow {
  readonly scenario: string
  readonly method: string
  readonly metrics: readonly RunMetrics[]
}

/** Simulates each scenario once per seed and evaluates every estimator on the same run. */
export function runMonteCarlo(
  scenarios: readonly Scenario[],
  estimators: readonly EstimatorEntry[],
  seeds: readonly number[],
): ResultRow[] {
  const rows: ResultRow[] = []
  for (const scenario of scenarios) {
    const perMethod = estimators.map((): RunMetrics[] => [])
    for (const seed of seeds) {
      const run = simulateRun(scenario.config, seed)
      estimators.forEach((entry, i) => perMethod[i]!.push(evaluateRun(run, entry)))
    }
    estimators.forEach((entry, i) =>
      rows.push({ scenario: scenario.id, method: entry.id, metrics: perMethod[i]! }),
    )
  }
  return rows
}

/** Percentile with linear interpolation between order statistics (p in [0, 1]). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const h = (sorted.length - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (h - lo)
}

interface Column {
  readonly title: string
  readonly value: (m: RunMetrics) => number | null
  readonly digits: number
  /** Two summary statistics shown as "a / b"; median and P95 unless given. */
  readonly summary?: (xs: readonly number[]) => [number, number]
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

const COLUMNS: readonly Column[] = [
  { title: 'Exit error (m)', value: (m) => m.exitError, digits: 1 },
  { title: 'Max tunnel error (m)', value: (m) => m.maxTunnelError, digits: 1 },
  { title: 'Ann. 400 m (m)', value: (m) => m.announcements[0]!.distanceError, digits: 1 },
  { title: 'Ann. 400 m (s)', value: (m) => m.announcements[0]!.timeError, digits: 2 },
  { title: 'Ann. 100 m (m)', value: (m) => m.announcements[1]!.distanceError, digits: 1 },
  { title: 'Ann. 100 m (s)', value: (m) => m.announcements[1]!.timeError, digits: 2 },
  // Mean, the tuning target (ADR-0017), and P10, the worst runs: the median and P95 of a
  // fraction bounded by 1 are usually both 1.00 and hide over-confident runs (ADR-0018).
  {
    title: '±2σ coverage (mean / P10)',
    value: (m) => m.coverage,
    digits: 2,
    summary: (xs) => [mean(xs), percentile(xs, 0.1)],
  },
  { title: 'Return jump (m)', value: (m) => m.returnJump, digits: 1 },
  { title: 'Recovery (s)', value: (m) => m.recoveryTime, digits: 1 },
]

/**
 * One table per scenario, one row per method. Cells are "median / P95" over the runs that
 * have a value, except coverage ("mean / P10"); missed announcements and runs that never
 * recover are counted separately.
 */
export function toMarkdown(rows: readonly ResultRow[]): string {
  const header = `| Method | ${COLUMNS.map((c) => c.title).join(' | ')} | Missed ann. | Not recovered |`
  const rule = `|---|${COLUMNS.map(() => '---').join('|')}|---|---|`
  const out: string[] = []
  for (const scenario of [...new Set(rows.map((r) => r.scenario))]) {
    out.push(`### ${scenario}`, '', header, rule)
    for (const row of rows.filter((r) => r.scenario === scenario)) {
      const cells = COLUMNS.map((c) => {
        const xs = row.metrics.map(c.value).filter((x): x is number => x !== null)
        if (xs.length === 0) return '—'
        const [a, b] = c.summary ? c.summary(xs) : [percentile(xs, 0.5), percentile(xs, 0.95)]
        return `${a.toFixed(c.digits)} / ${b.toFixed(c.digits)}`
      })
      const missed = row.metrics.filter((m) => m.announcements.some((a) => a.timeError === null)).length
      const notRecovered = row.metrics.filter((m) => m.recoveryTime === null).length
      out.push(`| ${row.method} | ${cells.join(' | ')} | ${missed} | ${notRecovered} |`)
    }
    out.push('')
  }
  return out.join('\n')
}
