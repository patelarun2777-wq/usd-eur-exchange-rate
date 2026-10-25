import { MESSAGES, ValidationError, parseExchangeRateCsv } from './csv.js'

// Reads and parses the uploaded file off the main thread so large files don't freeze the page.
self.onmessage = async ({ data: file }) => {
  let text
  try {
    text = await file.text()
  } catch {
    self.postMessage({ ok: false, messages: [MESSAGES.readError] })
    return
  }
  try {
    self.postMessage({ ok: true, result: parseExchangeRateCsv(text) })
  } catch (error) {
    self.postMessage({
      ok: false,
      messages: error instanceof ValidationError ? error.messages : [MESSAGES.readError],
    })
  }
}
