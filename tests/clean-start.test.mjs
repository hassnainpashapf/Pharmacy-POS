import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// A brand-new business (nothing stored) starts empty; demo data is an explicit, removable choice.
let server
let db
const store = new Map()
const DB_KEY = 'pharmacy_pos_db_v2'
const savedDb = () => store.get(DB_KEY)

before(async () => {
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, value) => { store.set(k, String(value)) },
    removeItem: (k) => { store.delete(k) },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
  db = await server.ssrLoadModule('/src/lib/db.jsx')
})
after(async () => { await server?.close() })

test('a fresh install contains no demo medicines, customers, suppliers, sales or users', () => {
  const d = db.getDB()
  for (const key of ['medicines', 'batches', 'suppliers', 'customers', 'sales', 'purchases', 'users', 'expenses', 'returns']) {
    assert.deepEqual(d[key], [], key)
  }
  assert.equal(d.startedClean, true)
  assert.deepEqual(d.branches.map((b) => b.id), ['main'])
  assert.deepEqual(d.counters.map((c) => c.id), ['counter-1'])
  assert.ok(d.plugins.length > 0)
  assert.equal(db.isFirstRun(), true)
})

test('after the owner is created the data is still empty and reloads empty', () => {
  db.createOwnerAccount({ name: 'Sara Khan', username: 'sara', business: 'City Care', password: 'a-long-secret-1', confirm: 'a-long-secret-1' })
  assert.equal(db.getDB().session.role, 'ADMIN')
  const stored = JSON.parse(savedDb())
  assert.equal(stored.medicines.length, 0)
  assert.equal(stored.sales.length, 0)
  assert.equal(stored.users.length, 1)
  assert.equal(stored.settings.pharmacyName, 'City Care')
  assert.equal(stored.startedClean, true)
})

test('demo data loads into an empty business, is flagged, and can be removed completely', () => {
  assert.equal(db.demoDataStatus().loaded, false)
  const st = db.loadDemoData()
  assert.equal(st.loaded, true)
  const d = db.getDB()
  assert.ok(d.medicines.length > 30)
  assert.ok(d.sales.length >= 150)
  assert.ok(d.medicines.every((m) => m.demo === true))
  assert.ok(d.sales.every((s) => s.demo === true))
  assert.throws(() => db.loadDemoData(), /already loaded/)
  db.removeDemoData()
  const after = db.getDB()
  for (const key of ['medicines', 'batches', 'suppliers', 'customers', 'sales']) assert.deepEqual(after[key], [], key)
  assert.equal(after.users.length, 1)
  // a reload does not bring the demo data back (no migration on a clean start)
  assert.equal(JSON.parse(savedDb()).medicines.length, 0)
})

test('removal is refused once demo stock was sold in a real sale; loading is refused when real sales exist', () => {
  db.loadDemoData()
  const d = db.getDB()
  const med = d.medicines[0]
  assert.ok(db.stockOf(med.id) > 0)
  db.completeSale({ items: [{ medicineId: med.id, qty: 1, price: med.salePrice }], payMethod: 'CASH' })
  assert.throws(() => db.removeDemoData(), /already used/)
  assert.equal(db.getDB().medicines.length > 30, true)
  assert.throws(() => db.loadDemoData(), /real sales/)
})

test('a non-admin cannot load or remove demo data', () => {
  const d = db.getDB()
  const keep = d.session
  d.session = { ...keep, role: 'CASHIER' }
  assert.throws(() => db.loadDemoData(), /owner/)
  assert.throws(() => db.removeDemoData(), /owner/)
  d.session = keep
})

test('a central (hub) business partition starts empty, and its users are never asked to change a default password', async () => {
  const { usesDefaultPassword } = await import('../src/lib/defaultPasswords.js')
  const { hash } = await import('../src/lib/passwordHash.js')
  const session = db.syncCloudSession({ id: 'central_lab1_u1', username: 'hubuser', name: 'Hub User', role: 'ADMIN', tenantId: 'central-lab1', pharmacyName: 'Hub Pharmacy' }, 'manager123')
  assert.equal(session.cloudConnected, true)
  const d = db.getDB()
  for (const key of ['medicines', 'batches', 'suppliers', 'customers', 'sales']) assert.deepEqual(d[key], [], key)
  assert.equal(d.users.length, 1)
  assert.equal(d.users[0].passHash, hash('manager123'))
  assert.equal(usesDefaultPassword(d.users[0]), false)
})
