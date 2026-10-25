import './style.css'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-date-fns'
import zoomPlugin from 'chartjs-plugin-zoom'
import { format } from 'date-fns'
import {
  MESSAGES,
  ValidationError,
  parseExchangeRateCsv,
  validateFile,
} from './csv.js'
import { filterByRange, toChartPoints } from './timeRange.js'

// Sample data shown until a CSV is uploaded.
const sampleData = [
  { x: '1999-01-04', y: 1.1812 },
  { x: '1999-01-05', y: 1.176 },
  { x: '1999-01-06', y: 1.1636 },
  { x: '1999-01-07', y: 1.1672 },
  { x: '1999-01-08', y: 1.1554 },
  { x: '1999-01-11', y: 1.1534 },
  { x: '1999-01-12', y: 1.1548 },
  { x: '1999-01-13', y: 1.1698 },
  { x: '1999-01-14', y: 1.1689 },
  { x: '1999-01-15', y: 1.1591 },
  { x: '1999-01-19', y: 1.161 },
  { x: '1999-01-20', y: 1.1575 },
  { x: '1999-01-21', y: 1.1577 },
  { x: '1999-01-22', y: 1.1582 },
  { x: '1999-01-25', y: 1.1566 },
  { x: '1999-01-26', y: 1.1577 },
  { x: '1999-01-27', y: 1.1481 },
  { x: '1999-01-28', y: 1.1395 },
  { x: '1999-01-29', y: 1.1371 },
  { x: '1999-02-01', y: 1.1303 },
  { x: '1999-02-02', y: 1.1328 },
  { x: '1999-02-03', y: 1.1339 },
  { x: '1999-02-04', y: 1.1306 },
  { x: '1999-02-05', y: 1.1283 },
  { x: '1999-02-08', y: 1.1296 },
  { x: '1999-02-09', y: 1.13 },
  { x: '1999-02-10', y: 1.1331 },
  { x: '1999-02-11', y: 1.1303 },
  { x: '1999-02-12', y: 1.1282 },
  { x: '1999-02-16', y: 1.1189 },
  { x: '1999-02-17', y: 1.123 },
  { x: '1999-02-18', y: 1.1223 },
  { x: '1999-02-19', y: 1.1075 },
  { x: '1999-02-22', y: 1.1037 },
  { x: '1999-02-23', y: 1.0993 },
  { x: '1999-02-24', y: 1.0972 },
  { x: '1999-02-25', y: 1.1068 },
  { x: '1999-02-26', y: 1.0995 },
  { x: '1999-03-01', y: 1.0891 },
  { x: '1999-03-02', y: 1.0931 },
  { x: '1999-03-03', y: 1.0888 },
  { x: '1999-03-04', y: 1.0824 },
  { x: '1999-03-05', y: 1.0843 },
  { x: '1999-03-08', y: 1.0899 },
  { x: '1999-03-09', y: 1.0873 },
  { x: '1999-03-10', y: 1.0961 },
  { x: '1999-03-11', y: 1.0932 },
  { x: '1999-03-12', y: 1.0936 },
  { x: '1999-03-15', y: 1.093 },
  { x: '1999-03-16', y: 1.0915 },
  { x: '1999-03-17', y: 1.1015 },
  { x: '1999-03-18', y: 1.099 },
  { x: '1999-03-19', y: 1.0923 },
  { x: '1999-03-22', y: 1.0915 },
  { x: '1999-03-23', y: 1.0918 },
  { x: '1999-03-24', y: 1.0921 },
  { x: '1999-03-25', y: 1.0871 },
  { x: '1999-03-26', y: 1.0743 },
  { x: '1999-03-29', y: 1.0716 },
  { x: '1999-03-30', y: 1.0732 },
]

const ctx = document.getElementById('exchange-rate-chart')

const rootStyles = getComputedStyle(document.documentElement)
const cssVar = (name) => rootStyles.getPropertyValue(name).trim()
const primaryColor = cssVar('--primary-color')

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

Chart.register(zoomPlugin)
if (reduceMotion) Chart.defaults.animation = false
Chart.defaults.font.family = getComputedStyle(document.body).fontFamily
Chart.defaults.color = cssVar('--text-secondary')
Chart.defaults.borderColor = cssVar('--border')

const crosshairPlugin = {
  id: 'crosshair',
  beforeDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements() ?? []
    if (active.length === 0) return
    const { ctx: c, chartArea } = chart
    const x = active[0].element.x
    c.save()
    c.beginPath()
    c.moveTo(x, chartArea.top)
    c.lineTo(x, chartArea.bottom)
    c.lineWidth = 1
    c.strokeStyle = cssVar('--secondary-color')
    c.setLineDash([4, 4])
    c.stroke()
    c.restore()
  },
}

const MIN_ZOOM_RANGE_MS = 7 * 24 * 60 * 60 * 1000
// Animating every point gets janky beyond this, so larger views update instantly instead.
const ANIMATED_POINT_LIMIT = 2000

let chart = null
try {
  chart = new Chart(ctx, {
  type: 'line',
  plugins: [crosshairPlugin],
  data: {
    datasets: [
      {
        label: 'USD per EUR',
        data: [],
        borderColor: primaryColor,
        backgroundColor: `${primaryColor}1a`,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: primaryColor,
        pointHoverBorderColor: cssVar('--background'),
        pointHoverBorderWidth: 2,
        tension: 0.1,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    // Data is pre-sorted { x: timestamp, y: number }, so Chart.js can skip parsing.
    parsing: false,
    normalized: true,
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    transitions: {
      zoom: {
        animation: { duration: reduceMotion ? 0 : 250, easing: 'easeOutCubic' },
      },
    },
    plugins: {
      title: {
        display: true,
        text: 'USD/EUR Exchange Rate',
        color: cssVar('--text-primary'),
        font: { size: 16, weight: '600' },
      },
      legend: {
        display: true,
        // There is only one series, so hiding it would just leave an empty chart.
        onClick: () => {},
      },
      zoom: {
        limits: {
          x: { min: 'original', max: 'original', minRange: MIN_ZOOM_RANGE_MS },
        },
        pan: {
          enabled: true,
          mode: 'x',
          onPanStart: () => chart.isZoomedOrPanned(),
          onPanComplete: () => syncZoomState(),
        },
        zoom: {
          mode: 'x',
          wheel: { enabled: true, speed: 0.1 },
          onZoomComplete: () => syncZoomState(),
        },
      },
      tooltip: {
        displayColors: false,
        padding: 10,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (item) => `USD per EUR: ${item.parsed.y.toFixed(4)}`,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          tooltipFormat: 'MMM d, yyyy',
          minUnit: 'day',
          // Chart.js picks the unit from the visible span: days, then months, then years.
          displayFormats: {
            day: 'MMM d',
            week: 'MMM d',
            month: 'MMM yyyy',
            quarter: 'MMM yyyy',
            year: 'yyyy',
          },
        },
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 16,
        },
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        title: {
          display: true,
          text: 'USD per EUR',
        },
        ticks: {
          callback: (value) =>
            Number(value).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            }),
        },
      },
    },
  },
  })
} catch (error) {
  console.warn('Chart could not be created', error)
}
const chartReady = () => Boolean(chart?.ctx)

const rangeButtons = document.querySelectorAll('#time-range [data-range]')
const rangeSummary = document.getElementById('range-summary')
const resetZoomButton = document.getElementById('reset-zoom')
const chartAnnouncer = document.getElementById('chart-announcer')
const keyboardHelp = document.getElementById('chart-keyboard-help')
const chartLoading = document.getElementById('chart-loading')
const chartError = document.getElementById('chart-error')

let loadingTimer

// A delay keeps fast loads from flashing the skeleton.
function setChartLoading(active, delay = 0) {
  clearTimeout(loadingTimer)
  ctx.setAttribute('aria-busy', String(active))
  if (active && delay) {
    loadingTimer = setTimeout(() => chartLoading.classList.remove('is-hidden'), delay)
    return
  }
  chartLoading.classList.toggle('is-hidden', !active)
}

function showChartError() {
  setChartLoading(false)
  ctx.toggleAttribute('hidden', true)
  chartError.toggleAttribute('hidden', false)
}

let recovering = false
let recoveries = 0

// A zoomed view that fails falls back to the full range (EH-011); any other failure shows the error (EH-010).
function recoverFromChartError(error) {
  console.warn('Chart failed to draw', error)
  recoveries++
  if (recovering || !chart.isZoomedOrPanned()) {
    showChartError()
    return
  }
  recovering = true
  try {
    chart.resetZoom('none')
    syncZoomState()
  } catch {
    showChartError()
  } finally {
    recovering = false
  }
}

if (chartReady()) {
  // The zoom plugin and animation frames call these outside our handlers, so failures are caught here.
  for (const method of ['update', 'draw']) {
    const original = chart[method].bind(chart)
    chart[method] = (...args) => {
      try {
        return original(...args)
      } catch (error) {
        recoverFromChartError(error)
      }
    }
  }
}

const formatDate = (time) => format(time, 'MMM d, yyyy')
const formatRate = (rate) => rate.toFixed(4)

let allPoints = toChartPoints(sampleData)
let currentRange = '1y'
let keyboardIndex = -1

// Text alternative for the canvas, kept in sync with the visible data.
function describeChart(visible) {
  if (!visible.length) {
    ctx.setAttribute('aria-label', 'USD/EUR exchange rate line chart with no data')
    return
  }
  let low = visible[0]
  let high = visible[0]
  for (const point of visible) {
    if (point.y < low.y) low = point
    if (point.y > high.y) high = point
  }
  const first = visible[0]
  const last = visible[visible.length - 1]
  const description =
    `USD/EUR exchange rate line chart from ${formatDate(first.x)} to ${formatDate(last.x)}, ` +
    `${visible.length.toLocaleString('en-US')} data points. ` +
    `Low ${formatRate(low.y)} USD per EUR on ${formatDate(low.x)}, ` +
    `high ${formatRate(high.y)} on ${formatDate(high.x)}, latest ${formatRate(last.y)}.`
  ctx.setAttribute('aria-label', description)
  ctx.textContent = description
}

function syncZoomState() {
  const zoomed = chart.isZoomedOrPanned()
  resetZoomButton.hidden = !zoomed
  ctx.style.cursor = zoomed ? 'grab' : ''
  const { min, max } = chart.scales.x
  const visible = chart.data.datasets[0].data.filter(
    (point) => point.x >= min && point.x <= max,
  )
  const hint = zoomed ? 'Drag to pan' : 'Scroll to zoom'
  rangeSummary.textContent = visible.length
    ? `${formatDate(visible[0].x)} – ${formatDate(visible[visible.length - 1].x)} · ${visible.length.toLocaleString('en-US')} data points · ${hint}`
    : 'No data'
  describeChart(visible)
}

function visibleIndexRange() {
  const data = chart.data.datasets[0].data
  const { min, max } = chart.scales.x
  return [data.findIndex((p) => p.x >= min), data.findLastIndex((p) => p.x <= max)]
}

function clearActivePoint() {
  chart.setActiveElements([])
  chart.tooltip.setActiveElements([], { x: 0, y: 0 })
  chart.update('none')
}

function showPoint(index) {
  keyboardIndex = index
  const active = [{ datasetIndex: 0, index }]
  const element = chart.getDatasetMeta(0).data[index]
  chart.setActiveElements(active)
  chart.tooltip.setActiveElements(active, { x: element.x, y: element.y })
  chart.update('none')
  const point = chart.data.datasets[0].data[index]
  chartAnnouncer.textContent = `${formatDate(point.x)}: ${formatRate(point.y)} USD per EUR`
}

function keyboardViewChange(action) {
  const before = recoveries
  try {
    clearActivePoint()
    if (recoveries === before) action()
  } catch (error) {
    recoverFromChartError(error)
    return
  }
  if (recoveries === before) syncZoomState()
}

ctx.addEventListener('keydown', (event) => {
  if (!chartReady()) return
  const [first, last] = visibleIndexRange()
  if (first < 0 || last < first) return
  const current = keyboardIndex >= first && keyboardIndex <= last ? keyboardIndex : null
  const move = (step) =>
    showPoint(
      current === null
        ? step < 0 ? last : first
        : Math.min(last, Math.max(first, current + step)),
    )
  const pageStep = Math.max(1, Math.round((last - first) / 10))
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      if (!event.shiftKey) move(direction)
      else if (chart.isZoomedOrPanned()) {
        keyboardViewChange(() => chart.pan({ x: -direction * chart.chartArea.width * 0.2 }))
      }
      break
    }
    case 'PageUp':
      move(-pageStep)
      break
    case 'PageDown':
      move(pageStep)
      break
    case 'Home':
      showPoint(first)
      break
    case 'End':
      showPoint(last)
      break
    case '+':
    case '=':
      keyboardViewChange(() => chart.zoom(1.25))
      break
    case '-':
    case '_':
      keyboardViewChange(() => chart.zoom(0.8))
      break
    case '0':
      keyboardViewChange(() => chart.resetZoom())
      break
    default:
      return
  }
  event.preventDefault()
})

ctx.addEventListener('focus', () => {
  keyboardHelp.hidden = false
})
ctx.addEventListener('blur', () => {
  keyboardHelp.hidden = true
  if (chartReady()) clearActivePoint()
})

function renderRange() {
  for (const button of rangeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.range === currentRange))
  }
  if (!chartReady()) {
    showChartError()
    return
  }
  try {
    chart.resetZoom('none')
    const points = filterByRange(allPoints, currentRange)
    const animate = !reduceMotion && points.length <= ANIMATED_POINT_LIMIT
    chart.options.animation = animate ? { duration: 400 } : false
    chart.options.transitions.zoom.animation.duration = animate ? 250 : 0
    // Straight segments let Chart.js merge points that share a pixel column when drawing.
    chart.data.datasets[0].tension = points.length <= ANIMATED_POINT_LIMIT ? 0.1 : 0
    chart.data.datasets[0].data = points
    chart.update()
    syncZoomState()
  } catch (error) {
    console.warn('Chart could not be drawn', error)
    showChartError()
  }
}

resetZoomButton.addEventListener('click', () => chart.resetZoom())

ctx.addEventListener('pointerdown', () => {
  if (chartReady() && chart.isZoomedOrPanned()) ctx.style.cursor = 'grabbing'
})
window.addEventListener('pointerup', () => {
  if (ctx.style.cursor === 'grabbing') ctx.style.cursor = 'grab'
})

const chartSection = document.getElementById('chart-section')
const fullscreenToggle = document.getElementById('fullscreen-toggle')
const fullscreenBackdrop = document.getElementById('fullscreen-backdrop')
const FULLSCREEN_EXIT_MS = 150
const pageBehindChart = [
  document.querySelector('header'),
  document.getElementById('upload-section'),
]

function setFullscreen(active) {
  if (active === chartSection.classList.contains('is-fullscreen')) return
  // Keep keyboard and screen-reader focus inside the chart while it covers the page.
  for (const element of pageBehindChart) element.inert = active
  fullscreenToggle.setAttribute('aria-pressed', String(active))
  document.getElementById('fullscreen-label').textContent = active
    ? 'Exit fullscreen'
    : 'Fullscreen'
  document.getElementById('fullscreen-enter-icon').toggleAttribute('hidden', active)
  document.getElementById('fullscreen-exit-icon').toggleAttribute('hidden', !active)
  if (active) {
    chartSection.classList.add('is-fullscreen')
    fullscreenBackdrop.hidden = false
    document.body.classList.add('overflow-hidden')
    return
  }
  chartSection.classList.add('is-closing')
  fullscreenBackdrop.classList.add('is-closing')
  setTimeout(() => {
    chartSection.classList.remove('is-fullscreen', 'is-closing')
    fullscreenBackdrop.classList.remove('is-closing')
    fullscreenBackdrop.hidden = true
    document.body.classList.remove('overflow-hidden')
  }, FULLSCREEN_EXIT_MS)
}

fullscreenToggle.addEventListener('click', () => {
  setFullscreen(fullscreenToggle.getAttribute('aria-pressed') !== 'true')
})
fullscreenBackdrop.addEventListener('click', () => setFullscreen(false))
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setFullscreen(false)
})

for (const button of rangeButtons) {
  button.addEventListener('click', () => {
    currentRange = button.dataset.range
    if (filterByRange(allPoints, currentRange).length <= ANIMATED_POINT_LIMIT) {
      renderRange()
      return
    }
    setChartLoading(true)
    // Let the loading overlay paint before the heavier redraw.
    requestAnimationFrame(() =>
      setTimeout(() => {
        renderRange()
        setChartLoading(false)
      }),
    )
  })
}

renderRange()
requestAnimationFrame(() => {
  if (chartReady()) setChartLoading(false)
})

const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')
const uploadStatus = document.getElementById('upload-status')
const uploadError = document.getElementById('upload-error')
const errorTitle = document.getElementById('error-title')
const errorList = document.getElementById('error-list')
const uploadSummary = document.getElementById('upload-summary')
const DRAG_CLASSES = ['border-primary', 'bg-background']
const formatCount = (n) => n.toLocaleString('en-US')
const plural = (n, word) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`

function setDragHover(active) {
  dropZone.classList.toggle('border-secondary/50', !active)
  dropZone.classList.toggle('bg-surface', !active)
  for (const cls of DRAG_CLASSES) dropZone.classList.toggle(cls, active)
}

function showError(fileName, messages) {
  uploadStatus.textContent = `Could not load ${fileName}.`
  errorTitle.textContent = `Could not load ${fileName}`
  errorList.replaceChildren(
    ...messages.map((message) => {
      const item = document.createElement('li')
      item.textContent = message
      return item
    }),
  )
  uploadError.hidden = false
}

function showSummary(fileName, summary) {
  uploadStatus.textContent = `Loaded ${fileName}.`
  document.getElementById('summary-file').textContent = `(${fileName})`
  document.getElementById('summary-total').textContent = formatCount(summary.totalRows)
  document.getElementById('summary-dropped').textContent = formatCount(summary.droppedRows)
  document.getElementById('summary-valid').textContent = formatCount(summary.validRows)
  const reasons = [
    [summary.missing, 'missing a value'],
    [summary.invalidDates, 'with an invalid date'],
    [summary.invalidRates, 'with an invalid exchange rate'],
    [summary.duplicates, 'with a duplicate date'],
  ]
    .filter(([count]) => count > 0)
    .map(([count, reason]) => `${plural(count, 'row')} ${reason}`)
  document.getElementById('summary-details').textContent = reasons.length
    ? `Dropped: ${reasons.join(' · ')}.`
    : 'No rows were dropped.'
  uploadSummary.hidden = false
}

function parseInWorker(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./csvWorker.js', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = ({ data }) => {
      worker.terminate()
      if (data.ok) resolve(data.result)
      else reject(new ValidationError(data.messages))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      worker.terminate()
      reject(new Error('CSV worker failed'))
    }
    worker.postMessage(file)
  })
}

async function parseOnMainThread(file) {
  let text
  try {
    text = await file.text()
  } catch {
    throw new ValidationError([MESSAGES.readError])
  }
  return parseExchangeRateCsv(text)
}

let loadId = 0

async function handleFile(file) {
  if (!file) return
  const id = ++loadId
  uploadError.hidden = true
  uploadSummary.hidden = true
  const fileError = validateFile(file)
  if (fileError) {
    showError(file.name, [fileError])
    return
  }
  uploadStatus.textContent = `Loading ${file.name}...`
  dropZone.setAttribute('aria-busy', 'true')
  if (chartReady()) setChartLoading(true, 150)
  try {
    let result
    try {
      result = await parseInWorker(file)
    } catch (error) {
      if (error instanceof ValidationError) throw error
      result = await parseOnMainThread(file)
    }
    if (id !== loadId) return
    allPoints = toChartPoints(result.points)
    renderRange()
    showSummary(file.name, result.summary)
  } catch (error) {
    if (id !== loadId) return
    showError(
      file.name,
      error instanceof ValidationError ? error.messages : [MESSAGES.readError],
    )
  } finally {
    if (id === loadId) {
      dropZone.removeAttribute('aria-busy')
      if (chartReady()) setChartLoading(false)
    }
  }
}

fileInput.addEventListener('change', () => {
  handleFile(fileInput.files[0])
  fileInput.value = ''
})

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault()
  setDragHover(true)
})

dropZone.addEventListener('dragleave', (event) => {
  if (!dropZone.contains(event.relatedTarget)) {
    setDragHover(false)
  }
})

dropZone.addEventListener('drop', (event) => {
  event.preventDefault()
  setDragHover(false)
  handleFile(event.dataTransfer.files[0])
})
