# AI usage log

Running record of how AI tools were used, and where their output was corrected, rejected or
changed. Source material for the final AI usage note.

Format: date · tool · topic · AI proposal · decision · reason.

---

### 2026-10-24 · Claude (chat) and ChatGPT · Problem framing and scope

- **AI proposal:** Claude's first plan included a particle filter on the road graph, BLE beacon
  aiding and map-feature matching in the core scope.
- **Decision:** Moved these to stretch goals / future work. Core scope is baselines plus a
  small Kalman filter with stop detection and grade compensation.
- **Reason:** Every component in the core must be explainable in depth during the interview;
  a smaller, well-measured core is stronger than a broad, shallow one.

### 2026-10-24 · ChatGPT, reviewed with Claude · Role of the Kalman filter

- **AI proposal:** ChatGPT suggested pure IMU dead reckoning with a bias term as the main
  method and a Kalman filter as an optional middle ground.
- **Decision:** The Kalman filter is the main method; pure integration stays as an
  intermediate step for comparison.
- **Reason:** The bias term must be estimated before the tunnel while GNSS is available;
  estimating it is the filter's main job. Without that, the bias is unknown and the method
  is a strawman.

### 2026-10-24 · ChatGPT, reviewed with Claude · Missing physical effects

- **AI proposal:** Four scenarios (basic, long, speed change, bad sensor) with no road grade
  and no explicit stop handling.
- **Decision:** Added a graded tunnel scenario, grade compensation and stop detection (ZUPT)
  to the core.
- **Reason:** On a 4 % slope gravity leaks about 0.39 m/s² into the longitudinal axis, which
  dominates sensor bias. Stop-and-go traffic cannot be handled by integration alone.

### 2026-10-24 · ChatGPT, reviewed with Claude · Exit announcement metric

- **AI proposal:** Test that the announcement fires when the exit point is passed.
- **Decision:** Announcements fire at lead distances before the exit (A-40); the metric is
  the true remaining distance and time when the estimate says the lead distance is reached.
- **Reason:** Navigation apps announce exits ahead of time; firing at the exit is too late.

### 2026-10-24 · Claude Code · TypeScript version pin

- **AI proposal:** Install the latest stable version of all tooling.
- **Decision:** Pin TypeScript to `~6.0.3` instead of the latest 7.0.2.
- **Reason:** typescript-eslint 8.72 supports TypeScript `<6.1.0` only, and the
  module-boundary lint rules (CLAUDE.md rule 1) depend on it. Upgrade when support lands.

### 2026-10-24 · Claude Code · Linter: ESLint instead of the template's oxlint

- **AI proposal:** The current `create-vite` React + TypeScript template ships oxlint
  instead of ESLint; Claude flagged this and recommended keeping ESLint.
- **Decision:** Keep ESLint; do not adopt oxlint or `.oxlintrc.json`.
- **Reason:** Boundary enforcement relies on ESLint's built-in `no-restricted-imports` with
  per-directory overrides, and on ESLint's Node API to prove the rules fire in a test.
  Lint speed is not a concern at this project size.

### 2026-10-24 · Claude Code · Plan restructure: core and extensions

- **AI proposal:** Seven sequential phases (0–6) with an unordered "stretch" list
  (BLE beacons, exit-branch hypotheses, multiple cars) to attempt after Phase 6.
- **Decision:** Four core phases (0–3) that are complete and deliverable on their own,
  plus eleven extensions (E1–E11) ordered by value. Each extension gets its own branch,
  ADR and before/after results comparison. Five simple extension points (new sensor,
  estimator, error term, scenario, metric) are defined, and adding an extension must not
  change the results of existing scenarios and seeds.
- **Reason:** A self-contained core guarantees a complete deliverable regardless of how
  many extensions are added. Ordering extensions by value and requiring a measured
  before/after comparison keeps every addition justified and explainable.

### 2026-10-24 · Claude Code · Module-boundary lint rules and their proof test

- **AI proposal:** Beyond the approved plan, also ban the `Date` and `performance` globals
  (not only `Date.now` / `performance.now`), `globalThis` (closes the
  `globalThis.Math.random` bypass) and dynamic `import()` (invisible to
  `no-restricted-imports`) in `src/core`, and use ESLint's `defineConfig()` instead of the
  deprecated `tseslint.config()`.
- **Decision:** All four approved.
- **Verification (mutation check):** Each rule was deliberately broken in turn (truth
  isolation patterns removed, `Math.random` rule weakened, estimators file glob broken) and
  the boundary test was run: 4, 2 and 4 tests failed respectively. The config was then
  restored and checked byte-for-byte against a backup.
- **Reason:** A test that has never been seen failing may be always-green. The mutation
  check shows the boundary test actually detects a weakened rule.
