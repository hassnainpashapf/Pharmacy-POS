import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter, MemoryRouter } from 'react-router'

let server
let dashboard
let inventory
let medicines
let database
const originalStorage = globalThis.localStorage
const initial = {
  currentBranch: 'a', medicines: [], batches: [], sales: [],
  branches: [{ id: 'a', name: 'Fixture Branch A' }, { id: 'b', name: 'Fixture Branch B' }],
  users: [{ id: 'test', username: 'test', name: 'Fixture User', active: true }],
  plugins: [{ id: 'fixture-plugin', enabled: false }],
}

before(async () => {
  // Isolated in-memory storage: never read or modify a user's browser data.
  let saved = JSON.stringify(initial)
  globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value } }
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
  dashboard = await server.ssrLoadModule('/src/pages/Dashboard.jsx')
  inventory = await server.ssrLoadModule('/src/pages/Inventory.jsx')
  medicines = await server.ssrLoadModule('/src/pages/Medicines.jsx')
  database = await server.ssrLoadModule('/src/lib/db.jsx')
})

after(async () => {
  await server?.close()
  if (originalStorage === undefined) delete globalThis.localStorage
  else globalThis.localStorage = originalStorage
})

const now = new Date(2026, 8, 30, 12)
const batch = (id, qty, expiry, status = 'ACTIVE', extra = {}) => ({ id, medicineId: 'm1', batchNo: id, qty, expiry, status, branchId: 'a', ...extra })
const stockFixture = () => ({
  currentBranch: 'a',
  medicines: [{ id: 'm1', name: 'Fixture A', minStock: 40 }, { id: 'm2', name: 'Fixture B', minStock: 1 }, { id: 'm3', name: 'Fixture C', minStock: 0 }],
  batches: [
    batch('in-30', 10, '2026-10-30', 'AVAILABLE'),
    batch('today', 5, '2026-09-30'),
    batch('in-90', 20, '2026-12-29'),
    batch('past', 7, '2026-09-29'),
    batch('damaged', 3, '2027-01-01', 'DAMAGED', { medicineId: 'm2' }),
    batch('returned', 2, '2027-01-01', 'RETURNED'),
    batch('reserved', 4, '2027-01-01', 'RESERVED'),
    batch('invalid', 6, '2026-02-30'),
    batch('unknown-status', 8, '2027-01-01', 'OTHER'),
    batch('manual-expired', 9, '2026-10-01', 'EXPIRED'),
    batch('zero', 0, '2027-01-01'), batch('negative', -3, '2027-01-01'), batch('bad-qty', 'NaN', '2027-01-01'),
    batch('other-branch', 999, '2027-01-01', 'ACTIVE', { branchId: 'b' }),
    batch('untagged', 11, '2027-01-01', 'ACTIVE', { branchId: undefined }),
  ],
})

test('pharmacist stock projections scope branches and separate dated available units from held/expired stock', () => {
  const fixture = stockFixture()
  const original = JSON.stringify(fixture)
  const result = dashboard.pharmacistDashboardData(fixture, now)
  assert.equal(result.totalUnits, 74)
  assert.equal(result.availableUnits, 35)
  assert.equal(result.expiredUnits, 16)
  assert.equal(result.heldUnits, 23)
  assert.equal(result.nearExpiryUnits, 15)
  assert.equal(result.statuses.reduce((total, status) => total + status.count, 0), 74)
  assert.ok(Math.abs(result.statuses.reduce((total, status) => total + status.pct, 0) - 100) < 1e-9)
  assert.deepEqual(result.replenishment.map(({ id, qty, minimum }) => [id, qty, minimum]), [['m2', 0, 1], ['m3', 0, 0], ['m1', 35, 40]])
  assert.equal(JSON.stringify(fixture), original, 'metrics must never mutate stored records')
  const all = dashboard.pharmacistDashboardData({ ...fixture, currentBranch: 'ALL' }, now)
  assert.equal(all.totalUnits, 1084)
  assert.equal(all.availableUnits, 1045)
})

test('expiry buckets retain invalid dates, exact 30/90-day boundaries and stock held past expiry', () => {
  const result = dashboard.pharmacistDashboardData(stockFixture(), now)
  assert.deepEqual(result.expiryBuckets.map(({ count, batches }) => [count, batches]), [[7, 1], [24, 3], [20, 1], [17, 4], [6, 1]])
  assert.deepEqual(result.expiryQueue.map(({ id, days }) => [id, days]), [['today', 0], ['in-30', 30], ['in-90', 90]])
  const missing = dashboard.pharmacistDashboardData({ batches: [batch('missing', 2, null), batch('nonsense', 3, 'nonsense')] }, now)
  assert.equal(missing.availableUnits, 0)
  assert.equal(missing.heldUnits, 5)
  assert.equal(missing.expiryBuckets.at(-1).count, 5)
})

test('dispensing trend uses saved quantities after returns, local sale dates and selected branch only', () => {
  const sale = (id, date, qty, extra = {}) => ({ id, date, branchId: 'a', items: [{ medicineId: 'm1', qty }], ...extra })
  const fixture = {
    currentBranch: 'a',
    sales: [
      sale('today', '2026-09-30', 3, { items: [{ qty: 3 }, { qty: '2' }, { qty: -9 }, { qty: Infinity }] }),
      sale('yesterday', new Date(2026, 8, 29, 23, 59).toISOString(), 4),
      sale('previous-week', '2026-09-23', 8),
      sale('other', '2026-09-30', 99, { branchId: 'b' }),
      sale('untagged', '2026-09-30', 77, { branchId: undefined }),
      sale('future', '2026-10-01', 100), sale('old', '2026-09-16', 100),
      sale('invalid', '2026-02-30', 100), sale('missing', null, 100),
    ],
    returns: [{ saleId: 'today', items: [{ qty: 10 }] }],
  }
  const result = dashboard.pharmacistDashboardData(fixture, now)
  assert.equal(result.todayUnits, 5)
  assert.equal(result.sevenDayUnits, 9)
  assert.equal(result.dailyUnits.length, 14)
  assert.equal(result.dailyUnits[0].key, '2026-09-17')
  assert.equal(result.dailyUnits.reduce((sum, day) => sum + day.units, 0), 17)
  assert.equal(result.dailyUnits.reduce((sum, day) => sum + day.count, 0), 3)
  assert.equal(dashboard.pharmacistDashboardData({ ...fixture, currentBranch: 'ALL' }, now).todayUnits, 181)
})

test('empty stock/sales produces zero metrics and no invented activity', () => {
  const result = dashboard.pharmacistDashboardData({}, now)
  assert.equal(result.totalUnits, 0)
  assert.equal(result.todayUnits, 0)
  assert.equal(result.replenishment.length, 0)
  assert.equal(result.expiryQueue.length, 0)
  assert.ok(result.statuses.every(({ count, pct }) => count === 0 && pct === 0))
  assert.ok(result.dailyUnits.every(({ units, count }) => units === 0 && count === 0))
})

test('inventory rows preserve batch details, prices, stock status and accessible stock actions', () => {
  const html = renderToStaticMarkup(createElement(inventory.InventoryBatchRow, {
    batch: { ...batch('LOT-TEST', 12, '2026-10-30'), purchasePrice: 20, salePrice: 30, mfgDate: '2025-10-01' },
    medicine: { name: 'Fixture A', strength: '10 mg', dosageForm: 'Tablet' }, now,
    onReclassify: () => {},
  }))
  assert.match(html, /<tr /)
  assert.equal((html.match(/<td /g) || []).length, 9)
  for (const expected of ['Fixture A', 'Tablet', 'LOT-TEST', '>12<', '2025-10-01', '2026-10-30', 'Rs. 20', 'Rs. 30', 'ACTIVE', '30 days left']) assert.ok(html.includes(expected), expected)
  assert.match(html, /aria-label="Reclassify Fixture A, batch LOT-TEST"/)
  assert.doesNotMatch(html, /<article|<dl/)
  const unknown = renderToStaticMarkup(createElement(inventory.InventoryBatchRow, { batch: batch('unknown', 1, null), now }))
  assert.match(unknown, /Unknown medicine/)
  assert.match(unknown, /Expiry needs review/)
  assert.doesNotMatch(unknown, /NaN/)
})

test('inventory renders one table row per batch and keeps search, status tabs and dosage grouping', () => {
  const db = database.getDB()
  Object.assign(db, stockFixture())
  const html = renderToStaticMarkup(createElement(StaticRouter, { location: '/' }, createElement(inventory.default)))
  assert.equal((html.match(/<tr[ >]/g) || []).length, db.batches.length + 1)
  for (const expected of ['Inventory batch list', 'Search inventory', 'All Batches', 'Near Expiry (FEFO)', 'Adjustment History', 'Dosage form', 'Stock Units', 'Cost Price', 'Retail Price']) assert.ok(html.includes(expected), expected)
  assert.doesNotMatch(html, /<article|Inventory batch cards|Stock overview/)
  db.batches = []
  const emptyHtml = renderToStaticMarkup(createElement(StaticRouter, { location: '/' }, createElement(inventory.default)))
  assert.match(emptyHtml, /colSpan="10"/i)
  assert.match(emptyHtml, /No batches match/)
})

test('medicine catalogue renders rows with CRUD actions and no product cards', () => {
  const db = database.getDB()
  Object.assign(db, stockFixture())
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(medicines.default)))
  assert.equal((html.match(/<tr[ >]/g) || []).length, db.medicines.length + 1)
  for (const expected of ['Medicine list', 'Purchase', 'Retail', 'Wholesale', 'Add batch for Fixture A', 'Edit Fixture A', 'Delete Fixture A']) assert.ok(html.includes(expected), expected)
  assert.doesNotMatch(html, /<article/)
  db.medicines = []
  const emptyHtml = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(medicines.default)))
  assert.match(emptyHtml, /colSpan="12"/i)
  assert.match(emptyHtml, /No medicines yet/)
})

test('pharmacist renders real charts, explanatory empty states and preserves manager analytics', () => {
  const db = database.getDB()
  Object.assign(db, { ...initial, medicines: [], batches: [], sales: [] })
  const props = { role: 'PHARMACIST', data: database.enterpriseDashboardData(), nav: () => {}, setRole: () => {} }
  const emptyHtml = renderToStaticMarkup(createElement(dashboard.RoleDashboard, props))
  for (const expected of ['Pharmacist Dispensing Dashboard', 'Dispensing Activity', 'Stock Status', 'Expiry Exposure', 'Top Dispensed Medicines', 'FEFO Batch Priorities', 'Available Stock Gaps', 'No dispensing units recorded in the last 14 days', 'No positive stock quantities saved', 'No positive medicine quantities recorded']) assert.ok(emptyHtml.includes(expected), expected)
  assert.doesNotMatch(emptyHtml, /Pending Prescriptions|Completed Prescriptions|NaN/)

  const today = new Date()
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  db.medicines = [{ id: 'm1', name: 'Recorded fixture medicine', minStock: 2 }]
  db.batches = [batch('STORED-LOT', 12, `${today.getFullYear() + 1}-12-31`)]
  db.sales = [{ id: 's1', branchId: 'a', date: key, total: 30, items: [{ medicineId: 'm1', qty: 3, price: 10 }] }, { id: 's2', branchId: 'b', date: key, total: 900, items: [{ medicineId: 'other', qty: 900, price: 1 }] }]
  const data = database.enterpriseDashboardData()
  const html = renderToStaticMarkup(createElement(dashboard.RoleDashboard, { ...props, data }))
  for (const expected of ['Stock units by status', 'Recorded fixture medicine', '3 units', '12 units']) assert.ok(html.includes(expected), expected)
  assert.doesNotMatch(html, /900 units/)
  const manager = renderToStaticMarkup(createElement(dashboard.RoleDashboard, { ...props, role: 'MANAGER', data }))
  for (const expected of ['Manager Operations Dashboard', 'Daily Sales Trend', 'Top Medicines by Units', 'Replenishment Priorities', 'Branch Snapshot']) assert.ok(manager.includes(expected), expected)
})
