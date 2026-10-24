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
const SENSOR = 'src/core/sensors/fixture.ts'
const UI = 'src/ui/fixture.tsx'

describe('truth isolation: estimators', () => {
  it.each([
    ["import { x } from '../world/trajectory'\nexport { x }", 'world module'],
    ["import type { T } from '../world'\nexport type U = T", 'type-only import from world'],
    ["export { m } from '../eval/metrics'", 're-export from eval'],
    ["export { load } from '../scenarios/load'", 're-export from scenarios'],
  ])('rejects %j (%s)', async (code) => {
    expect(await ruleIds(code, ESTIMATOR)).toContain('no-restricted-imports')
  })

  it('keeps the core restrictions in the estimators override', async () => {
    const code = "import { useState } from 'react'\nexport { useState }"
    expect(await ruleIds(code, ESTIMATOR)).toContain('no-restricted-imports')
  })

  it('allows measurement types from sensors', async () => {
    const code = "import type { Measurement } from '../sensors/measurement'\nexport type M = Measurement"
    expect(await ruleIds(code, ESTIMATOR)).toEqual([])
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
