# Through the Tunnel: evaluation report

All numbers in this report come from [`results/eval-report.md`](results/eval-report.md),
the output of `npm run eval` on the report seed set. This is a controlled simulation for
studying assumptions and failure modes. It makes no claim about accuracy on real devices.

## 1. Problem

A navigation app loses GNSS inside a road tunnel (500 m – 5 km, single lane) but still has
to say where the car is, and announce an exit that lies inside the tunnel "in 400 m" and
"in 100 m". The phone has an accelerometer, and the map gives the tunnel geometry, the exit
position and the grade profile. The question is how well each estimator tracks the
position along the tunnel, how well it knows its own uncertainty, and where it fails.

## 2. Approach

- **One dimension.** Each tunnel has a single lane and the route and map are known, so the
  car's position is its distance `s` along the centerline (ADR-0002, A-01, A-10, A-11). The
  question becomes "how far has the car travelled?", which means estimating speed well.
- **A Kalman filter with a bias state.** The accelerometer's bias is unknown, and
  integrating it turns it into a position error that grows with t²: 0.1 m/s² over 250 s is
  about 3 km by ½·b·t². The bias can only be learned while GNSS is still available, so the
  filter carries it as a state and estimates it on the approach (ADR-0013).
- **Grade correction from the map.** On a 4 % slope gravity puts about 0.39 m/s² into the
  forward axis, four times the typical turn-on bias. The map's grade profile removes it
  (A-12, ADR-0013).
- **Zero-velocity updates.** Integration alone cannot tell a stop from slow driving. When
  the accelerometer is quiet, the filter is told the car is nearly still, which also makes
  the bias observable during a stop (ADR-0014, ADR-0015).
- **A gated GNSS return.** The first fixes after the exit can be tens of metres wrong while
  the receiver reports them as good (A-37, A-38). Resetting to the first fix would copy that
  error. Instead each fix is tested against the filter's own uncertainty. After three
  rejected fixes in a row the filter widens its own uncertainty enough to accept the fix,
  so it never ignores GNSS for good (ADR-0013, A-55).

Considered but not built. The first three were in an early plan and were moved out of the
core so that it stays small and well measured (ai-log, problem framing and scope); the
barometer is a planned extension (E9):

- **Particle filter:** for a three-state, one-dimensional problem whose only nonlinearity
  is the grade, the extended Kalman filter's Jacobian covers it (ADR-0013).
- **Map matching:** inside a single-lane tunnel there are no turns or junctions to match
  against. Matching the grade profile is listed as extension E9.
- **BLE beacons:** they need roadside infrastructure in every tunnel. Listed as extension
  E7.
- **Barometer:** could observe the grade, but adds a sensor model and its own errors.
  Listed with grade-profile matching as extension E9.

## 3. Setup

- **Simulated sensors.** A 100 Hz accelerometer with white noise, turn-on bias, bias drift,
  speed-dependent vibration, gravity leakage on grades and optional mounting and scale
  errors (ADR-0009, A-22 to A-33). 1 Hz GNSS with time-correlated error, lost in the
  tunnel, returning after a random delay with inflated error, and an optional position
  jump (ADR-0010, A-24 to A-39). The simulator models error sources that the estimators do
  not, on purpose.
- **Scenarios** (A-44). baseline: 1 km flat, constant 70 km/h, exit at 600 m. long: 5 km
  flat, exit at 4000 m. stop-and-go: 2 km flat with a stop and a slow crawl, exit at
  1500 m. graded: 2 km at +4 % then −2 %, constant 70 km/h, exit at 1500 m. poor-sensor:
  2 km flat, constant 70 km/h, exit at 1500 m, with a much worse accelerometer and a 30 m
  GNSS jump after the exit.
- **Estimators** (ADR-0011). They see only the map and the measurements.
  - **B0**: keeps the speed of the last GNSS fix.
  - **A1**: integrates the accelerometer with gravity removed using the map grade; no bias
    estimate.
  - **A2**: Kalman filter on position, speed and accelerometer bias, with grade
    compensation, gated GNSS updates and zero-velocity updates at stops (ADR-0013 to
    ADR-0015, tuning in ADR-0017).
- **Visual simulator** (`npm run dev`, ADR-0019). It runs one scenario and seed through the
  same code as the evaluation and shows the true car against each estimate with its ±2σ
  band, the position error, the sensor data and the run's metrics, with live changes to
  tunnel length, accelerometer bias and grade.

## 4. Key assumptions

The full list, with sources, is in [`ASSUMPTIONS.md`](ASSUMPTIONS.md). Sourced means a
published value; our choice means no source was found; simplification means a deliberate
idealisation.

| Assumption | Value | Basis | ID |
|---|---|---|---|
| Map, grade profile and exit position are known | from the navigation map | simplification | A-10, A-12, A-14 |
| Phone rigidly mounted, orientation calibrated before the tunnel | residual misalignment 0°, 2° in poor-sensor | simplification | A-20, A-21 |
| Free-flow speed in the tunnel | 70 km/h | sourced (one tunnel's limit); driving at the limit is our choice | A-15 |
| Accelerometer noise and turn-on bias | 160 µg/√Hz; bias σ 10 mg, one draw per run | sourced (Bosch BMI270 datasheet) | A-23 |
| Accelerometer bias drift | random walk, about 0.005 m/s² after 300 s | sourced drift rate; the 2 K temperature change is our choice | A-31 |
| GNSS error in open sky | σ 2.0 m, correlated over 60 s | σ sourced (GPS.gov, read as a 95 % radius); correlation time our choice | A-25, A-34 |
| GNSS return after the exit | delay 1–20 s; extra error 20 m decaying over 10 s | delay bound sourced (UNECE limit); extra error our choice | A-36, A-37 |
| Receiver-reported accuracy after the exit | understates the extra error by half | our choice | A-38 |
| Stop-detection (ZUPT) threshold | 0.23 m/s², about 1 m/s | our choice, derived from the simulator's own vibration law | A-56 |
| Exit announcement distances | 400 m and 100 m before the exit | our choice | A-40 |

## 5. Method

- **Seeds.** A2 was tuned on the tuning seeds (1, 2, …; poor-sensor excluded). Every
  number here comes from the disjoint report seeds 1 000 001 – 1 000 200: 200 runs per
  scenario, each method run on the same simulated drives (A-43, ADR-0016).
- **Metrics** (ADR-0012). Exit error is |ŝ − s| when the car leaves the tunnel.
  Announcement errors are measured in metres and seconds: negative means early, positive
  late. ±2σ coverage is the fraction of in-tunnel time in which the true position lies
  inside the method's own ±2σ band. A well-calibrated method covers about 0.95. Recovery
  is the time from the first fix after the exit until the error stays below 5 m (A-41).
- **Summaries.** Cells are median / P95 over the runs. Coverage is mean / P10, because the
  median and P95 of a fraction bounded by 1 hide over-confident runs (ADR-0018).

## 6. Results

Exit error, 100 m announcement timing and ±2σ coverage. The full table, with the 400 m
announcement, return jump and recovery, is in the results file.

| Scenario | Method | Exit error (m) | Ann. 100 m (s) | ±2σ coverage (mean / P10) |
|---|---|---|---|---|
| baseline | B0 | 17.4 / 49.8 | -0.07 / 1.14 | 0.95 / 1.00 |
| | A1 | 86.7 / 249.3 | -0.26 / 4.27 | 1.00 / 1.00 |
| | A2 | 4.6 / 12.3 | 0.00 / 0.28 | 0.95 / 0.87 |
| long | B0 | 85.8 / 239.9 | -0.54 / 8.42 | 0.96 / 1.00 |
| | A1 | 2186.4 / 6126.6 | -5.71 / 75.58 | 1.00 / 1.00 |
| | A2 | 69.3 / 188.4 | 0.28 / 5.16 | 0.98 / 0.97 |
| stop-and-go | B0 | 1660.5 / 1805.7 | -85.09 / -81.80 | 0.05 / 0.05 |
| | A1 | 1155.1 / 3250.2 | -3.47 / 50.25 | 1.00 / 1.00 |
| | A2 | 70.3 / 88.8 | 2.57 / 3.06 | 0.51 / 0.49 |
| graded | B0 | 34.0 / 97.3 | -0.20 / 3.10 | 0.96 / 1.00 |
| | A1 | 460.1 / 1599.1 | -1.00 / 49.15 | 1.00 / 1.00 |
| | A2 | 17.5 / 47.4 | 0.08 / 1.01 | 0.98 / 0.94 |
| poor-sensor | B0 | 34.0 / 97.3 | -0.20 / 3.10 | 0.96 / 1.00 |
| | A1 | 1989.9 / 4358.9 | -23.02 / 36.25 | 0.97 / 0.99 |
| | A2 | 27.9 / 81.6 | 0.14 / 1.96 | 0.81 / 0.13 |

## 7. Findings

1. **A2 has the lowest median and P95 exit error in every scenario.** In baseline it is
   4.6 / 12.3 m against 17.4 / 49.8 m for B0. Estimating the accelerometer bias while GNSS
   is still available is what makes the accelerometer usable.
2. **At constant speed B0 is a strong baseline, and tunnel length dominates.** In long, B0
   reaches 85.8 / 239.9 m and A2 69.3 / 188.4 m. B0's assumption is true there, and A2's
   remaining bias error grows with time in the tunnel. A2 still knows it is uncertain
   (coverage 0.98 / 0.97), but its 100 m announcement is up to 5.16 s late at P95.
3. **Stops break B0 and expose a known blind spot of A2.** In stop-and-go, B0 keeps driving
   at 70 km/h through the stop: 1660.5 m exit error and announcements about 85 s early. A2
   stays at 70.3 / 88.8 m, but it is consistently late (100 m announcement 2.57 / 3.06 s)
   and over-confident (coverage 0.51 / 0.49). The scenario's 0.5 m/s crawl is below the
   about 1 m/s threshold of the stop detector, by design (A-56). The filter does not know
   the car is moving.
4. **Under errors it does not model, A2 is over-confident in the worst runs.** In
   poor-sensor, A2 is still the most accurate (27.9 / 81.6 m), but its coverage falls to
   0.81 on average and 0.13 in the worst 10 % of runs. This scenario was kept out of
   tuning (A-53) so that this failure stays visible.
5. **A1's coverage of 1.00 is not a strength.** Without a bias estimate, A1's ±2σ band
   grows with the full prior bias uncertainty (about 0.44 m/s², A-51) times t²/2. The band
   holds the truth because it is hundreds of metres wide, while the error itself reaches
   kilometres (long: 2186.4 / 6126.6 m).
6. **After the exit, A2 recovers fastest.** Its median recovery is 5.0 – 12.5 s across
   scenarios, against about 19 – 20 s for B0 and A1 (results file). A few runs per method
   never get below 5 m before the road ends (0 to 5 of 200).

Two sanity checks:

- **Max tunnel error equals exit error in every summary cell of the results file.** With no
  GNSS, the error grows along the tunnel, so its largest value is usually reached at the
  exit portal. In individual runs the maximum can occur earlier. The median / P95 cells
  still coincide.
- **B0 has identical in-tunnel results in graded and poor-sensor.** The two scenarios share
  the tunnel length (2 km), the exit (1500 m), the approach and departure, the constant
  70 km/h speed profile, the GNSS model apart from the exit jump, and the report seeds.
  They differ in the grade (+4 % then −2 % in graded, flat in poor-sensor) and in the
  accelerometer and the GNSS exit jump (poor-sensor only). B0 uses only GNSS fixes: inside
  the tunnel it keeps the speed of the last fix before the entry. It reads neither the
  accelerometer nor the grade, and the GNSS errors come from their own random stream
  (ADR-0006). The car's position over time is the same in both, so B0 sees the same
  fixes. The results differ only after the exit, where poor-sensor adds the GNSS jump.

## 8. Limitations

- **Simulation only.** The error models come from datasheets, published measurements and
  stated assumptions (`ASSUMPTIONS.md`). Several values have no source and are marked as
  our own choice. No real device data was used.
- **Optimistic stop detection.** The zero-velocity threshold is derived from the
  simulator's own vibration law (A-56), so stop detection works better here than on a real
  phone.
- **One dimension.** The car moves along a single-lane centerline with a known route and
  map (A-01, A-10 to A-14). Lane changes, wrong turns and map errors are out of scope.
- **Single sensor model.** The estimators' sensor model matches the simulator's defaults
  wherever both use the same source. poor-sensor is the only scenario that tests a large
  model mismatch.
- **GNSS error treated as white.** The simulated GNSS error is correlated over 60 s, but the
  filter treats each fix as independent. A tuned scale on the reported σ (gnssRScale = 2,
  A-54, ADR-0017) compensates instead of a correlated-error model.
- **One speed level.** Every scenario drives at the same free-flow speed of 70 km/h (A-15);
  only stop-and-go adds slower segments. Other speed levels are not evaluated.
- **Reproducibility.** Exact reproduction is guaranteed on V8 (Chrome, Node.js). Other
  JavaScript engines may differ in the last bit of a Gaussian sample (README,
  Reproducibility).

## 9. Next steps with real devices

1. **Record real data.** Log raw accelerometer and GNSS on several phones and mounts
   through real tunnels, and replace the values marked as our choice with measured ones,
   first the GNSS correlation time and the error after the exit (A-34, A-37, A-38) and the
   exit jump (A-39). Measure vibration on a phone mount too: A-32 is only an
   order-of-magnitude source.
2. **Calibrate stop detection** on real vibration data instead of the simulator's own law
   (A-56).
3. **Estimate the phone's orientation in the car** from the direction of gravity and the
   forward acceleration, instead of assuming it is aligned (A-21). Handle the phone being
   picked up during the drive (extension E6).
4. **Measure GNSS at real tunnel exits:** the reacquisition delay and the first-fix error.
   Model the time-correlated GNSS error in the filter instead of scaling R (A-54).
5. **Check timestamps:** latency, jitter and irregular sample rates of real sensor streams
   (extension E2).
6. **Evaluate extra signals:** a barometer for the grade (E9), and vehicle speed from OBD
   or CarPlay where it is available (A-29).
7. **Port the core** to the production engine's language (for example C++). It has no
   dependencies and is separate from the UI, so this is a translation (ADR-0001).

## 10. Reproduce

```bash
npm install
npm run eval        # report set, 200 runs per scenario → out/eval-report.md
npm run dev         # visual simulator
```

`npm run eval` writes `out/eval-report.md`, which is not committed;
[`results/eval-report.md`](results/eval-report.md) is a committed copy of that file, and a
fresh run on V8 reproduces it byte for byte. The visual simulator opens each scenario on
its representative seed, listed in the header of the results file: the report seed whose
A2 exit error is closest to the median.
