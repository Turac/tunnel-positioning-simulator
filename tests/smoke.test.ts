import { describe, expect, it } from 'vitest'

describe('test harness', () => {
  it('runs TypeScript tests in Node', () => {
    const values: readonly number[] = [1, 2, 3]
    expect(values.reduce((sum, v) => sum + v, 0)).toBe(6)
  })
})
