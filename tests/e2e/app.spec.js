import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const SAMPLE = fileURLToPath(new URL('../../DEXUSEU.csv', import.meta.url))

const csvFile = (name, lines) => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(lines.join('\n')),
})

let pageErrors

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })
  await page.goto('/')
})

test.afterEach(() => {
  expect(pageErrors).toEqual([])
})

const chart = (page) => page.locator('#exchange-rate-chart')
const rangeSummary = (page) => page.locator('#range-summary')

async function uploadSample(page) {
  await page.locator('#file-input').setInputFiles(SAMPLE)
  await expect(page.locator('#upload-status')).toHaveText('Loaded DEXUSEU.csv.')
}

test('shows the app with a built-in sample chart', async ({ page }) => {
  await expect(page).toHaveTitle(/USD\/EUR Exchange Rate/i)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/USD\/EUR exchange rate/i)
  await expect(chart(page)).toBeVisible()
  await expect(chart(page)).toHaveAttribute('aria-label', /USD\/EUR exchange rate line chart from/)
  await expect(page.getByRole('button', { name: '1 Year' })).toHaveAttribute('aria-pressed', 'true')
})

test('loads the sample CSV and shows a processing summary', async ({ page }) => {
  await uploadSample(page)
  await expect(page.locator('#summary-total')).toHaveText('6,950')
  await expect(page.locator('#summary-dropped')).toHaveText('268')
  await expect(page.locator('#summary-valid')).toHaveText('6,682')
  await expect(rangeSummary(page)).toContainText('Aug 22, 2024 – Aug 22, 2025 · 251 data points')
})

test('every time range filters the sample data', async ({ page }) => {
  await uploadSample(page)
  const ranges = [
    ['5 Years', 'Aug 24, 2020 – Aug 22, 2025 · 1,248 data points'],
    ['10 Years', 'Aug 24, 2015 – Aug 22, 2025 · 2,498 data points'],
    ['Max', 'Jan 4, 1999 – Aug 22, 2025 · 6,682 data points'],
    ['1 Year', 'Aug 22, 2024 – Aug 22, 2025 · 251 data points'],
  ]
  for (const [name, summary] of ranges) {
    const button = page.getByRole('button', { name, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(rangeSummary(page)).toContainText(summary)
    await expect(chart(page)).toHaveAttribute('aria-label', new RegExp(summary.split(' · ')[1]))
  }
})

test('drag and drop uploads a file', async ({ page }) => {
  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    const rows = ['observation_date,DEXUSEU']
    for (let day = 1; day <= 12; day++) rows.push(`2024-01-${String(day).padStart(2, '0')},1.1`)
    transfer.items.add(new File([rows.join('\n')], 'dropped.csv', { type: 'text/csv' }))
    return transfer
  })
  await page.locator('#drop-zone').dispatchEvent('dragover', { dataTransfer })
  await page.locator('#drop-zone').dispatchEvent('drop', { dataTransfer })
  await expect(page.locator('#upload-status')).toHaveText('Loaded dropped.csv.')
  await expect(page.locator('#summary-valid')).toHaveText('12')
})

test('invalid files show errors and keep the current chart', async ({ page }) => {
  await uploadSample(page)
  const before = await rangeSummary(page).textContent()
  const error = page.locator('#upload-error')

  const cases = [
    [{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }, 'Please upload a CSV file'],
    [csvFile('empty.csv', ['']), 'The uploaded file is empty'],
    [csvFile('columns.csv', ['date,rate', '2024-01-01,1.1']), "CSV must contain 'observation_date' and 'DEXUSEU' columns"],
    [csvFile('few.csv', ['observation_date,DEXUSEU', '2024-01-01,1.1', '2024-02-30,1.2', '2024-01-03,-1']), 'At least 10 valid data points required'],
  ]
  for (const [file, message] of cases) {
    await page.locator('#file-input').setInputFiles(file)
    await expect(error).toBeVisible()
    await expect(page.locator('#error-title')).toHaveText(`Could not load ${file.name}`)
    await expect(page.locator('#error-list')).toContainText(message)
    await expect(rangeSummary(page)).toHaveText(before)
  }

  await uploadSample(page)
  await expect(error).toBeHidden()
})

test('file names containing HTML are shown as text', async ({ page }) => {
  await page.locator('#file-input').setInputFiles(csvFile('<img src=x onerror=alert(1)>.csv', ['a,b']))
  await expect(page.locator('#error-title')).toHaveText('Could not load <img src=x onerror=alert(1)>.csv')
  await expect(page.locator('#upload-error img')).toHaveCount(0)
})

test('keyboard navigation reads out exact values and zooms', async ({ page }) => {
  await uploadSample(page)
  await chart(page).focus()
  await expect(page.locator('#chart-keyboard-help')).toBeVisible()
  const announcer = page.locator('#chart-announcer')

  await page.keyboard.press('End')
  await expect(announcer).toHaveText('Aug 22, 2025: 1.1713 USD per EUR')
  await page.keyboard.press('ArrowLeft')
  await expect(announcer).toHaveText('Aug 21, 2025: 1.1605 USD per EUR')
  await page.keyboard.press('Home')
  await expect(announcer).toHaveText('Aug 22, 2024: 1.1114 USD per EUR')

  await page.keyboard.press('+')
  await expect(page.locator('#reset-zoom')).toBeVisible()
  await expect(rangeSummary(page)).toContainText('Drag to pan')
  await page.keyboard.press('0')
  await expect(page.locator('#reset-zoom')).toBeHidden()
})

test('tab order reaches every control with a visible focus outline', async ({ page, browserName }) => {
  // Safari only tabs to buttons when "Press Tab to highlight each item" is enabled.
  test.skip(browserName === 'webkit', 'WebKit skips buttons when tabbing by default')
  const expected = ['1 Year', '5 Years', '10 Years', 'Max', 'Fullscreen', 'chart']
  await page.locator('#file-input').focus()
  for (const name of expected) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      const style = getComputedStyle(el)
      return {
        name: el.id === 'exchange-rate-chart' ? 'chart' : el.textContent.trim(),
        outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
      }
    })
    expect(focused).toEqual({ name, outline: true })
  }
})

test('hovering draws the tooltip and crosshair, leaving clears them', async ({ page }) => {
  await uploadSample(page)
  // Mouse input only reaches elements inside the viewport.
  await chart(page).scrollIntoViewIfNeeded()
  const box = await chart(page).boundingBox()
  await page.mouse.move(1, 1)
  await page.waitForTimeout(600)
  const idle = await chart(page).screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(600)
  const hovered = await chart(page).screenshot()
  expect(hovered.equals(idle)).toBe(false)
  await page.mouse.move(1, 1)
  await page.waitForTimeout(1000)
  expect((await chart(page).screenshot()).equals(idle)).toBe(true)
})

test('mouse wheel zooms, drag pans and reset restores the range', async ({ page }) => {
  await uploadSample(page)
  // Mouse input only reaches elements inside the viewport.
  await chart(page).scrollIntoViewIfNeeded()
  const box = await chart(page).boundingBox()
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(center.x, center.y)
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -200)
  await expect(page.locator('#reset-zoom')).toBeVisible()
  await expect(rangeSummary(page)).toContainText('Drag to pan')

  const zoomed = await rangeSummary(page).textContent()
  await page.mouse.down()
  await page.mouse.move(center.x + 200, center.y, { steps: 10 })
  await page.mouse.up()
  await expect(rangeSummary(page)).not.toHaveText(zoomed)

  await page.locator('#reset-zoom').click()
  await expect(page.locator('#reset-zoom')).toBeHidden()
  await expect(rangeSummary(page)).toContainText('Aug 22, 2024 – Aug 22, 2025 · 251 data points')
})

test('fullscreen opens, keeps controls usable and closes with Escape', async ({ page }) => {
  await uploadSample(page)
  const toggle = page.locator('#fullscreen-toggle')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#fullscreen-label')).toHaveText('Exit fullscreen')
  await expect(page.locator('#upload-section')).toHaveJSProperty('inert', true)

  await page.getByRole('button', { name: 'Max' }).click()
  await expect(rangeSummary(page)).toContainText('6,682 data points')

  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#upload-section')).toHaveJSProperty('inert', false)
})

test('layout fits the screen without sideways scrolling', async ({ page }) => {
  await uploadSample(page)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
  const canvas = await chart(page).boundingBox()
  expect(canvas.width).toBeGreaterThan(200)
  expect(canvas.height).toBeGreaterThanOrEqual(380)
})

test('loading skeleton clears once the chart is drawn', async ({ page }) => {
  const loading = page.locator('#chart-loading')
  await expect(loading).toHaveClass(/is-hidden/)
  await uploadSample(page)
  await expect(loading).toHaveClass(/is-hidden/)
  await page.getByRole('button', { name: 'Max' }).click()
  await expect(rangeSummary(page)).toContainText('6,682 data points')
  await expect(loading).toHaveClass(/is-hidden/)
  await expect(chart(page)).toHaveAttribute('aria-busy', 'false')
})

test('chart resizes with the window', async ({ page }) => {
  const wide = (await chart(page).boundingBox()).width
  await page.setViewportSize({ width: 600, height: 900 })
  await expect.poll(async () => (await chart(page).boundingBox()).width).toBeLessThan(wide)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('uploads still work when the background worker cannot load', async ({ page }) => {
  await page.route('**/csvWorker*', (route) => route.abort())
  await uploadSample(page)
  await expect(page.locator('#summary-valid')).toHaveText('6,682')
  pageErrors = pageErrors.filter((message) => !/Failed to load|csvWorker|worker/i.test(message))
})

// Makes the next canvas text measurement throw, which happens while a zoomed chart is drawn.
async function failNextTextMeasurement(page) {
  await page.evaluate(() => {
    const measure = CanvasRenderingContext2D.prototype.measureText
    window.__failNextMeasure = true
    CanvasRenderingContext2D.prototype.measureText = function (...args) {
      if (window.__failNextMeasure) {
        window.__failNextMeasure = false
        throw new Error('Injected zoom failure')
      }
      return measure.apply(this, args)
    }
  })
}

test('a failed mouse-wheel zoom falls back to the full range', async ({ page }) => {
  await uploadSample(page)
  await chart(page).scrollIntoViewIfNeeded()
  const box = await chart(page).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -300)
  await expect(page.locator('#reset-zoom')).toBeVisible()
  await failNextTextMeasurement(page)
  await page.mouse.wheel(0, -300)
  await expect.poll(() => page.evaluate(() => window.__failNextMeasure)).toBe(false)
  await expect(page.locator('#reset-zoom')).toBeHidden()
  await expect(rangeSummary(page)).toContainText('251 data points')
  await expect(page.locator('#chart-error')).toBeHidden()
})

test('a failed keyboard zoom falls back to the full range', async ({ page }) => {
  await uploadSample(page)
  await expect(rangeSummary(page)).toContainText('251 data points')
  await chart(page).focus()
  await page.keyboard.press('+')
  await expect(page.locator('#reset-zoom')).toBeVisible()
  // Let the zoom animation finish so its frames don't trigger the injected failure early.
  await page.waitForTimeout(600)
  await failNextTextMeasurement(page)
  await page.keyboard.press('+')
  expect(await page.evaluate(() => window.__failNextMeasure)).toBe(false)
  await expect(page.locator('#reset-zoom')).toBeHidden()
  await expect(rangeSummary(page)).toContainText('251 data points')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#chart-announcer')).not.toBeEmpty()
})

test('shows a clear message when the chart cannot be drawn', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null
  })
  await page.reload()
  await expect(page.locator('#chart-error')).toHaveText(
    'Unable to display chart. Please refresh and try again',
  )
  await expect(chart(page)).toBeHidden()
  await uploadSample(page)
  await expect(page.locator('#summary-valid')).toHaveText('6,682')
  pageErrors = pageErrors.filter((message) => !/Failed to create chart/i.test(message))
})
