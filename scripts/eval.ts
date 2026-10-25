// Batch Monte Carlo evaluation: npm run eval -- [--set tuning|report] [--runs N]
//   [--q-extra X] [--r-scale Y]
//
// Writes a markdown table (median / P95 per metric) to out/eval-<set>.md. --q-extra and
// --r-scale override the Kalman filter's tuning values (A-53, A-54) for tuning runs.

import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { ESTIMATORS } from '../src/core/estimators/list'
import { createKalman, DEFAULT_KALMAN, KALMAN } from '../src/core/estimators/kalman'
import { runMonteCarlo, SEED_SETS, seedsOf, toMarkdown, type SeedSetName } from '../src/core/eval/monte-carlo'

const { values } = parseArgs({
  options: {
    set: { type: 'string', default: 'report' },
    runs: { type: 'string' },
    'q-extra': { type: 'string' },
    'r-scale': { type: 'string' },
  },
})

if (values.set !== 'tuning' && values.set !== 'report') {
  throw new Error(`--set must be tuning or report, got ${values.set}`)
}
const set: SeedSetName = values.set
const runs = values.runs === undefined ? SEED_SETS[set].defaultRuns : Number(values.runs)
const kalman = {
  qExtra: values['q-extra'] === undefined ? DEFAULT_KALMAN.qExtra : Number(values['q-extra']),
  gnssRScale: values['r-scale'] === undefined ? DEFAULT_KALMAN.gnssRScale : Number(values['r-scale']),
}
const estimators = ESTIMATORS.map((e) =>
  e === KALMAN ? { id: e.id, create: (map: Parameters<typeof createKalman>[0]) => createKalman(map, kalman) } : e,
)

const seeds = seedsOf(set, runs)
const started = Date.now()
const rows = runMonteCarlo(SEED_SETS[set].scenarios, estimators, seeds)
const seconds = (Date.now() - started) / 1000

const report = [
  `# Evaluation: ${set} set`,
  '',
  `Seeds ${seeds[0]}–${seeds[seeds.length - 1]} (${runs} runs per scenario). ` +
    `A2 tuning: q_extra = ${kalman.qExtra}, gnssRScale = ${kalman.gnssRScale}.`,
  'Cells are median / P95, except coverage (mean / P10). Announcement errors: negative = early, positive = late.',
  '',
  toMarkdown(rows),
].join('\n')

mkdirSync('out', { recursive: true })
const path = `out/eval-${set}.md`
writeFileSync(path, report)
console.log(`Wrote ${path} in ${seconds.toFixed(1)} s`)
