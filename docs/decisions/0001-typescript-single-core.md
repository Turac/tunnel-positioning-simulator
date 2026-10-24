# 0001. TypeScript for both the simulator UI and the estimation core

- Status: accepted
- Date: 2026-10-24
- Phase: 0

## Context

The deliverable must be a visual simulator that reviewers can run easily, and the follow-up
interview requires changing scenarios and parameters live. The same estimators must also run
in batch (Monte Carlo) to produce statistically meaningful results.

## Decision

Write everything in TypeScript. The simulation and estimation core (`src/core/`) is pure
TypeScript with no DOM or Node dependencies, so the same code runs in the browser (React + SVG
UI, built with Vite) and headless in Node (batch evaluation). Tests use Vitest.

## Alternatives considered

- **Python + notebook:** strong numerics ecosystem, but weaker interactivity for a live demo,
  and a separate UI stack would be needed.
- **C++ or Rust core compiled to WebAssembly:** mirrors a production shared-core architecture,
  but adds build complexity and time without improving the algorithmic evaluation that this
  task is about.

## Consequences

- One codebase: what the UI shows and what the report measures come from identical code.
- State vectors are small (≤ ~6 states), so hand-written small-matrix maths is sufficient;
  no heavy linear algebra dependency is needed.
- The core boundary is clean enough that porting the estimator to a C++ engine would be a
  translation exercise; this is discussed as future work, not implemented.
