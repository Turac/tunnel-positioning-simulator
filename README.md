# Through the Tunnel

Simulator and evaluation harness for estimating a car's position while GNSS is unavailable
inside a road tunnel.

> Status: work in progress (Phase 0 — scaffolding).

## What this is

A controlled simulation that generates a car's true motion through a single-lane tunnel,
the sensor data a phone would record, and several position estimators. An evaluation
harness measures how each estimator performs, where it breaks, and why.

It makes no claim about accuracy on real devices; see `docs/ASSUMPTIONS.md`.

## Getting started

_To be completed once the project is scaffolded._

```bash
npm install
npm run dev     # start the simulator
npm test        # run tests
```

## Repository layout

See `CLAUDE.md` for the architecture and conventions.

## Documentation

- `docs/ASSUMPTIONS.md` — every modelling assumption, with IDs
- `docs/decisions/` — architecture decision records
- `docs/ai-log.md` — how AI tools were used and where they were corrected
