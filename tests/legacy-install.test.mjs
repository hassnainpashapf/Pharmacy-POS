import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { hash } from '../src/lib/passwordHash.js'

// An install that already has data (no startedClean flag) is loaded exactly as before: nothing is removed,
// users stay as they are, and the old catalogue/demo-history migration still applies.
let server
let db
const store = new Map()

before(async () => {
  store.set('pharmacy_pos_db_v2', JSON.stringify({
    medicines: [{ id: 'm1', name: 'Existing Medicine', barcode: '111', salePrice: 10, purchasePrice: 5 }],
    batches: [], suppliers: [], customers: [], sales: [],
    users: [{ id: 'usr_manager', username: 'manager', email: 'manager@pharmacy.com', passHash: hash('manager123'), name: 'Tariq', role: 'MANAGER', active: true }],
    settings: { pharmacyName: 'Old Pharmacy' },
  }))
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
  db = await server.ssrLoadModule('/src/lib/db.jsx')
})
after(async () => { await server?.close() })

test('existing data and users are kept; the older migration still runs for installs that already had demo data', () => {
  const d = db.getDB()
  assert.equal(d.startedClean, undefined)
  assert.ok(d.medicines.some((m) => m.id === 'm1'))
  assert.deepEqual(d.users.map((u) => u.username), ['manager'])
  assert.equal(d.users[0].passHash, hash('manager123'))
  assert.ok(d.medicines.length > 1, 'catalogue migration unchanged for older installs')
  assert.ok(d.sales.length > 0, 'demo history migration unchanged for older installs')
  assert.equal(db.isFirstRun(), false)
})

test('the default-password detection sees the old manager account', async () => {
  const { usersWithDefaultPassword } = await import('../src/lib/defaultPasswords.js')
  assert.deepEqual(usersWithDefaultPassword(db.getDB().users).map((u) => u.username), ['manager'])
})
