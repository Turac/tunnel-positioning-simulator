// Okabe–Ito colour-blind-safe colours, fixed per series.

export const TRUTH_COLOR = '#000000'
export const GNSS_COLOR = '#009E73'

const ESTIMATOR_COLORS: Readonly<Record<string, string>> = {
  B0: '#E69F00',
  A1: '#CC79A7',
  A2: '#0072B2',
}

export function estimatorColor(id: string): string {
  return ESTIMATOR_COLORS[id] ?? '#555555'
}
