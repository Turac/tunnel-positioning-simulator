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

### 2026-10-24 · Claude Code · PRNG reference test vectors

- **AI proposal:** Verify the xoshiro128** port against "the reference C implementation's"
  first outputs, without saying where those expected values would come from; then, after a
  first correction, write the reference C code and compile it. Seed the generator with
  splitmix32.
- **Decision:** (1) Expected values must not be written from memory. (2) The C reference
  must not be written from memory either: if both the C and the TypeScript came from the
  AI's recollection, a shared mistake would make the test pass. Download the official files
  from the authors' site (prng.di.unimi.it: `xoshiro128starstar.c` version 1.1, the `f2x.c`
  it includes, and `splitmix64.c`, which redirects to `splitmix.c`), record URLs and
  SHA-256 hashes, compile them unmodified with a separate harness that only adds `main()`,
  and use that output as the expected values; stop if the download fails. (3) Use
  SplitMix64 instead of splitmix32 for seeding, because splitmix32 has no official reference
  from the authors. The sources, harnesses and expected output are kept in
  `tests/reference/`. The project author recomputed all values independently.
- **Reason:** A known-answer test only proves correctness if its answers come from an
  independent, verifiable source.

### 2026-10-24 · Claude Code · Named stream derivation

- **AI proposal:** Derive stream seeds by hashing stream names with FNV-1a, mixing with
  the seed, and reducing to a 32-bit seed.
- **Decision:** No hash. A permanent, append-only table maps each independent random
  source to an integer ID. Each stream's xoshiro128** state is filled directly by
  SplitMix64 initialised with `(streamId << 32) | seed`, split low-then-high like
  `createRng`, with no reduction to 32 bits. Verified with the existing official
  SplitMix64 harness.
- **Human proposal corrected by AI:** The project author first proposed
  `(seed << 32) | streamId`, based on their own research and a separate chat discussion
  with Claude, claiming every stream input would be ≥ 2^32. Before implementing, Claude
  Code found that this fails for seed 0: `(0 << 32) | 1 = 1`, so stream 1 with seed 0
  would reproduce `createRng(1)`. The fields were swapped: with IDs starting at 1, every
  stream input is ≥ 2^32 and every plain seed is < 2^32, for all seeds including 0.
- **Reason:** Reusing the already verified SplitMix64 avoids a second reference source.
- **Lesson:** Check boundary values (0 and the maximum), and review AI suggestions and
  your own proposals with the same care.
- **Mutation check:** Seven deliberate breakages were tried. Six failed at least one test.
  The seventh, removing the unknown-stream-name guard, survived: an unknown name maps to
  an `undefined` ID, which the ID validation already rejects with a `RangeError`, so the
  guard only improves the error message. The guard was kept, because a clear
  "Unknown stream" message helps when a stream name is mistyped, and the test now checks
  the message, so the mutant is killed.

### 2026-10-25 · Claude Code · Phase 1 plan review: map vs. truth separation

- **AI proposal:** Claude Code's Phase 1 plan placed tunnel geometry, exit position and
  grade profile in `src/core/world/`, which estimators are forbidden to import.
- **Decision:** Introduce a neutral `src/core/map/` module that both `world/` and estimators
  can import, and extend the lint rules and boundary tests accordingly.
- **Reason:** Estimators legitimately need this map data (exit announcement, grade
  correction, GNSS gating near the tunnel end). Placing it under `world/` would conflict
  with the import restrictions that isolate ground truth.
- **Process:** The project author does not approve plans directly but reviews them. The
  author raised this concern, discussed it and the proposed separation with another AI
  model, which agreed the approach was reasonable, and then asked Claude Code to make the
  change.

### GNSS: converting the published accuracy into a model parameter

- Claude Code took the published smartphone accuracy (4.9 m radius, open sky, GPS.gov), treated it as a 95% horizontal radius and converted it to a per-axis standard deviation: 4.9 / 2.45 ≈ 2.0 m.
- The 95% interpretation is not stated in the source; this is recorded as an assumption.

### GNSS: values without a source are marked, not invented

- No published values were found for the error correlation time (60 s), the extra error after reacquisition (20 m, decaying over 10 s) or how optimistic the receiver's reported accuracy is (0.5).
- Claude Code marked these as our own choices in ASSUMPTIONS.md instead of presenting them as sourced.

### GNSS: when the first fix after the tunnel is published

- In review (second model) an edge case was found: at the moment the car leaves the tunnel it is exactly at the portal, which still counts as inside. With a zero reacquisition delay the time rule and the position rule would contradict each other.
- Rule adopted: a fix is published only when the car is outside the tunnel AND the reacquisition delay has passed.

### 2026-10-25 · Claude Code · Phase 2 plan review

- **Ranking of the methods:** Claude Code assumed the order A2, then A1, then B0. The project author asked to read the order from the results table instead. A1 is probably the worst, because it does not correct the sensor bias: a small bias of 0.1 m/s² grows into kilometres of position error in 250 s.
- **When GNSS returns after the tunnel:** if the filter rejects 3 GNSS fixes in a row, Claude Code proposed moving the position directly to the GNSS position. The project author rejected this: just after the exit the GNSS fix itself can be about 15 m wrong. Instead, the filter increases its own uncertainty and then accepts the fix with normal weighting.
- **Which scenarios are used for tuning:** the poor-sensor scenario is not used. It tests errors the filter does not know about; tuning on it would hide the problem.
- **Number of runs:** 200 for the report set, 50 for the tuning set (Claude Code proposed 50 for both).
- **Limitation of stop detection (ZUPT):** its threshold comes from the simulator's own vibration formula, so ZUPT results are optimistic compared with a real phone.

### 2026-10-25 · Claude Code · ZUPT overconfidence found in stop-and-go

- Found by: Claude Code, while running the new stop-and-go scenario. A2 error was always ~60–70 m and ±2σ coverage was ~0.
- Root cause (Claude Code): the ZUPT told the filter "speed is exactly 0 (σ = 0.05 m/s)" at every accel sample (100 Hz). The detector cannot tell a stopped car from one crawling below ~1 m/s, so the filter trusted a wrong zero, pushed the difference into the bias estimate, and became overconfident.
- Claude Code proposed: a 1 s hold time before ZUPT applies. Small gain (60–73 m → 54–67 m); it does not address the overconfidence.
- Project author discussed with a separate AI chat (Claude) and accepted: ZUPT σ = 0.5 m/s (only what the detector actually knows), applied at most once per second, plus the 1 s hold.
- Result (A2, seeds 1–3, before tuning): stop-and-go exit error 73.2 / 63.0 / 87.0 m, max error in tunnel 73.2 / 63.0 / 87.0 m, coverage 0.45 / 0.41 / 0.49 (before the fix: 0.08 / 0.01 / 0.17). Long (no stops, unchanged by the fix): exit error 128.0 / 103.8 / 203.3 m, max error 128.0 / 103.8 / 203.3 m, coverage 0.96 / 0.83 / 0.85.
- Recorded in ADR-0015, superseding ADR-0014.
