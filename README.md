# USD/EUR exchange rate

A web app that charts the USD/EUR exchange rate from a CSV file you upload. The file is read in your browser and is never sent to a server.

## Features

- Upload a CSV by button or drag and drop. Rows with missing or invalid values are dropped, and a summary shows what was kept.
- Line chart with the date on the x-axis and USD per EUR on the y-axis.
- Time ranges: 1 Year, 5 Years, 10 Years and Max.
- Hover tooltip with the exact date and rate, plus a vertical crosshair.
- Zoom (mouse wheel), pan (drag), reset zoom and fullscreen.
- Keyboard and screen-reader support.

## CSV format

The file needs an `observation_date` column and a `DEXUSEU` column. Other columns are ignored.

```csv
observation_date,DEXUSEU
1999-01-04,1.1812
1/5/1999,1.1760
1/6/1999,
```

- Dates may be `YYYY-MM-DD` or `M/D/YYYY`.
- Empty cells and `.` count as missing values and are dropped.
- Limits: up to 10 MB, 10 to 50,000 valid rows.

`DEXUSEU.csv` in this folder is a sample from FRED.

## Development

Requires Node.js 20 or later (the current LTS release is recommended).

```bash
npm install
npm run dev        # start the dev server at http://localhost:5173
```

## Testing

```bash
npm test           # unit tests (Vitest): CSV validation and time-range filtering
npx playwright install   # one-off: download the test browsers
npm run test:e2e   # end-to-end tests (Playwright) against the production build
```

The end-to-end tests run in desktop Chromium, Firefox and WebKit. Phones and tablets are out of scope. Run a single browser with `npm run test:e2e -- --project=chromium`. If a test fails, `npx playwright show-report` opens the report.

On Windows, run the commands from a path with an upper-case drive letter (`C:\...`, not `c:\...`), or Vitest fails with `Cannot read properties of undefined (reading 'config')`.

## Production build

```bash
npm run build      # outputs to dist/
npm run preview    # serve dist/ at http://localhost:4173 to check it
```

The build:

- is minified, with content-hashed file names under `dist/assets/`;
- includes source maps (`.map`) for debugging;
- includes precompressed `.gz` and `.br` copies of each text file;
- uses relative paths, so `dist/` works from any folder or URL path;
- bundles only runtime libraries (Chart.js, date-fns, PapaParse, the zoom plugin). Development tools are not included.

## Deployment

`dist/` is a static site with no server-side code. Upload its contents to any static host.

- **Netlify / Vercel / Cloudflare Pages:** build command `npm run build`, output folder `dist`.
- **GitHub Pages:** publish the contents of `dist/` (for example with the `actions/deploy-pages` action). Relative paths mean no extra base-path setting is needed.
- **Amazon S3 + CloudFront, Azure Static Web Apps or similar:** upload `dist/`.
- **nginx or Apache:** copy `dist/` into the web root. To serve the precompressed files, enable `gzip_static on;` (and `brotli_static on;` if the Brotli module is installed) in nginx, or the equivalent rewrite rules in Apache.

Recommended caching:

- `assets/*`: `Cache-Control: public, max-age=31536000, immutable`. These file names change whenever their contents change.
- `index.html`: `Cache-Control: no-cache`, so visitors always get the newest asset links.

To keep the source maps private, delete `dist/**/*.map` before uploading. The app works without them.
