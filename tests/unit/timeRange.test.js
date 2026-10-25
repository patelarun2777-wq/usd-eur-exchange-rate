import { describe, expect, it } from 'vitest'
import { filterByRange, toChartPoints, toTimestamp } from '../../src/timeRange.js'

const dayPoints = (startIso, count) => {
  const start = toTimestamp(startIso)
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    return { x: date.getTime(), y: 1 + i / 10_000 }
  })
}

const pad = (n) => String(n).padStart(2, '0')
const iso = (time) => {
  const d = new Date(time)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

describe('toTimestamp', () => {
  it('returns local midnight for the given date', () => {
    const date = new Date(toTimestamp('2024-03-05'))
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2024, 2, 5, 0,
    ])
  })

  it('handles years before 1970 and leap days', () => {
    expect(iso(toTimestamp('1900-01-01'))).toBe('1900-01-01')
    expect(iso(toTimestamp('2024-02-29'))).toBe('2024-02-29')
  })
})

describe('toChartPoints', () => {
  it('converts ISO dates to timestamps and keeps rates', () => {
    expect(toChartPoints([{ x: '2024-01-02', y: 1.2345 }])).toEqual([
      { x: toTimestamp('2024-01-02'), y: 1.2345 },
    ])
  })
})

describe('filterByRange', () => {
  const points = dayPoints('2010-01-01', 365 * 16)
  const lastIso = iso(points.at(-1).x)

  it('1y keeps the last 365 days, counting back from the latest date', () => {
    const result = filterByRange(points, '1y')
    expect(result).toHaveLength(366)
    expect(iso(result.at(-1).x)).toBe(lastIso)
  })

  it('5y and 10y count back whole calendar years', () => {
    const [year, month, day] = lastIso.split('-')
    expect(iso(filterByRange(points, '5y')[0].x)).toBe(`${year - 5}-${month}-${day}`)
    expect(iso(filterByRange(points, '10y')[0].x)).toBe(`${year - 10}-${month}-${day}`)
  })

  it('max returns every point', () => {
    expect(filterByRange(points, 'max')).toBe(points)
  })

  it('uses the next available point when the cutoff has no data', () => {
    const sparse = toChartPoints([
      { x: '2020-08-21', y: 1 },
      { x: '2020-08-24', y: 2 },
      { x: '2025-08-22', y: 3 },
    ])
    expect(filterByRange(sparse, '5y').map((p) => iso(p.x))).toEqual(['2020-08-24', '2025-08-22'])
  })

  it('returns an empty list unchanged', () => {
    expect(filterByRange([], '1y')).toEqual([])
  })
})
