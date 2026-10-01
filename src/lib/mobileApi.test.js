import test from 'node:test'
import assert from 'node:assert/strict'
import { exactBarcode, mobileApi, MobileApiError, priceValue, stockPayload, verifyStockReceipt } from './mobileApi.js'

const draft = { batchNo: ' B-1 ', expiry: '2028-12-31', qty: '7', purchasePrice: '4.25', salePrice: '5.50' }
const payload = () => stockPayload('medicine-id', draft, 'test-request-id')
const response = request => ({
  receipt: { id: request.requestId, requestId: request.requestId, medicineId: request.medicineId, batchId: 'batch-id', qty: request.qty },
  batch: { id: 'batch-id', medicineId: request.medicineId, batchNo: request.batchNo, expiry: request.expiry, qty: request.qty, purchasePrice: request.purchasePrice, salePrice: request.salePrice },
})

test('exact barcode preserves leading zeros and case and never matches blank barcodes', () => {
  const medicines = [{ id: 'zero', barcode: '001234' }, { id: 'plain', barcode: '1234' }, { id: 'case', barcode: 'aB9' }, { id: 'blank', barcode: '' }]
  assert.equal(exactBarcode(medicines, '001234').id, 'zero')
  assert.equal(exactBarcode(medicines, '1234').id, 'plain')
  for (const barcode of ['', 1234, ' 001234', 'AB9']) assert.equal(exactBarcode(medicines, barcode), undefined)
})

test('stock payload validates real dates, money and whole stock units', () => {
  assert.deepEqual(payload(), { medicineId: 'medicine-id', batchNo: 'B-1', expiry: '2028-12-31', qty: 7, purchasePrice: 4.25, salePrice: 5.5, requestId: 'test-request-id' })
  assert.equal(Object.isFrozen(payload()), true)
  for (const overrides of [{ qty: '1.5' }, { qty: 0 }, { qty: 1000001 }, { expiry: '2027-02-29' }, { expiry: 'bad' }, { batchNo: ' ' }, { purchasePrice: '-1' }, { salePrice: '1.001' }, { salePrice: '' }]) {
    assert.throws(() => stockPayload('medicine-id', { ...draft, ...overrides }, 'test-request-id'))
  }
  assert.equal(stockPayload('medicine-id', { ...draft, expiry: '2028-02-29' }, 'test-request-id').qty, 7)
  assert.equal(priceValue('0'), 0)
  assert.throws(() => priceValue('Infinity'))
})

test('receipt must identify the same request, medicine, quantity and exact batch details', () => {
  const request = payload()
  assert.equal(verifyStockReceipt(response(request), request).requestId, request.requestId)
  for (const invalid of [null, {}, { ...response(request), receipt: { ...response(request).receipt, qty: 8 } }, { ...response(request), receipt: { ...response(request).receipt, requestId: 'other-request' } }, { ...response(request), batch: { ...response(request).batch, salePrice: 1 } }]) {
    assert.throws(() => verifyStockReceipt(invalid, request), error => error instanceof MobileApiError && error.uncertain)
  }
})

test('API uses same-origin cookies and no-store; an uncertain stock retry retains the exact body', async t => {
  const calls = []
  const request = payload()
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    if (calls.length === 1) throw new TypeError('Network disconnected after commit')
    return new Response(JSON.stringify(response(request)), { status: 200 })
  })
  await assert.rejects(mobileApi('/stock', { method: 'POST', body: request }), error => error.uncertain === true)
  const receipt = verifyStockReceipt(await mobileApi('/stock', { method: 'POST', body: request }), request)
  assert.equal(receipt.qty, 7)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].options.body, calls[1].options.body)
  assert.equal(calls[0].url, '/api/mobile/stock')
  assert.equal(calls[0].options.credentials, 'same-origin')
  assert.equal(calls[0].options.cache, 'no-store')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
})

test('API distinguishes rejected writes, expired sessions and uncertain responses', async t => {
  for (const [status, uncertain] of [[400, false], [401, false], [403, false], [409, false], [503, true]]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Rejected' }), { status }))
    await assert.rejects(mobileApi('/stock', { method: 'POST', body: payload() }), error => error.status === status && error.uncertain === uncertain)
    mock.mock.restore()
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Wrong proxy</html>', { status: 200 }))
  await assert.rejects(mobileApi('/stock', { method: 'POST', body: payload() }), error => error.uncertain === true)
})

test('offline requests never fetch or queue a write', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator })
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not be called') })
  await assert.rejects(mobileApi('/stock', { method: 'POST', body: payload() }), error => /offline/i.test(error.message) && !error.uncertain)
  assert.equal(fetch.mock.callCount(), 0)
})
