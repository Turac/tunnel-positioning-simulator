// Box–Muller transform: two uniform samples in [0, 1) to one standard normal sample.
// The sine branch is discarded so that every Gaussian sample consumes exactly two
// uniforms, which keeps stream consumption simple to reason about.

/**
 * Standard normal sample from two uniforms in [0, 1). Uses ln(1 − u1) because a uniform
 * can be 0 but never 1, so the logarithm is always finite.
 */
export function boxMuller(u1: number, u2: number): number {
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2)
}
