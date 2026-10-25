import Papa from 'papaparse'

const DATE_COLUMN = 'observation_date'
const RATE_COLUMN = 'DEXUSEU'
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MIN_POINTS = 10
export const MAX_POINTS = 50_000

export const MESSAGES = {
  invalidType: 'Please upload a CSV file',
  tooLarge: 'File size must be less than 10MB',
  empty: 'The uploaded file is empty',
  readError: 'Unable to read the file. Please try again',
  missingColumns: "CSV must contain 'observation_date' and 'DEXUSEU' columns",
  invalidDates: 'Dates must be in YYYY-MM-DD format (M/D/YYYY is also accepted)',
  invalidRates: 'Exchange rates must be positive numbers',
  tooFew: 'At least 10 valid data points required',
  tooMany: 'Maximum 50,000 data points supported',
}

export class ValidationError extends Error {
  constructor(messages) {
    super(messages.join(' '))
    this.name = 'ValidationError'
    this.messages = messages
  }
}

// Returns an error message for files that should not be read, or null.
export function validateFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) return MESSAGES.invalidType
  if (file.size > MAX_FILE_BYTES) return MESSAGES.tooLarge
  if (file.size === 0) return MESSAGES.empty
  return null
}

const pad = (n) => String(n).padStart(2, '0')

// Accepts ISO (YYYY-MM-DD) and US (M/D/YYYY) dates; returns YYYY-MM-DD or null.
export function normalizeDate(value) {
  const text = String(value ?? '').trim()
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  let year, month, day
  if (match) {
    ;[, year, month, day] = match.map(Number)
  } else {
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!match) return null
    ;[, month, day, year] = match.map(Number)
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${pad(month)}-${pad(day)}`
}

const RATE_PATTERN = /^\+?(\d+\.?\d*|\.\d+)$/

// FRED exports mark missing observations with "." or an empty cell.
const isMissing = (value) => value === '' || value === '.'

const foundMessage = (count) =>
  `Found ${count.toLocaleString('en-US')} valid data point${count === 1 ? '' : 's'}.`

export function parseExchangeRateCsv(text) {
  if (text.trim() === '') throw new ValidationError([MESSAGES.empty])

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  const fields = result.meta.fields ?? []
  if (!fields.includes(DATE_COLUMN) || !fields.includes(RATE_COLUMN)) {
    throw new ValidationError([MESSAGES.missingColumns])
  }

  const counts = { missing: 0, invalidDates: 0, invalidRates: 0, duplicates: 0 }
  const rates = new Map()
  for (const row of result.data) {
    const rawDate = String(row[DATE_COLUMN] ?? '').trim()
    const rawRate = String(row[RATE_COLUMN] ?? '').trim()
    if (isMissing(rawDate) || isMissing(rawRate)) {
      counts.missing++
      continue
    }
    const x = normalizeDate(rawDate)
    if (!x) {
      counts.invalidDates++
      continue
    }
    const y = Number(rawRate)
    if (!RATE_PATTERN.test(rawRate) || !(y > 0)) {
      counts.invalidRates++
      continue
    }
    if (rates.has(x)) {
      counts.duplicates++
      continue
    }
    rates.set(x, y)
  }

  const points = [...rates]
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => (a.x < b.x ? -1 : a.x > b.x ? 1 : 0))

  if (points.length < MIN_POINTS) {
    const messages = []
    if (counts.invalidDates) messages.push(MESSAGES.invalidDates)
    if (counts.invalidRates) messages.push(MESSAGES.invalidRates)
    messages.push(MESSAGES.tooFew, foundMessage(points.length))
    throw new ValidationError(messages)
  }
  if (points.length > MAX_POINTS) {
    throw new ValidationError([MESSAGES.tooMany, foundMessage(points.length)])
  }

  const totalRows = result.data.length
  return {
    points,
    summary: {
      totalRows,
      droppedRows: totalRows - points.length,
      validRows: points.length,
      ...counts,
    },
  }
}
