import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Render the actual module with its camera dependency isolated, without a DOM,
// camera permissions, a legacy login, or additional testing packages.
const built = await build({
  entryPoints: [fileURLToPath(new URL('./MobileInventory.jsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
  plugins: [{ name: 'stub-mobile-camera', setup(builder) {
    builder.onResolve({ filter: /BarcodeScanner$/ }, () => ({ path: 'scanner', namespace: 'mobile-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'mobile-test' }, () => ({ contents: 'export default function Scanner(){ return null }', loader: 'js' }))
  } }],
})
const module = { exports: {} }
new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
const { default: MobileInventory, StockForm } = module.exports
const noop = () => {}
const medicine = { id: 'medicine-id', name: 'Product', barcode: '001234', generic: 'Generic', form: 'Tablet', strength: '5mg', manufacturer: 'Maker', packSize: 10, purchasePrice: 4.25, salePrice: 5.5 }
const stock = { medicine, draft: { batchNo: 'B1', expiry: '2028-12-31', qty: '7', purchasePrice: '4.25', salePrice: '5.50' }, ownerId: 'user-id', confirmed: false, pending: null }
const renderStock = overrides => renderToStaticMarkup(React.createElement(StockForm, { stock, setStock: noop, online: true, canWrite: true, busy: false, onSubmit: noop, onCancel: noop, userId: 'user-id', ...overrides }))

test('independent mobile shell renders the separation banner before login', () => {
  const html = renderToStaticMarkup(React.createElement(MobileInventory))
  assert.match(html, /not automatically imported or synced/)
  assert.match(html, /Connecting to the shared inventory server/)
  assert.doesNotMatch(html, /admin123|localStorage\./)
})

test('stock form prefills saved details but requires explicit price and quantity verification', () => {
  const html = renderStock()
  assert.match(html, /001234/)
  assert.match(html, /Generic · Tablet · 5mg · Maker/)
  assert.match(html, /Saved defaults — verify before use/)
  assert.match(html, /Actual pharmacy buying price \/ unit \(Rs\)/)
  assert.match(html, /Retail price \/ unit for this batch \(Rs\)/)
  assert.match(html, /not multiplied by the pack size/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Confirm &amp; add stock/)
})

test('offline and read-only stock forms cannot submit even when confirmed', () => {
  for (const overrides of [{ online: false }, { canWrite: false }, { userId: 'another-account' }]) {
    const html = renderStock({ stock: { ...stock, confirmed: true }, ...overrides })
    assert.match(html, /<button[^>]*disabled=""[^>]*>Confirm &amp; add stock/)
  }
})

test('uncertain stock locks edits and cancellation, exposes retry with stable request ID', () => {
  const html = renderStock({ stock: { ...stock, confirmed: true, pending: { requestId: 'retained-stock-request' } } })
  assert.match(html, /retained-stock-request/)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /Retry same stock request/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Cancel/)
  assert.match(html, /Keep this tab open until resolved/)
})
