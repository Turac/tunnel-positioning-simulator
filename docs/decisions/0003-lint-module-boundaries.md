# 0003. Enforce module boundaries with built-in ESLint rules

- Status: accepted
- Date: 2026-10-24
- Phase: 0

## Context

Two hard rules in `CLAUDE.md` must hold for the evaluation to mean anything:

1. **Truth isolation.** Estimators must never see ground truth. If an estimator could import
   `world/`, it could read the true position or speed, and its measured error would be
   meaningless.
2. **Determinism.** Same scenario and seed must give identical output, so `src/core/` must not
   read hidden randomness (`Math.random`, `crypto`) or the wall clock (`Date`, `performance`).

In addition, `src/core/` must run unchanged in the browser and in Node (ADR-0001), so it
must not depend on React, DOM globals or Node built-ins.

A written rule alone is easy to break by accident, especially with AI-generated code. The
rules need to be checked by a tool, and the check itself needs a test.

## Decision

Enforce the boundaries with ESLint's built-in rules, configured per directory in
`eslint.config.js`. No boundary plugin is added.

- `src/core/**`
  - `no-restricted-imports`: `react`, `react-dom` and their subpaths; every Node built-in
    (from `node:module`'s `builtinModules`, plus any `node:` specifier); anything under `ui/`.
  - `no-restricted-globals`: DOM and Node globals (`window`, `document`, `process`,
    `globalThis`, …), `crypto`, `Date`, `performance`.
  - `no-restricted-properties`: `Math.random` (also catches `const { random } = Math`).
  - `no-restricted-syntax`: dynamic `import()`, which `no-restricted-imports` does not see.
- `src/core/estimators/**`: the core import restrictions **plus** any path segment `world`,
  `eval` or `scenarios`. Type-only imports are included. Flat config replaces a rule's
  options rather than merging them, so this block repeats the core restrictions.
- A second, independent line of defence: `src/core` gets its own `tsconfig` without DOM or
  Node types, so DOM or Node usage is also a type error. It is added with the first core
  code.
- `tests/lint-boundaries.test.ts` runs ESLint through its Node API on virtual file paths and
  asserts that each restriction fires, and that allowed cases (sensors reading `world/`,
  estimators importing measurement types, UI using React) stay clean.

## Alternatives considered

- **`eslint-plugin-boundaries` or `eslint-plugin-import` zones:** more expressive
  element-type rules, but an extra dependency for what three built-in rules already cover.
- **oxlint (the current Vite template default):** much faster, but per-directory
  `no-restricted-imports` overrides and a programmatic API for the proof test are what this
  project relies on. Lint speed is not a concern at this size.
- **TypeScript project references only:** a separate `estimators` project that cannot
  reference `world` would block value imports, but it is heavier to maintain and does not
  cover `Math.random` or the wall clock.
- **Code review only:** no automated guarantee.

## Consequences

- A truth leak or hidden randomness in core fails `npm run lint` and, if the rule itself is
  weakened, fails `npm test`.
- Known gaps: lint cannot stop ground truth from being passed as a runtime value; that is
  prevented by estimator signatures that accept `Measurement` objects only. Restricting
  `globalThis` closes the obvious `globalThis.Math.random` bypass; deliberate obfuscation is
  out of scope.
- New core directories must be checked against these patterns: a directory named `world`,
  `eval`, `scenarios` or `ui` anywhere under `src/core/estimators` would be blocked.
