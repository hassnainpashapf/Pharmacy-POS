import { mkdir, copyFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const output = new URL('../public/ocr/', import.meta.url)
await mkdir(output, { recursive: true })
const core = dirname(require.resolve('tesseract.js-core/package.json'))
for (const name of ['tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm', 'LICENSE']) {
  await copyFile(join(core, name), new URL(name, output))
}
await copyFile(require.resolve('tesseract.js/dist/worker.min.js'), new URL('worker.min.js', output))
const language = dirname(require.resolve('@tesseract.js-data/eng/package.json'))
await copyFile(join(language, '4.0.0_best_int/eng.traineddata.gz'), new URL('eng.traineddata.gz', output))
console.log('Local OCR worker/model ready (no external image upload).')
