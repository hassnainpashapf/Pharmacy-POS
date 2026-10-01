import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { mobileApi, exactBarcode, stockPayload, verifyStockReceipt } from './mobileApi.js'

test('mobile client against an isolated backend: setup, exact scan, uncertain retry, grants and logout', { timeout: 20000 }, async t => {
  const child = spawn('python3', ['-u', '-c', `
import signal, sys, tempfile
from pathlib import Path
from server.mobile_server import InventoryServer
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
with tempfile.TemporaryDirectory(prefix="mobile-client-test-") as folder:
    server = InventoryServer(("127.0.0.1", 0), Path(folder) / "inventory.sqlite3", ["http://localhost:5173"], password_rounds=1000)
    server.allowed_hosts.add("127.0.0.1:" + str(server.server_address[1]))
    print(server.server_address[1], flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
`], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] })
  let diagnostics = ''
  child.stderr.on('data', data => { diagnostics += data })
  t.after(async () => {
    if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit }
  })
  const lines = createInterface({ input: child.stdout })
  const [port] = await Promise.race([
    once(lines, 'line'),
    once(child, 'exit').then(() => { throw new Error(`Isolated backend failed: ${diagnostics}`) }),
  ])
  const realFetch = globalThis.fetch
  let cookie = ''
  let dropStockResponse = false
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    const response = await realFetch(`http://127.0.0.1:${port}${path}`, {
      ...options, headers: { ...options.headers, Host: 'localhost:5173', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
    })
    const nextCookie = response.headers.get('set-cookie')
    if (nextCookie) cookie = nextCookie.split(';')[0]
    if (dropStockResponse && path.endsWith('/stock')) { dropStockResponse = false; await response.arrayBuffer(); throw new TypeError('Simulated response loss after server commit') }
    return response
  })
  assert.equal((await mobileApi('/status')).setupRequired, true)
  await assert.rejects(mobileApi('/session'), error => error.status === 401)
  const password = randomBytes(24).toString('hex')
  const superadmin = await mobileApi('/setup', { method: 'POST', body: { username: 'superadmin', name: 'Super Admin', password } })
  assert.equal(superadmin.user.role, 'SUPERADMIN')
  const tenantRes = await mobileApi('/platform/tenants', {
    method: 'POST',
    body: { name: 'Test Pharmacy', adminName: 'Test Owner', email: 'owner@test.com', password }
  })
  assert.equal(tenantRes.admin.role, 'ADMIN')
  // Login directly with Email without appId!
  const loginRes = await mobileApi('/login', { method: 'POST', body: { email: 'owner@test.com', password } })
  assert.equal(loginRes.user.role, 'ADMIN')
  const adminCookie = cookie
  const initial = await mobileApi('/inventory')
  assert.equal(initial.medicines.length, 0)
  assert.equal(initial.permissions.canManageInventory, true)
  const { medicine } = await mobileApi('/medicines', { method: 'POST', body: { name: 'Isolated test product', barcode: '001234567890', packSize: 10, purchasePrice: 4.25, salePrice: 5.5 } })
  assert.equal(exactBarcode((await mobileApi('/inventory')).medicines, '001234567890').id, medicine.id)
  const payload = stockPayload(medicine.id, { batchNo: 'B1', expiry: '2028-12-31', qty: '7', purchasePrice: '4.75', salePrice: '6.00' })
  dropStockResponse = true
  await assert.rejects(mobileApi('/stock', { method: 'POST', body: payload }), error => error.uncertain)
  assert.equal(verifyStockReceipt(await mobileApi('/stock', { method: 'POST', body: payload }), payload).qty, 7)
  const current = await mobileApi('/inventory')
  assert.equal(current.batches[0].qty, 7, 'identical retry must not duplicate stock or multiply by pack size')
  assert.equal(current.medicines[0].purchasePrice, 4.25, 'actual stock price must not replace saved defaults')
  const staffPassword = randomBytes(24).toString('hex')
  const { user: staff } = await mobileApi('/users', { method: 'POST', body: { username: 'teststaff', name: 'Test Staff', password: staffPassword, role: 'MANAGER' } })
  await mobileApi('/logout', { method: 'POST' })
  await assert.rejects(mobileApi('/inventory'), error => error.status === 401)
  await mobileApi('/login', { method: 'POST', body: { username: 'teststaff', password: staffPassword } })
  const staffCookie = cookie
  assert.equal((await mobileApi('/inventory')).permissions.canManageInventory, false)
  await assert.rejects(mobileApi('/stock', { method: 'POST', body: { ...payload, requestId: 'denied-staff-request' } }), error => error.status === 403)
  // The admin cookie was explicitly logged out, so authenticate again.
  cookie = adminCookie
  await mobileApi('/login', { method: 'POST', body: { email: 'owner@test.com', password } })
  const newAdminCookie = cookie
  await mobileApi(`/users/${staff.id}`, { method: 'PATCH', body: { canManageInventory: true } })
  cookie = staffCookie
  assert.equal((await mobileApi('/inventory')).permissions.canManageInventory, true)
  cookie = newAdminCookie
  await mobileApi(`/users/${staff.id}`, { method: 'PATCH', body: { disabled: true } })
  cookie = staffCookie
  await assert.rejects(mobileApi('/session'), error => error.status === 401)
})
