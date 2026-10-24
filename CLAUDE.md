# CLAUDE.md

Guidance for AI coding agents (and humans) working in this repository.

## Project

A browser-based simulator for estimating a car's position while GNSS is unavailable inside
a single-lane road tunnel (500 m – 5 km). It simulates the true motion, the sensor data a
phone would record, several position estimators, and an evaluation harness that measures
how each estimator performs and where it fails.

This is a controlled simulation for studying assumptions and failure modes. It makes no
claim about field accuracy on real devices.

## Architecture

```
src/core/            Pure TypeScript. No DOM, no React, no Node APIs.
  world/             Ground truth: tunnel geometry, speed profiles, grade, true trajectory.
  sensors/           Turns ground truth into noisy measurements (IMU, GNSS, ...).
  estimators/        Position estimators. Consume measurements ONLY.
  eval/              Metrics and Monte Carlo runner. The only place truth meets estimates.
  scenarios/         Scenario loading and validation.
  random/            Seeded PRNG and Gaussian sampling.
src/ui/              React + SVG visualisation. Reads from core, never the other way.
scripts/             Node CLI entry points (batch evaluation).
scenarios/           Scenario definitions (JSON).
tests/               Vitest unit and scenario regression tests.
docs/                Assumptions, decisions (ADRs), AI log, report.
```

### Hard rules

1. **Truth isolation.** `estimators/` must never import from `world/` or receive ground-truth
   values. Estimators see a stream of `Measurement` objects and nothing else. This is enforced
   by ESLint (`no-restricted-imports` per directory); do not disable or work around that rule.
2. **Determinism.** Never use `Math.random()` in `src/core/`. All randomness goes through the
   seeded PRNG in `random/`. Same scenario + same seed = identical output.
3. **No inverse crime.** The sensor simulator may model error sources that estimators do not
   model. Never simplify the simulator to make an estimator look better.
4. **Separate tuning and reporting seeds.** Estimator parameters are tuned on the tuning seed
   set only. Reported results use a disjoint reporting seed set.
5. **Assumptions are explicit.** Every numeric assumption lives in `docs/ASSUMPTIONS.md` with an
   ID (e.g. `A-07`). Code that depends on one references its ID in a comment. Changing an
   assumption's value requires updating that file in the same commit.

## Conventions

- Units: SI everywhere (m, s, m/s, m/s², rad). Convert only at the UI boundary (km/h display).
- Position along the tunnel centerline: `s` in metres, `s = 0` at the tunnel entrance.
- Vehicle frame: x forward, y left, z up. Grade is positive uphill.
- Time: seconds since scenario start, as `number`. Each sensor has its own sample times.
- TypeScript `strict` mode. No `any` in `src/core/`.
- Prefer small pure functions. Estimators expose `step(measurement) -> Estimate`.

## Decision protocol

Before any non-trivial technical decision (algorithm choice, model structure, noise values,
new dependency, data format, architecture change):

1. Propose it with: **what**, **why**, **alternatives considered**, **trade-offs**.
2. Wait for explicit approval. Do not implement first and explain later.
3. Once approved, record significant decisions as an ADR in `docs/decisions/NNNN-title.md`
   (copy `0000-template.md`).
4. If the human corrects, rejects or changes a proposal, propose an entry for `docs/ai-log.md`.

## Session workflow

1. At the start of a session, read this file, `docs/ASSUMPTIONS.md` and the ADRs of the
   current phase. Confirm which phase and task we are on before writing code.
2. For each phase, present a short plan (tasks and proposed commits) and wait for approval.
3. Work one task at a time: implement, test, show the diff summary, propose the commit.

## Testing

- Every core module ships with unit tests. Run `npm test` before proposing a commit.
- Never propose a commit with failing tests, lint errors or type errors.
- Scenario regression tests compare estimators on fixed seeds; a change that worsens a
  metric must be called out explicitly, never hidden.

## Git workflow

- Phase 0 is committed directly to `main`. Each later phase is developed on a branch
  `phase-N-short-name` and merged through a pull request with a merge commit (no squash),
  so individual commits remain visible. The PR description summarises what the phase
  delivered, the decisions taken (with ADR links) and known limitations.
- **Conventional Commits** in English: `type(scope): imperative summary`
  - types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`
  - scopes: `world`, `sensors`, `estimators`, `eval`, `scenarios`, `ui`, `random`, `cli`, `docs`
  - e.g. `feat(sensors): add accelerometer bias random walk`
  - summary ≤ 72 characters; a body explains *why* when the change is not obvious.
- One logical change per commit. Code and its tests go in the same commit.
  No "WIP", "misc" or "fix stuff" commits.
- **The agent never commits on its own.** It shows a summary of the diff and a proposed
  commit message, then waits for approval.
- Never rewrite pushed history (no force push, no amending pushed commits).
- Keep the `Co-Authored-By` trailer on commits where an AI agent wrote code.
- Do not add dependencies without approval.
- Never commit: `CLAUDE.local.md`, `LEARNING.md`, `notes/`, `out/`, `.env*`,
  `.claude/settings.local.json`. Shared agent tooling under `.claude/commands/` is committed.

## Phases

| Phase | Branch | Goal |
|---|---|---|
| 0 | `main` | Scaffolding, conventions, assumptions, PRNG |
| 1 | `phase-1-world` | Tunnel geometry, speed and grade profiles, true trajectory |
| 2 | `phase-2-sensors` | IMU and GNSS measurement models |
| 3 | `phase-3-eval` | Metrics, Monte Carlo runner, baseline estimators |
| 4 | `phase-4-kalman` | IMU dead reckoning, Kalman filter, stop detection, GNSS gating |
| 5 | `phase-5-ui` | Visual simulator and live parameter controls |
| 6 | `phase-6-results` | Evaluation runs, report, README, AI usage notes |

Stretch (only after Phase 6 core is complete): sparse BLE beacons, exit-branch hypotheses,
multiple cars.

## Commands

- `npm run dev` start the simulator
- `npm test` run unit and scenario tests
- `npm run typecheck` type-check without emitting
- `npm run lint` lint, including module boundaries
- `npm run eval` batch Monte Carlo evaluation (from Phase 3)
