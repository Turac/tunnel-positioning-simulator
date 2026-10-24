# Through the Tunnel

Simulator and evaluation harness for estimating a car's position while GNSS is unavailable
inside a road tunnel.

> Status: work in progress. Phase 0 (scaffolding, module boundaries, seeded PRNG) is
> complete; the simulation itself starts in Phase 1.

## What this is

A controlled simulation that generates a car's true motion through a single-lane tunnel,
the sensor data a phone would record, and several position estimators. An evaluation
harness measures how each estimator performs, where it breaks, and why.

It makes no claim about accuracy on real devices; see `docs/ASSUMPTIONS.md`.

## Getting started

### Requirements

- Node.js `^22.13` or `^24` (developed with 24.7). These are the versions that all
  development tools support.
- Optional: a C compiler (`cc`), only to regenerate the PRNG reference test vectors.

### Commands

```bash
npm install
npm run dev         # start the simulator (Vite dev server)
npm run build       # type-check and build for production into dist/
npm test            # run all tests once
npm run test:watch  # run tests in watch mode
npm run typecheck   # type-check without emitting
npm run lint        # lint, including module-boundary rules
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

## Repository layout

See `CLAUDE.md` for the architecture and conventions.

## Documentation

- `docs/ASSUMPTIONS.md` — every modelling assumption, with IDs
- `docs/decisions/` — architecture decision records
- `docs/ai-log.md` — how AI tools were used and where they were corrected
- `tests/reference/README.md` — sources and rebuild steps for the PRNG test vectors
