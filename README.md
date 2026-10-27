# Through the Tunnel

Simulator and evaluation harness for estimating a car's position while GNSS is unavailable
inside a road tunnel.

> Status: the core is complete: simulation, estimators, evaluation, visual simulator and
> report. Optional extensions are listed in `CLAUDE.md`.

## What this is

A controlled simulation that generates a car's true motion through a single-lane tunnel,
the sensor data a phone would record, and several position estimators. An evaluation
harness measures how each estimator performs, where it breaks, and why.

It makes no claim about accuracy on real devices; see `docs/ASSUMPTIONS.md`.

## Demo

[Screen recording of the visual simulator](docs/media/simulator-demo.mp4) (MP4, 110 s,
43 MB; downloads when opened): the baseline tunnel, a stop-and-go run, a larger
accelerometer bias and a longer tunnel.

## Getting started

### Requirements

- Node.js `^22.13` or `^24` (developed with 24.7). These are the versions that all
  development tools support.
- Optional: a C compiler (`cc`), only to regenerate the PRNG reference test vectors.

### Commands

```bash
npm install
npm run dev         # start the simulator; open the printed URL (Chrome recommended, see Reproducibility)
npm run build       # type-check and build for production into dist/
npm test            # run all tests once
npm run test:watch  # run tests in watch mode
npm run typecheck   # type-check without emitting
npm run lint        # lint, including module-boundary rules
npm run eval        # Monte Carlo evaluation, writes out/eval-report.md
```

Before every commit, `npm test`, `npm run typecheck` and `npm run lint` must pass.

### Reproducibility

All randomness comes from a seeded generator (`src/core/random/`, ADR-0004 to ADR-0006):
the same scenario and seed give the same output.

- The integer generator and uniform samples are exact on every JavaScript engine.
- Gaussian samples use `Math.log` and `Math.cos`, which ECMAScript does not require to
  be identical across engines. **Exact reproduction is guaranteed on V8 (Chrome, Node.js).**
  Other engines, such as Safari's JavaScriptCore, may differ in the last bit of a sample.
- The PRNG test vectors come from the authors' official C implementations, stored
  unmodified in `tests/reference/` with instructions to rebuild and compare them.

## Simulation

`simulateRun(config, seed)` (`src/core/sim/run.ts`) produces one run as plain data:

- **map**: tunnel geometry, exit position and grade profile, known to the estimators
  (ADR-0007).
- **truth**: the car's true position, speed, acceleration and road pitch on the
  accelerometer grid, from a piecewise-linear speed profile; the run ends when the car
  reaches the road end (ADR-0008).
- **measurements**: time-sorted accelerometer samples (100 Hz specific force with noise,
  bias, drift, vibration and optional mounting errors; ADR-0009) and GNSS fixes (1 Hz,
  correlated error, lost in the tunnel, delayed and inflated after the exit; ADR-0010).

Estimators may only see `map` and `measurements`; lint rules enforce this. Every value
and its source, or the lack of one, is in `docs/ASSUMPTIONS.md`.

## Estimation and evaluation

Three estimators (`src/core/estimators/`) see only the map and the measurements, one at a
time, and give a position with its own uncertainty at every accelerometer sample
(ADR-0011):

- **B0**: constant speed from the last GNSS fix.
- **A1**: accelerometer integration with gravity removed using the map's grade; no bias
  estimate.
- **A2**: Kalman filter with position, speed and accelerometer bias, the grade in its
  Jacobian, gated GNSS updates and zero-velocity updates at stops (ADR-0013 to ADR-0015,
  tuning in ADR-0017).

Five scenarios (`src/core/scenarios/`): baseline 1 km, long 5 km, stop-and-go, graded and
poor-sensor. The metrics (`src/core/eval/`, ADR-0012) are the error at the tunnel exit, the
largest error inside, the exit announcements at 400 m and 100 m (early or late, in metres
and seconds), the ±2σ coverage and the behaviour when GNSS returns.

`npm run eval` runs every scenario and estimator on 200 report seeds
(`-- --set tuning` for the 50 tuning seeds, `-- --runs N` to change the count) and writes a
markdown table to `out/eval-<set>.md` (ADR-0016, ADR-0018). Tuning and report seeds never
overlap.

Results and findings are in [`docs/report.md`](docs/report.md); the full results table is
[`docs/results/eval-report.md`](docs/results/eval-report.md).

## Visual simulator

`npm run dev` opens a single page that runs one scenario on one seed with the same code
the evaluation uses (`runSingle`, ADR-0019), so its numbers match a row of the report.

- **Sidebar.** Scenario and seed; which estimators are shown and whose ±2σ band is drawn;
  what-if overrides for tunnel length, accelerometer bias and tunnel grade (A-45), with a
  reset to the scenario's own values.
- **Playback bar.** Play/pause at ×1, ×10 or ×30, and a time slider. Keyboard: Space plays
  or pauses, ←/→ step 1 s. The bar stays at the top while the page scrolls.
- **Road.** The whole route, and a 400 m close-up around the true car with one row per
  estimator, GNSS fixes, the exit announcement points and the current errors.
- **Results.** Position error over time (estimate − true) with the selected ±2σ band, the
  run's metrics with the report's columns, and each exit announcement against where the
  car really was.
- **Sensor inputs.** The accelerometer's specific force, and GNSS speed and position error,
  on the same time axis. This section can be collapsed.

In every chart the shaded span is the GNSS outage and the thick grey line is the tunnel
exit. Each scenario opens on the report seed whose A2 exit error is closest to the report
median, so the run is a representative one, not the best one. The table is in
`src/ui/defaultSeeds.ts`.

## Adding a scenario

Scenarios are TypeScript objects, not data files, so the compiler checks them.

1. Add a `Scenario` (`id`, `description`, `config`) to `src/core/scenarios/scenarios.ts`,
   using the `road()` and `cruise()` helpers there, and append it to `SCENARIOS`.
2. Record its values and the reason for them under A-44 in `docs/ASSUMPTIONS.md`, in the
   same commit (CLAUDE.md rule 5).
3. `npm test` checks it with `validateScenario` (tunnel 500 m – 5 km, |grade| ≤ 5 %, exit
   inside the tunnel, speed profile reaching the road end) and records a regression
   snapshot for it. Existing snapshots must not change.
4. `npm run eval` adds it to the results and prints its representative seed. Add that
   seed to `src/ui/defaultSeeds.ts`; otherwise the simulator opens on the first report
   seed.
5. The simulator and the evaluation pick it up from `SCENARIOS` automatically. A scenario
   that tests errors the filter does not model should be left out of the tuning set
   (`src/core/eval/monte-carlo.ts`, A-53), as poor-sensor is.

## Repository layout

See `CLAUDE.md` for the architecture and conventions.

## Documentation

- [`docs/report.md`](docs/report.md) — evaluation report: setup, results, findings,
  limitations
- [`docs/results/eval-report.md`](docs/results/eval-report.md) — full results table from
  `npm run eval`
- `docs/ASSUMPTIONS.md` — every modelling assumption, with IDs
- `docs/decisions/` — architecture decision records
- [`docs/ai-usage.md`](docs/ai-usage.md) — AI usage note
- `docs/ai-log.md` — dated record of how AI tools were used and where they were corrected
- `tests/reference/README.md` — sources and rebuild steps for the PRNG test vectors
