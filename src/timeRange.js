import { subDays, subYears } from 'date-fns'

const RANGE_START = {
  '1y': (last) => subDays(last, 365),
  '5y': (last) => subYears(last, 5),
  '10y': (last) => subYears(last, 10),
}

// Converts a YYYY-MM-DD date to a local-midnight timestamp (ms) for the chart's time scale.
export function toTimestamp(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export const toChartPoints = (points) =>
  points.map(({ x, y }) => ({ x: toTimestamp(x), y }))

// Points must be sorted by `x` (timestamp in ms). Ranges count back from the most recent date.
export function filterByRange(points, range) {
  const getStart = RANGE_START[range]
  if (!getStart || points.length === 0) return points
  const start = getStart(points[points.length - 1].x).getTime()
  return points.filter((point) => point.x >= start)
}
