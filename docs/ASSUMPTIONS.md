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
| A-15 | Free-flow speed in the tunnel, used by the scenarios. | 70 km/h (70 / 3.6 ≈ 19.44 m/s) | Mont Blanc Tunnel (single bore, 11.6 km): minimum 50 km/h, maximum 70 km/h (en.wikipedia.org, Mont Blanc Tunnel; the 50 km/h minimum is confirmed by Bison Futé, bison-fute.gouv.fr). One tunnel, not a survey; driving at the limit is our choice. | chosen |
| A-16 | Open-sky road before the tunnel entrance (approach), `s ∈ [−L_pre, 0)`. | default `L_pre` = 2000 m, adjustable per scenario | Gives the estimator a GNSS-aided stretch (~100 s at 72 km/h) to learn the accelerometer bias before GNSS is lost. Our choice; revisited in Phase 2 against the filter's bias convergence time. See ADR-0007. | chosen |
| A-17 | Road after the exit portal (departure), `s ∈ (L, L + L_post]`. | default `L_post` = 1000 m, adjustable per scenario | Long enough to observe GNSS reacquisition and the decay of inflated error after the exit (A-26). Our choice; checked once the GNSS reacquisition parameters are set. See ADR-0007. | chosen |
| A-18 | Grade profile: keypoints in `s`, linearly interpolated, covering the whole road. Grade is rise over run, positive uphill in the direction of increasing `s`. | default scenarios: \|grade\| ≤ 5 %; the map accepts any \|grade\| < 1 | Roads change grade gradually (vertical curves); linear interpolation is the simplest continuous model, and a step in grade would put a non-physical step into the accelerometer signal. Directive 2004/54/EC, Annex I, 2.2.2: "Longitudinal gradients above 5 % shall not be permitted in new tunnels, unless no other solution is geographically possible" (2.2.3: extra measures above 3 %). Steeper tunnels exist, so the map does not reject them; \|grade\| ≥ 1 is rejected as a likely percent-for-fraction typo. Source text read from the directive as published at legislation.gov.uk/eudr/2004/54/annex/I. See ADR-0007. | chosen |
| A-19 | True speed profile: time–speed keypoints from `t = 0`, speed linear between keypoints (piecewise-constant acceleration), distance in closed form. Acceleration is right-continuous; at the final keypoint it is the last segment's slope. Queries outside `[0, t_end]` are errors. | `0 ≤ v ≤ 50 m/s` (180 km/h); no acceleration limit | Exact integration keeps numerical error out of the ground truth, so every metre of measured error belongs to the estimator. The 50 m/s limit catches km/h typed as m/s (80 km/h as 80 m/s); km/h values below 50 are not caught. No acceleration limit, so hard-braking scenarios (beyond 1 g) stay possible. See ADR-0008. | chosen |

## Phone and sensors

| ID | Assumption | Value | Rationale | Status |
|---|---|---|---|---|
| A-20 | The phone is rigidly mounted in the car for the whole drive. | — | Typical navigation usage. Violated deliberately in extension E6. | chosen |
| A-21 | The phone's orientation relative to the car is calibrated before the tunnel; the simulator provides longitudinal (forward) acceleration with a configurable residual mount misalignment. | default 0°, scenario up to ~5° | Keeps the first version simple; misalignment is then varied to show its effect. | chosen |
| A-22 | IMU sample rate. | 100 Hz | Apple Core Motion: the maximum accelerometer rate "is hardware-dependent but is usually at least 100 Hz" (developer.apple.com, Getting raw accelerometer events). See ADR-0009. | chosen |
| A-23 | Accelerometer sensor white noise and turn-on bias. | noise density 160 µg/√Hz → sample σ = 160·10⁻⁶ · 9.80665 · √(100/2) ≈ 0.0111 m/s² at 100 Hz; turn-on bias b0 ~ N(0, 10 mg ≈ 0.098 m/s²), one draw per run | Bosch BMI270 (a common phone IMU): noise density 160 µg/√Hz, zero-g offset ±20 mg (bosch-sensortec.com, BMI270 product page). σ = density · √BW with BW ≈ fs/2 (anti-aliasing at Nyquist). The ±20 mg is the datasheet zero-g offset over lifetime, an upper bound, taken as 2σ; it is not the residual bias after calibration. No OS calibration is assumed, so b0 is datasheet-scale and the estimator must learn it before the tunnel; what remains after that is the residual bias. Vehicle vibration is a separate term (A-32). See ADR-0009. | chosen |
| A-24 | GNSS fix rate. | 1 Hz | Google Smartphone Decimeter Challenge 2021 (developer.android.com): phone GNSS measurements logged "at 1Hz". See ADR-0010. | chosen |
| A-25 | GNSS error in open sky: along-track position error is a first-order Gauss–Markov process (correlation time A-34); speed error is white (A-35). The `s` reported is the map-matched along-track projection of the fix (A-10, A-11). | position σ = 2.0 m | GPS.gov: smartphones are "typically accurate to within a 4.9 m (16 ft.) radius under open sky". Treated as a 95 % horizontal radius and converted to a per-axis σ: 4.9 / 2.45 ≈ 2.0 m (Rayleigh 95 % radius = 2.45 σ). The 95 % interpretation is not stated in the source; it is our assumption. See ADR-0010. | chosen |
| A-26 | GNSS is lost inside the tunnel and returns after the exit with a reacquisition delay and inflated error on the first fixes. A fix is published only before the tunnel (`s < 0`) or when the car is outside the tunnel (`s > L`) AND the delay since the exit time has passed. Error draws continue on the fixed grid inside the tunnel; the tunnel only blocks publication. Gradual degradation at the portal and stale fixes are extension E3. | see A-36, A-37 | At the exit time the car is still at the portal, which counts as inside (ADR-0008); with a zero delay, a time rule alone would contradict the position rule. See ADR-0010. | chosen |
| A-27 | Magnetometer is not used. | — | Tunnel reinforcement and vehicle electronics distort magnetic readings. | chosen |
| A-28 | Cellular / Wi-Fi positioning is not used. | — | Too coarse for along-tunnel position; tunnels often use repeaters. | chosen |
| A-29 | Vehicle speed from OBD or the car is not assumed. | — | Not available to every user; may be discussed as future work. | chosen |
| A-30 | Gravity is the standard acceleration of gravity. | g = 9.80665 m/s² (exact) | NIST CODATA, standard acceleration of gravity g_n. Local gravity varies (roughly 9.78–9.83 m/s²); with standard g in both simulator and estimator the difference on a 4 % grade is about 0.001 m/s², far below the bias. A local-gravity error term could be added later, off by default. | chosen |
| A-31 | Accelerometer bias drift is a random walk. | q = 8.0·10⁻⁸ (m/s²)²/s, increment variance q·Δt; σ ≈ 0.0049 m/s² after 300 s | BMI270 zero-g offset temperature drift ±0.25 mg/K (Bosch, BMI270 product page) times an assumed 2 K temperature change over 300 s: (0.5 mg · 9.80665)² / 300 s. The 2 K is our assumption. A random walk needs one parameter; the datasheet gives no correlation time for a Gauss–Markov model. | chosen |
| A-32 | Vehicle vibration is a sinusoid with speed-dependent amplitude: n = √2 · σ(v) · sin(2π f t + φ), φ drawn once per run. | σ(v) = 0.2 + 0.03 · v m/s² (RMS; 0.20 standing, 0.80 at 20 m/s); f = 25 Hz | Range: fore-aft r.m.s. 0.213–1.087 m/s² from idling to driving (Picu et al., WSEAS 2010; bus driver's seat, ISO 2631 weighted), so it is an order-of-magnitude source, not a phone-mount measurement. Linear shape is the simplest continuous fit; at creep speed (0.5 m/s, σ = 0.215) vibration is close to idle, so stop detection can be fooled. f: second-order vibration of a four-cylinder engine at 750 rpm idle is 25 Hz (US 9 982 721), below the 50 Hz Nyquist limit. A sinusoid has zero mean, so its integral stays bounded; white noise of the same σ would integrate into a rate-dependent random walk. | chosen |
| A-33 | Accelerometer scale-factor error, an off-by-default term. | default 0; e.g. 0.4 % in a scenario | BMI270 sensitivity error ±0.4 % (Bosch, BMI270 product page). | chosen |
| A-34 | Correlation time of the open-sky position error. | τ = 60 s | **No source found; our choice.** Smartphone GNSS errors are known to be time-correlated, but no published correlation time was found. Candidate for the sensitivity analysis (E5). | chosen (no source) |
| A-35 | GNSS speed error σ; reported speed is clamped to ≥ 0. | 0.5 m/s | Smartphone apps measured against a differential GNSS reference on ski slopes: mean speed error below 1.9 km/h ≈ 0.5 m/s (PMC12349078). Receivers report speed ≥ 0; the clamp slightly biases the reading near a stop, which is left to the estimator. | chosen |
| A-36 | Reacquisition delay after the exit, drawn once per run. | d ~ U(1 s, 20 s) | UNECE vehicle regulation clause: reacquisition after a 60 s block-out "shall not exceed 20 s" (an upper limit, not a typical value). Lower bound: one fix interval. | chosen |
| A-37 | Extra position error after reacquisition, decaying with time since reacquisition: σ_extra = σ_r · exp(−(t − t_reacq)/τ_r), white per fix. | σ_r = 20 m, τ_r = 10 s | **No source found; our choice.** The decay starts at the first fix (t_reacq = t_exit + d) because the receiver converges from then on. Candidate for E5. | chosen (no source) |
| A-38 | Receiver-reported accuracy: reportedSigma = √((κ_open · σ)² + (κ_reacq · σ_extra)²), reportedSpeedSigma = κ_open · σ_speed. | κ_open = 1, κ_reacq = 0.5 | κ_open = 1 is an **optimistic simplification**: real receivers can misreport accuracy in open sky too. κ_reacq = 0.5 (the receiver understates the extra error after reacquisition): **no source found; our choice.** | chosen (κ_reacq: no source) |

## Evaluation

| ID | Assumption | Value | Rationale | Status |
|---|---|---|---|---|
| A-40 | Exit announcements are made at fixed lead distances before the exit, triggered when the estimate reaches the announcement point. | 400 m and 100 m | **Our choice**, not a product requirement: one early notice and one final notice before the turn. See ADR-0012. | chosen |
| A-41 | Recovery threshold after the tunnel: the estimate counts as recovered once its position error stays below this value to the end of the run. | 5 m | **Our choice**, a demo threshold: slightly above the open-sky GNSS 2σ (2 × 2.0 m, A-25), so a recovered estimate is about as good as GNSS. No product threshold is given in the task. See ADR-0012. | chosen |
| A-42 | Results are reported over multiple seeds as median / P95 / max. | ≥ 50 seeds | Single runs hide variance. | chosen |

## Estimators

The estimators' own sensor model (`src/core/estimators/sensor-model.ts`). Values come from
datasheets and stated assumptions, never from the simulator's config; they match the
simulator's defaults only where both use the same source.

| ID | Assumption | Value | Rationale | Status |
|---|---|---|---|---|
| A-50 | Accelerometer white noise density assumed by the estimators. | 160 µg/√Hz; velocity random-walk intensity ND²/2 ≈ 1.23·10⁻⁶ (m/s²)²·s | Same datasheet as A-23 (Bosch BMI270). A sample σ of ND·√(fs/2) integrated over Δt = 1/fs adds ND²/2 per second to the speed variance, independent of the rate. | chosen |
| A-51 | Prior 1σ of the constant accelerometer offset. | √((10 mg)² + (g·sin 5° / 2)²) ≈ 0.44 m/s² | Turn-on bias 10 mg (datasheet ±20 mg as 2σ, A-23) plus the offset g·sin δ of a residual mount misalignment up to 5° (A-21) taken as 2σ; on a flat road a misalignment looks like a constant bias. A1 does not estimate it, so its position σ grows with ½·0.44·Δt². | chosen |
| A-52 | Bias random-walk intensity assumed by the Kalman filter. | 8.0·10⁻⁸ (m/s²)²/s | Same source as A-31 (BMI270 temperature drift ±0.25 mg/K, 2 K assumed over 300 s). | chosen |
| A-53 | Extra velocity random-walk intensity in the Kalman filter for unmodelled effects (vibration residual, scale factor, misalignment on acceleration). The filter treats vibration as zero-mean and high-frequency, so it does not enter Q as white noise. | 0 until tuned | Tuned on the tuning seeds of baseline, long, stop-and-go and graded only, for in-tunnel coverage close to 95 %. poor-sensor is a model-mismatch case and is not used for tuning. | draft (tuning) |
| A-54 | Scale on the reported GNSS position σ in the Kalman filter's R. | 1 until tuned | The GNSS position error is time-correlated (τ = 60 s, A-34), but the filter treats fixes as independent, so it becomes over-confident about bias and position. A scale > 1 is the simplest compensation; tuned with A-53 on the same seeds. | draft (tuning) |
| A-55 | GNSS innovation gate and the rule against permanent rejection. | χ²₁ at 99 % = 6.63 per scalar update (position and speed gated separately); after 3 consecutive rejected position fixes, P_ss ← max(P_ss, ν²/6.63 − R), then the normal update | **Our choice.** Separate scalar tests, so the 1-degree-of-freedom threshold applies (9.21 would be the joint 2-DOF value). Widening P_ss to the last rejected innovation puts it exactly at the gate, so the fix is accepted with the filter's own weight, not adopted; the counter restarts after an accepted fix. | chosen |
