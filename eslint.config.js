import { builtinModules } from 'node:module'
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Module boundaries (CLAUDE.md, hard rules 1 and 2). See docs/decisions/0003; the map/,
// sim/ and measurement-only boundaries are justified in docs/decisions/0007.
//
// Flat config does not merge a rule's options across blocks: a later block that sets
// `no-restricted-imports` replaces the earlier options entirely. The estimators, map and
// measurement blocks therefore repeat the core restrictions and add their own.

const coreImportPaths = [
  { name: 'react', message: 'src/core must not depend on React; UI code lives in src/ui.' },
  { name: 'react-dom', message: 'src/core must not depend on React; UI code lives in src/ui.' },
  ...builtinModules
    .filter((name) => !name.startsWith('_'))
    .map((name) => ({
      name,
      message: 'src/core must run in the browser and in Node; do not import Node built-ins.',
    })),
]

const coreImportPatterns = [
  {
    regex: '^react(-dom)?/',
    message: 'src/core must not depend on React; UI code lives in src/ui.',
  },
  {
    regex: '^node:',
    message: 'src/core must run in the browser and in Node; do not import Node built-ins.',
  },
  {
    regex: '(^|/)ui(/|$)',
    message: 'src/core must not import from src/ui; the UI reads from core, never the reverse.',
  },
]

const truthIsolationMessage =
  'Truth isolation: estimators consume Measurement objects and the map only (CLAUDE.md hard rule 1).'

// Shared by estimators/ and by sensors/measurement.ts, the one sensor file estimators may
// import: neither may reach ground truth, directly or through another module.
const truthIsolationPatterns = [
  { regex: '(^|/)(world|sim|eval|scenarios)(/|$)', message: truthIsolationMessage },
  {
    // Any path into sensors/ except sensors/measurement (with an optional extension).
    regex: '(^|/)sensors(/(?!measurement(\\.[cm]?[jt]s)?$).*)?$',
    message: `${truthIsolationMessage} From sensors/, import measurement.ts only.`,
  },
]

// measurement.ts is imported by estimators, so it must not import its sibling sensor files
// (which read world/). From inside sensors/ those are plain './x' paths.
const measurementSiblingPatterns = [
  {
    regex: '^\\./',
    message: `${truthIsolationMessage} measurement.ts must not import other sensor files.`,
  },
]

// map/ (known map data) and physics/ (physical constants) are shared by the simulator and
// estimators/, so they must not depend on ground truth or on anything that produces it.
const neutralModulePatterns = [
  {
    regex: '(^|/)(world|sensors|sim|eval|scenarios)(/|$)',
    message:
      'map/ and physics/ are imported by estimators/; they must not import ' +
      'world, sensors, sim, eval or scenarios (CLAUDE.md hard rule 1).',
  },
]

const browserOrNodeGlobal = 'src/core must not use DOM or Node globals.'
const clockGlobal = 'Determinism: time comes from the scenario, not the wall clock (CLAUDE.md hard rule 2).'

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'out/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: coreImportPaths, patterns: coreImportPatterns },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'self',
          'globalThis',
          'process',
          'Buffer',
          'require',
          'module',
          '__dirname',
          '__filename',
        ].map((name) => ({ name, message: browserOrNodeGlobal })),
        {
          name: 'crypto',
          message: 'Determinism: use the seeded PRNG in src/core/random (CLAUDE.md hard rule 2).',
        },
        { name: 'Date', message: clockGlobal },
        { name: 'performance', message: clockGlobal },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Determinism: use the seeded PRNG in src/core/random (CLAUDE.md hard rule 2).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Dynamic import() bypasses the module boundary rules; use a static import.',
        },
      ],
    },
  },
  {
    files: ['src/core/estimators/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: coreImportPaths,
          patterns: [...coreImportPatterns, ...truthIsolationPatterns],
        },
      ],
    },
  },
  {
    files: ['src/core/map/**/*.ts', 'src/core/physics/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: coreImportPaths,
          patterns: [...coreImportPatterns, ...neutralModulePatterns],
        },
      ],
    },
  },
  // The UI draws what eval/ gives it (runSingle, ADR-0019) and never assembles truth itself.
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(world|sim)(/|$)',
              message: 'src/ui gets truth, estimates and metrics from eval/ (runSingle), not from world/ or sim/.',
            },
          ],
        },
      ],
    },
  },
  // Must come after any src/core/sensors/** block, so that its options win.
  {
    files: ['src/core/sensors/measurement.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: coreImportPaths,
          patterns: [
            ...coreImportPatterns,
            ...truthIsolationPatterns,
            ...measurementSiblingPatterns,
          ],
        },
      ],
    },
  },
)
