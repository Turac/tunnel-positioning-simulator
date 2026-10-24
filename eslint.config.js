import { builtinModules } from 'node:module'
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Module boundaries (CLAUDE.md, hard rules 1 and 2). See docs/decisions/0003.
//
// Flat config does not merge a rule's options across blocks: a later block that sets
// `no-restricted-imports` replaces the earlier options entirely. The estimators block
// therefore repeats the core restrictions and adds its own.

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

const truthIsolationPatterns = [
  {
    regex: '(^|/)(world|eval|scenarios)(/|$)',
    message:
      'Truth isolation: estimators consume Measurement objects only (CLAUDE.md hard rule 1).',
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
)
