import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_BYTES,
  MESSAGES,
  ValidationError,
  normalizeDate,
  parseExchangeRateCsv,
  validateFile,
} from '../../src/csv.js'

const csv = (rows) => ['observation_date,DEXUSEU', ...rows].join('\n')
const validRows = (count, start = 1) =>
  Array.from({ length: count }, (_, i) => `2024-01-${String(start + i).padStart(2, '0')},1.${1000 + i}`)

function messagesOf(fn) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    return error.messages
  }
  throw new Error('Expected a ValidationError')
}

describe('validateFile', () => {
  it('accepts a non-empty .csv file within the size limit', () => {
    expect(validateFile({ name: 'rates.CSV', size: 100 })).toBeNull()
  })

  it('rejects other file types', () => {
    expect(validateFile({ name: 'rates.txt', size: 100 })).toBe(MESSAGES.invalidType)
  })

  it('rejects files over 10MB', () => {
    expect(validateFile({ name: 'rates.csv', size: MAX_FILE_BYTES + 1 })).toBe(MESSAGES.tooLarge)
    expect(validateFile({ name: 'rates.csv', size: MAX_FILE_BYTES })).toBeNull()
  })

  it('rejects empty files', () => {
    expect(validateFile({ name: 'rates.csv', size: 0 })).toBe(MESSAGES.empty)
  })
})

describe('normalizeDate', () => {
  it.each([
    ['2024-03-05', '2024-03-05'],
    ['2024-3-5', '2024-03-05'],
    ['3/5/2024', '2024-03-05'],
    [' 12/31/1999 ', '1999-12-31'],
    ['2024-02-29', '2024-02-29'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected)
  })

  it.each(['2023-02-29', '2024-13-01', '2024-02-30', '05/03/24', 'Mar 5 2024', '', null])(
    'rejects %s',
    (input) => {
      expect(normalizeDate(input)).toBeNull()
    },
  )
})

describe('parseExchangeRateCsv', () => {
  it('parses valid rows into sorted ISO-date points with a summary', () => {
    const rows = validRows(10).reverse()
    const { points, summary } = parseExchangeRateCsv(csv(rows))
    expect(points).toHaveLength(10)
    expect(points[0]).toEqual({ x: '2024-01-01', y: 1.1 })
    expect(points.map((p) => p.x)).toEqual([...points.map((p) => p.x)].sort())
    expect(summary).toEqual({
      totalRows: 10,
      droppedRows: 0,
      validRows: 10,
      missing: 0,
      invalidDates: 0,
      invalidRates: 0,
      duplicates: 0,
    })
  })

  it('drops missing, invalid and duplicate rows and counts each reason', () => {
    const rows = [
      ...validRows(10),
      '2024-01-11,',
      '2024-01-12,.',
      ',1.1',
      '2024-02-30,1.1',
      '2024-01-13,0',
      '2024-01-14,-1.2',
      '2024-01-15,abc',
      '2024-01-01,9.9',
    ]
    const { points, summary } = parseExchangeRateCsv(csv(rows))
    expect(points).toHaveLength(10)
    expect(points[0].y).toBe(1.1)
    expect(summary).toMatchObject({
      totalRows: 18,
      droppedRows: 8,
      validRows: 10,
      missing: 3,
      invalidDates: 1,
      invalidRates: 3,
      duplicates: 1,
    })
  })

  it('accepts extra columns, reordered columns, CRLF line endings and padded headers', () => {
    const rows = validRows(10).map((row) => {
      const [date, rate] = row.split(',')
      return `${rate},x,${date}`
    })
    const text = [' DEXUSEU , extra ,observation_date', ...rows].join('\r\n')
    expect(parseExchangeRateCsv(text).points).toHaveLength(10)
  })

  it('rejects empty text', () => {
    expect(messagesOf(() => parseExchangeRateCsv('  \n'))).toEqual([MESSAGES.empty])
  })

  it('rejects files without the required columns', () => {
    expect(messagesOf(() => parseExchangeRateCsv('date,rate\n2024-01-01,1.1'))).toEqual([
      MESSAGES.missingColumns,
    ])
  })

  it('explains why too few rows remain', () => {
    const messages = messagesOf(() =>
      parseExchangeRateCsv(csv([...validRows(3), '2024-02-30,1.1', '2024-01-20,-1'])),
    )
    expect(messages).toEqual([
      MESSAGES.invalidDates,
      MESSAGES.invalidRates,
      MESSAGES.tooFew,
      'Found 3 valid data points.',
    ])
  })

  it('rejects more than 50,000 valid rows', () => {
    const start = Date.UTC(1900, 0, 1)
    const rows = Array.from(
      { length: 50_001 },
      (_, i) => `${new Date(start + i * 86_400_000).toISOString().slice(0, 10)},1.1`,
    )
    expect(messagesOf(() => parseExchangeRateCsv(csv(rows)))).toEqual([
      MESSAGES.tooMany,
      'Found 50,001 valid data points.',
    ])
  })

  it('treats HTML in cells as invalid data, not markup', () => {
    const { summary } = parseExchangeRateCsv(
      csv([...validRows(10), '<img src=x onerror=alert(1)>,1.1']),
    )
    expect(summary.invalidDates).toBe(1)
  })

  it('processes the supplied DEXUSEU.csv sample', () => {
    const text = readFileSync(new URL('../../DEXUSEU.csv', import.meta.url), 'utf8')
    const { points, summary } = parseExchangeRateCsv(text)
    expect(summary).toMatchObject({
      totalRows: 6950,
      droppedRows: 268,
      validRows: 6682,
      missing: 268,
    })
    expect(points[0].x).toBe('1999-01-04')
    expect(points.at(-1).x).toBe('2025-08-22')
  })
})
