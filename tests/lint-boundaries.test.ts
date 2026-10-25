import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

// Proves that the module-boundary rules in eslint.config.js actually fire, so that a
// rule disabled or weakened by mistake breaks the test suite. File paths are virtual:
// ESLint applies the config by path without reading the file from disk.

let eslint: ESLint

beforeAll(() => {
  eslint = new ESLint()
})

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'fatal')
}

const ESTIMATOR = 'src/core/estimators/fixture.ts'
const NESTED_ESTIMATOR = 'src/core/estimators/kalman/fixture.ts'
const SENSOR = 'src/core/sensors/fixture.ts'
const MEASUREMENT = 'src/core/sensors/measurement.ts'
const MAP = 'src/core/map/fixture.ts'
const SIM = 'src/core/sim/fixture.ts'
const UI = 'src/ui/fixture.tsx'

const REACT_IMPORT = "import { useState } from 'react'\nexport { useState }"

describe('truth isolation: estimators', () => {
  it.each([
    ["import { x } from '../world/trajectory'\nexport { x }", 'world module'],
    ["import type { T } from '../world'\nexport type U = T", 'type-only import from world'],
    ["export { m } from '../eval/metrics'", 're-export from eval'],
    ["export { load } from '../scenarios/load'", 're-export from scenarios'],
    ["export { simulateRun } from '../sim/run'", 'sim module'],
    ["export { simulateRun } from '../sim'", 'sim index'],
    ["export { accel } from '../sensors/accelerometer'", 'sensor file other than measurement'],
    ["export type { T } from '../sensors/accelerometer'", 'type-only sensor file'],
    ["export { x } from '../sensors'", 'sensors index'],
    ["export { x } from '../sensors/index'", 'sensors index file'],
    ["export { x } from '../sensors/measurementUtils'", 'name starting with measurement'],
    ["export { x } from '../sensors/measurement/extra'", 'path below measurement'],
  ])('rejects %j (%s)', async (code) => {
    expect(await ruleIds(code, ESTIMATOR)).toContain('no-restricted-imports')
  })

  it('applies to estimators in subdirectories', async () => {
    const code = "export { accel } from '../../sensors/accelerometer'"
    expect(await ruleIds(code, NESTED_ESTIMATOR)).toContain('no-restricted-imports')
  })

  it('keeps the core restrictions in the estimators override', async () => {
    expect(await ruleIds(REACT_IMPORT, ESTIMATOR)).toContain('no-restricted-imports')
  })

  it.each([
    [
      "import type { Measurement } from '../sensors/measurement'\nexport type M = Measurement",
      ESTIMATOR,
    ],
    ["export { sampleTime } from '../sensors/measurement.ts'", ESTIMATOR],
    ["export { sampleTime } from '../../sensors/measurement'", NESTED_ESTIMATOR],
    ["export { tunnel } from '../map/tunnel'", ESTIMATOR],
    ["export type { TunnelMap } from '../map'", ESTIMATOR],
  ])('allows %j in %s', async (code, filePath) => {
    expect(await ruleIds(code, filePath)).toEqual([])
  })
})

describe('truth isolation: sensors/measurement.ts', () => {
  it.each([
    ["export { x } from '../world/trajectory'", 'world module'],
    ["export type { T } from '../world'", 'type-only import from world'],
    ["export { x } from '../sim/run'", 'sim module'],
    ["export { x } from '../eval/metrics'", 'eval module'],
    ["export { x } from '../scenarios/load'", 'scenarios module'],
    ["export { accel } from './accelerometer'", 'sibling sensor file'],
    ["export { accel } from '../sensors/accelerometer'", 'sensor file via parent path'],
  ])('rejects %j (%s)', async (code) => {
    expect(await ruleIds(code, MEASUREMENT)).toContain('no-restricted-imports')
  })

  it('keeps the core restrictions in the measurement override', async () => {
    expect(await ruleIds(REACT_IMPORT, MEASUREMENT)).toContain('no-restricted-imports')
  })

  it('does not restrict other sensor files', async () => {
    const code = "export { x } from './accelerometer'\nexport { y } from '../world/trajectory'"
    expect(await ruleIds(code, SENSOR)).toEqual([])
  })
})

describe('map neutrality', () => {
  it.each([
    ["export { x } from '../world/trajectory'", 'world module'],
    ["export type { T } from '../world'", 'type-only import from world'],
    ["export { x } from '../sensors/measurement'", 'sensors'],
    ["export { x } from '../sim/run'", 'sim module'],
    ["export { x } from '../eval/metrics'", 'eval module'],
    ["export { x } from '../scenarios/load'", 'scenarios module'],
  ])('rejects %j (%s)', async (code) => {
    expect(await ruleIds(code, MAP)).toContain('no-restricted-imports')
  })

  it('keeps the core restrictions in the map override', async () => {
    expect(await ruleIds(REACT_IMPORT, MAP)).toContain('no-restricted-imports')
  })

  it('allows world to read the map', async () => {
    const code = "export { tunnel } from '../map/tunnel'"
    expect(await ruleIds(code, 'src/core/world/fixture.ts')).toEqual([])
  })
})

describe('physics neutrality', () => {
  it.each([
    "export { x } from '../world/trajectory'",
    "export { x } from '../sensors/accelerometer'",
    "export { x } from '../sim/run'",
  ])('rejects %j', async (code) => {
    expect(await ruleIds(code, 'src/core/physics/fixture.ts')).toContain('no-restricted-imports')
  })

  it('may be imported by estimators', async () => {
    const code = "export { STANDARD_GRAVITY } from '../physics/constants'"
    expect(await ruleIds(code, ESTIMATOR)).toEqual([])
  })
})

describe('sim may combine truth and sensors', () => {
  it('allows world, sensors and map', async () => {
    const code = [
      "export { x } from '../world/trajectory'",
      "export { y } from '../sensors/accelerometer'",
      "export { z } from '../map/tunnel'",
    ].join('\n')
    expect(await ruleIds(code, SIM)).toEqual([])
  })
})

describe('core: no React, DOM or Node', () => {
  it.each([
    "export { useState } from 'react'",
    "export { createRoot } from 'react-dom/client'",
    "export { readFileSync } from 'node:fs'",
    "export { readFileSync } from 'fs'",
    "export { join } from 'path'",
    "export { App } from '../../ui/App'",
  ])('rejects import %j', async (code) => {
    expect(await ruleIds(code, SENSOR)).toContain('no-restricted-imports')
  })

  it.each([
    'export const t = document.title',
    'export const w = window.innerWidth',
    'export const e = process.env',
    'export const g = globalThis',
  ])('rejects global in %j', async (code) => {
    expect(await ruleIds(code, SENSOR)).toContain('no-restricted-globals')
  })

  it('rejects dynamic import', async () => {
    const code = "export const w = import('../world/trajectory')"
    expect(await ruleIds(code, SENSOR)).toContain('no-restricted-syntax')
  })

  it('allows sensors to read ground truth from world', async () => {
    const code = "export { trajectory } from '../world/trajectory'"
    expect(await ruleIds(code, SENSOR)).toEqual([])
  })
})

describe('core: determinism', () => {
  it.each(['export const r = Math.random()', 'export const { random } = Math'])(
    'rejects %j',
    async (code) => {
      expect(await ruleIds(code, SENSOR)).toContain('no-restricted-properties')
    },
  )

  it.each([
    'export const t = Date.now()',
    'export const d = new Date()',
    'export const t = performance.now()',
    'export const b = crypto.getRandomValues(new Uint32Array(1))',
  ])('rejects %j', async (code) => {
    expect(await ruleIds(code, SENSOR)).toContain('no-restricted-globals')
  })
})

describe('ui is not restricted by core rules', () => {
  it('allows React and Math.random', async () => {
    const code = "import { useState } from 'react'\nexport const s = useState(Math.random())"
    expect(await ruleIds(code, UI)).toEqual([])
  })
})
