# Assumptions

Every assumption has an ID. Code that depends on an assumption references its ID.
Status: **fixed** (given by the task), **chosen** (our decision, justified), **draft**
(placeholder value, to be finalised in the phase noted).

Changing a value requires updating this file in the same commit.

## Task constraints (given)

| ID | Assumption | Status |
|---|---|---|
| A-01 | Each tunnel has a single lane. | fixed |
| A-02 | Tunnel length is between 500 m and 5 km. | fixed |
| A-03 | GNSS is unusable inside the tunnel for up to a few minutes. | fixed |
| A-04 | The navigation app must announce an exit located inside the tunnel. | fixed |
| A-05 | Any sensor available on a modern smartphone may be used. | fixed |

## World and map

| ID | Assumption | Value | Rationale | Status |
|---|---|---|---|---|
| A-10 | The tunnel centerline geometry is known from the navigation map. | — | Turn-by-turn navigation already requires the road geometry. | chosen |
| A-11 | Position is represented as distance `s` along the centerline. | `s = 0` at entrance | Single lane (A-01) makes lateral position irrelevant; reduces the problem to 1D. See ADR-0002. | chosen |
| A-12 | The tunnel's grade (slope) profile is known from map data. | — | Navigation maps commonly carry elevation attributes. Needed to remove the gravity component from longitudinal acceleration. | chosen |
| A-13 | The driver follows the planned route; the route is known. | — | Standard navigation assumption. | chosen |
| A-14 | The exit position inside the tunnel is known from the map. | — | Required to announce it. | chosen |
| A-15 | Typical free-flow speed in tunnels. | 60–80 km/h | Common urban/highway tunnel speed limits. Not used by the Phase 1 code; finalised with a source when the Phase 2 scenarios are written. | draft (Phase 2) |
| A-16 | Open-sky road before the tunnel entrance (approach), `s ∈ [−L_pre, 0)`. | default `L_pre` = 2000 m, adjustable per scenario | Gives the estimator a GNSS-aided stretch (~100 s at 72 km/h) to learn the accelerometer bias before GNSS is lost. Our choice; revisited in Phase 2 against the filter's bias convergence time. See ADR-0007. | chosen |
| A-17 | Road after the exit portal (departure), `s ∈ (L, L + L_post]`. | default `L_post` = 1000 m, adjustable per scenario | Long enough to observe GNSS reacquisition and the decay of inflated error after the exit (A-26). Our choice; checked once the GNSS reacquisition parameters are set. See ADR-0007. | chosen |
| A-18 | Grade profile: keypoints in `s`, linearly interpolated, covering the whole road. Grade is rise over run, positive uphill in the direction of increasing `s`. | default scenarios: \|grade\| ≤ 5 %; the map accepts any \|grade\| < 1 | Roads change grade gradually (vertical curves); linear interpolation is the simplest continuous model, and a step in grade would put a non-physical step into the accelerometer signal. Directive 2004/54/EC, Annex I, 2.2.2: "Longitudinal gradients above 5 % shall not be permitted in new tunnels, unless no other solution is geographically possible" (2.2.3: extra measures above 3 %). Steeper tunnels exist, so the map does not reject them; \|grade\| ≥ 1 is rejected as a likely percent-for-fraction typo. Source text read from the directive as published at legislation.gov.uk/eudr/2004/54/annex/I. See ADR-0007. | chosen |
| A-19 | True speed profile: time–speed keypoints from `t = 0`, speed linear between keypoints (piecewise-constant acceleration), distance in closed form. Acceleration is right-continuous; at the final keypoint it is the last segment's slope. Queries outside `[0, t_end]` are errors. | `0 ≤ v ≤ 50 m/s` (180 km/h); no acceleration limit | Exact integration keeps numerical error out of the ground truth, so every metre of measured error belongs to the estimator. The 50 m/s limit catches km/h typed as m/s (80 km/h as 80 m/s); km/h values below 50 are not caught. No acceleration limit, so hard-braking scenarios (beyond 1 g) stay possible. | chosen |

## Phone and sensors

| ID | Assumption | Value | Rationale | Status |
|---|---|---|---|---|
| A-20 | The phone is rigidly mounted in the car for the whole drive. | — | Typical navigation usage. Violated deliberately in extension E6. | chosen |
| A-21 | The phone's orientation relative to the car is calibrated before the tunnel; the simulator provides longitudinal (forward) acceleration with a configurable residual mount misalignment. | default 0°, scenario up to ~5° | Keeps the first version simple; misalignment is then varied to show its effect. | chosen |
| A-22 | IMU sample rate. | 100 Hz | Within the range phones commonly deliver; exact rate varies per device and OS. | draft (Phase 1) |
| A-23 | Accelerometer errors: white noise (incl. vehicle vibration), constant bias, slow bias drift. | values TBD | Consumer MEMS sensors are not navigation-grade. | draft (Phase 1) |
| A-24 | GNSS fix rate. | 1 Hz | Typical location update rate for navigation. | draft (Phase 1) |
| A-25 | GNSS error in open sky (position and speed). | values TBD | Will be set from published smartphone figures. | draft (Phase 1) |
| A-26 | GNSS is lost inside the tunnel and returns after the exit with a reacquisition delay and inflated error on the first fixes. Gradual degradation at the portal and stale fixes are extension E3. | values TBD | Real receivers do not switch off cleanly. | draft (Phase 1) |
| A-27 | Magnetometer is not used. | — | Tunnel reinforcement and vehicle electronics distort magnetic readings. | chosen |
| A-28 | Cellular / Wi-Fi positioning is not used. | — | Too coarse for along-tunnel position; tunnels often use repeaters. | chosen |
| A-29 | Vehicle speed from OBD or the car is not assumed. | — | Not available to every user; may be discussed as future work. | chosen |

## Evaluation

| ID | Assumption | Value | Rationale | Status |
|---|---|---|---|---|
| A-40 | Exit announcements are made at fixed lead distances before the exit. | TBD (e.g. 400 m and 100 m) | Demo threshold chosen by us, not a product requirement. | draft (Phase 2) |
| A-41 | Acceptance thresholds for errors are demo thresholds, labelled as our choice. | TBD | No product threshold is given in the task. | draft (Phase 2) |
| A-42 | Results are reported over multiple seeds as median / P95 / max. | ≥ 50 seeds | Single runs hide variance. | chosen |
