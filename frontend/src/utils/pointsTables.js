// Same standard values as the server (src/utils/pointsTables.js).
export const DEFAULT_POINTS_TABLES = {
  weekly: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1],
  seed: [100, 90, 80, 70, 60, 50, 40, 30],
  semifinal: [100, 90, 80, 70, 60, 50, 40, 30],
  final: [200, 90, 80, 70, 60, 50, 40, 30],
  losers: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 1]
}

export const ordinal = (n) => {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`
}

// Points for 1st through `count`; the last value covers the places below it.
export const places = (table, count) => Array.from({ length: count }, (_unused, i) => table[Math.min(i, table.length - 1)])
