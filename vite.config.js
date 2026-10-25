import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const COMPRESSIBLE = /\.(js|css|html|svg|json)$/

// Writes .gz and .br copies next to each text asset so static hosts can serve them precompressed.
function precompress() {
  let outDir
  return {
    name: 'precompress',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      for (const name of readdirSync(outDir, { recursive: true })) {
        if (!COMPRESSIBLE.test(name)) continue
        const path = join(outDir, name)
        const source = readFileSync(path)
        writeFileSync(`${path}.gz`, gzipSync(source, { level: 9 }))
        writeFileSync(
          `${path}.br`,
          brotliCompressSync(source, {
            params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
          }),
        )
      }
    },
  }
}

export default defineConfig({
  // Relative URLs let the build be hosted from any folder or CDN path.
  base: './',
  plugins: [tailwindcss(), precompress()],
  build: {
    sourcemap: true,
  },
  test: {
    include: ['tests/unit/**/*.test.js'],
  },
})
