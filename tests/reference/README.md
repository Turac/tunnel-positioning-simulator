# Reference implementations for PRNG test vectors

The expected values in `tests/random/` come from the authors' official C implementations,
compiled unmodified and run with fixed inputs. They are not written from memory: if both
the reference and the TypeScript port came from the same (possibly wrong) recollection, a
shared mistake would make the test pass. See ADR-0004.

## Official sources (unmodified)

| File | Downloaded from | SHA-256 |
|---|---|---|
| `xoshiro128starstar.c` | https://prng.di.unimi.it/xoshiro128starstar.c | `2e3e540e15e1b1edf6144509ba3a71bc4611e3676d52e03d567a0f230a141a67` |
| `f2x.c` | https://prng.di.unimi.it/f2x.c (included by `xoshiro128starstar.c`) | `62e9b22bd882c6dade29a57cabcd079abf83522218415e3e9a95a4e6086dac99` |
| `splitmix64.c` | https://prng.di.unimi.it/splitmix64.c, which redirects to https://prng.di.unimi.it/splitmix.c | `920282fcf60da413d5d823b4049b4962db16816de59d5cc63507d816f2938742` |

`xoshiro128starstar.c` is xoshiro128\*\* version 1.1 (David Blackman and Sebastiano Vigna).
`splitmix64.c` is SplitMix64 (Sebastiano Vigna). Both are public domain.

Verify the files are unmodified:

```bash
shasum -a 256 tests/reference/*.c
```

## Harnesses

`*-harness.c` files `#include` the official file and only add a `main()` that sets fixed
inputs and prints outputs. The printed output is stored in `*.expected.txt`.

- `xoshiro128starstar-harness.c`: outputs 1–10 and 1000 for three fixed states: `A`
  (`{1, 2, 3, 4}`), `B` (words with high bits set, to exercise unsigned 32-bit arithmetic)
  and `SEED42` (the state that seed 42 expands to; see ADR-0004).
- `splitmix64-harness.c`: outputs 1–4 and 1000 for seeds 0, 1, 42 and 4294967295.

## Rebuild and compare

From the repository root (binaries go to `out/`, which is git-ignored):

```bash
mkdir -p out
cc -std=c11 -O2 -Wall -o out/xoshiro128starstar-harness tests/reference/xoshiro128starstar-harness.c
out/xoshiro128starstar-harness | diff - tests/reference/xoshiro128starstar.expected.txt
cc -std=c11 -O2 -Wall -o out/splitmix64-harness tests/reference/splitmix64-harness.c
out/splitmix64-harness | diff - tests/reference/splitmix64.expected.txt
```

No output from `diff` means the expected values are reproduced exactly.
