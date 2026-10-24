import { describe, expect, it } from 'vitest'
import { createSplitMix64 } from '../../src/core/random/splitmix64'

// Expected values: output of the official SplitMix64 C implementation, compiled unmodified
// (tests/reference/splitmix64.expected.txt). See tests/reference/README.md.

const VECTORS: ReadonlyArray<{ seed: bigint; first4: readonly bigint[]; at1000: bigint }> = [
  {
    seed: 0n,
    first4: [0xe220a8397b1dcdafn, 0x6e789e6aa1b965f4n, 0x06c45d188009454fn, 0xf88bb8a8724c81ecn],
    at1000: 0x14e0abb2bfcf7c3en,
  },
  {
    seed: 1n,
    first4: [0x910a2dec89025cc1n, 0xbeeb8da1658eec67n, 0xf893a2eefb32555en, 0x71c18690ee42c90bn],
    at1000: 0xe71894b1b5034fb7n,
  },
  {
    seed: 42n,
    first4: [0xbdd732262feb6e95n, 0x28efe333b266f103n, 0x47526757130f9f52n, 0x581ce1ff0e4ae394n],
    at1000: 0x66091ca85313fa68n,
  },
  {
    seed: 4294967295n,
    first4: [0x73b13ba2aff181c0n, 0x612043051340d3b4n, 0xee4ac9ff47275e73n, 0x12f4eeb73ced4b8en],
    at1000: 0x511c6d42db6b0ef4n,
  },
]

describe('SplitMix64 matches the official reference implementation', () => {
  it.each(VECTORS)('seed $seed: outputs 1-4 and 1000', ({ seed, first4, at1000 }) => {
    const next = createSplitMix64(seed)
    const outputs = Array.from({ length: 1000 }, next)
    expect(outputs.slice(0, 4)).toEqual(first4)
    expect(outputs[999]).toBe(at1000)
  })
})
