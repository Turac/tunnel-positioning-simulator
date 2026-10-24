import { describe, expect, it } from 'vitest'
import { createXoshiro128ss, type Xoshiro128State } from '../../src/core/random/xoshiro128ss'

// Expected values: output of the official xoshiro128** 1.1 C implementation, compiled
// unmodified (tests/reference/xoshiro128starstar.expected.txt). See tests/reference/README.md.

interface Vector {
  state: Xoshiro128State
  first10: readonly number[]
  at1000: number
}

const VECTORS: Record<string, Vector> = {
  A: {
    state: [0x00000001, 0x00000002, 0x00000003, 0x00000004],
    first10: [
      0x00002d00, 0x00000000, 0x005a7080, 0x04389d80, 0x79199d9b, 0x61963b24, 0x4cb9b57a,
      0xde9d7431, 0xde458f35, 0xfdce1a54,
    ],
    at1000: 0xbcfd424b,
  },
  B: {
    state: [0x9e3779b9, 0x243f6a88, 0xb7e15162, 0x6a09e667],
    first10: [
      0x92dcf72a, 0x00544cb2, 0xb4250633, 0xe09df011, 0xa75a2c36, 0x7a0bc9ad, 0x64370c4b,
      0x156f0cac, 0x5ed16f65, 0xefc92ab3,
    ],
    at1000: 0xc2807a85,
  },
  SEED42: {
    state: [0x2feb6e95, 0xbdd73226, 0xb266f103, 0x28efe333],
    first10: [
      0x69e85a2a, 0xf843fad0, 0x0105185f, 0x8a1f1ea6, 0xa66be2a9, 0x9844904e, 0xaf4213e7,
      0x85c95cd7, 0xd4a5504a, 0xae8d0101,
    ],
    at1000: 0x00f549f9,
  },
}

function take(next: () => number, n: number): number[] {
  return Array.from({ length: n }, next)
}

describe('xoshiro128** matches the official reference implementation', () => {
  it.each(Object.entries(VECTORS))('state %s: outputs 1-10 and 1000', (_name, vector) => {
    const next = createXoshiro128ss(vector.state)
    const outputs = take(next, 1000)
    expect(outputs.slice(0, 10)).toEqual(vector.first10)
    expect(outputs[999]).toBe(vector.at1000)
  })

  it('returns unsigned 32-bit integers', () => {
    const outputs = take(createXoshiro128ss(VECTORS.B!.state), 10_000)
    expect(outputs.every((x) => Number.isInteger(x) && x >= 0 && x < 2 ** 32)).toBe(true)
  })

  it('rejects the all-zero state', () => {
    expect(() => createXoshiro128ss([0, 0, 0, 0])).toThrow(RangeError)
  })
})
