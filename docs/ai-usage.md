# AI usage note

## In short

- **How AI was used.** Claude Code wrote most of the code and tests and drafted the
  documents, under the rules in `CLAUDE.md`: propose first, implement only after approval,
  never commit on its own. A separate Claude chat and ChatGPT were used for problem framing
  and second opinions.
- **Where it was overruled.** It proposed too broad a scope, put the map where estimators
  could not read it, and wrote test vectors from memory. It also proposed snapping to GNSS
  after repeated rejected fixes at the tunnel exit, and a hold time alone against the
  filter's overconfidence at stops, which left the overconfidence in place. Each was
  corrected (details below).
- **Where it corrected the author.** It found that the author's stream-seed layout made two
  generators collide for one seed value.
- **How its output was checked.** Official reference code, deliberately broken tests,
  disjoint tuning and report seeds, and every number in the report traced to the results
  file.

The rest of this note gives the details. The full dated record is [`ai-log.md`](ai-log.md).

## Tools and roles

| Tool | Used for |
|---|---|
| **Claude Code** (coding agent in the repository) | Plans for each phase, code, tests, ADR and documentation drafts, evaluation runs. |
| **Claude, separate chat** (second model) | Problem framing, and a second opinion on proposals before approving them (e.g. the map module, the ZUPT fix, the stream-seed layout). |
| **ChatGPT** | Early problem framing and estimator ideas, reviewed with Claude. |

Every non-merge commit carries a `Co-Authored-By` trailer for the AI agent: the agent wrote
most of the code, and the project author reviewed and approved every change.

## Working rules

The rules the agent works under are in [`CLAUDE.md`](../CLAUDE.md):

- **Propose before implementing.** Every non-trivial decision (algorithm, model structure,
  noise values, dependency, data format, architecture) is proposed with alternatives and
  trade-offs, and implemented only after explicit approval. Significant decisions become
  ADRs ([`decisions/`](decisions/)); numeric assumptions get an ID in
  [`ASSUMPTIONS.md`](ASSUMPTIONS.md).
- **The agent never commits on its own.** It shows a diff summary and a proposed message,
  and the author approves each commit.
- **Corrections are logged.** When the author corrects, rejects or changes a proposal, the
  change is recorded in `ai-log.md`.
- **Hard rules are enforced by tooling, not by trust.** Truth isolation and the ban on
  `Math.random()` in the core are lint rules with a test that proves they fire (ADR-0003).

## Where AI output was corrected or rejected

- **Scope.** A first plan put a particle filter, BLE beacons and map matching in the core.
  These became optional extensions; the core is a small, well-measured set of estimators.
- **Main method.** A suggestion to make pure IMU integration the main method was rejected:
  the Kalman filter is the main method because estimating the bias while GNSS is still
  available is its whole point.
- **Missing physics.** A scenario set with no road grade and no stops was extended with a
  graded tunnel, grade compensation and stop detection (ZUPT).
- **Map vs. truth.** The simulation plan put the tunnel map under `world/`, which estimators
  may not import. The author caught this; a neutral `map/` module was added (ADR-0007).
- **Test vectors.** The agent proposed expected PRNG values, and then a C reference, both
  written from memory. Rejected: the official C files were downloaded, hashed, compiled
  unmodified, and their output became the expected values (`tests/reference/`).
- **GNSS return.** A proposal to snap the position to GNSS after repeated rejected fixes was
  rejected, because the first fixes after the exit can be far off. The filter widens its
  own uncertainty instead (ADR-0013).
- **ZUPT overconfidence.** The agent found that stop detection made the filter
  overconfident in stop-and-go. The agent tested a hold time alone; it reduced the error
  slightly but left the filter overconfident. After a discussion with the second model, the
  author chose a weaker, rate-limited update that keeps the hold (ADR-0015, superseding
  ADR-0014).
- **Tuning and run counts.** The poor-sensor scenario is kept out of tuning, and the report
  set uses more runs than the agent proposed (ADR-0016, ADR-0017).

## Where AI caught a human mistake

The author proposed a layout for deriving the seeds of the named random streams. Before
implementing it, Claude Code showed that for one seed value a stream would reproduce the
plain generator, so two supposedly independent sources would give the same numbers. The
two fields of the layout were swapped (ADR-0006).

## How AI output was checked

- **Independent references.** Known-answer tests use outputs of the authors' official C
  code, never values recalled by a model.
- **Mutation checks.** Code was broken on purpose to show that its tests fail: the PRNG
  seeding, the Gaussian sampling (ADR-0005), the named-stream derivation and the
  module-boundary lint rules (ai-log), and the simulation modules (map, speed profile, true
  trajectory, measurement time grid). Where a mutation survived, a test was added or the
  reason was recorded.
- **Separate seed sets.** Parameters are tuned on tuning seeds only, and results are reported
  on a disjoint report set (CLAUDE.md hard rules, A-43).
- **Regression snapshots.** Metrics on fixed seeds are snapshotted; a snapshot is never
  updated without the author reviewing the change.
- **Numbers from files, not from prose.** Every number in [`report.md`](report.md) is taken
  from the evaluation output ([`results/eval-report.md`](results/eval-report.md)).
- **Sources or an explicit "our choice".** Values without a published source are marked as
  our own choice in `ASSUMPTIONS.md` instead of being given an invented citation.

## Limits

AI tools sped up writing code and documents, and they reviewed one another usefully. But
they also proposed plausible values from memory, missed edge cases and offered fixes that
did not address the cause. The results are only as trustworthy as the checks above.
Responsibility for every decision, number and line in the repository lies with the project
author.
