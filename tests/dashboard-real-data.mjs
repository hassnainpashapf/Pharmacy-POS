import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

// Isolated Node memory only: never reads browser storage or writes a database file.
process.env.TZ = 'Asia/Karachi'
const NativeDate = Date
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : ['2026-09-30T04:30:00Z'])) }
  static now() { return new NativeDate('2026-09-30T04:30:00Z').getTime() }
}
const blank = () => ({
  medicines: [], batches: [], sales: [], purchases: [], returns: [], suppliers: [], customers: [],
  purchaseOrders: [], wholesaleOrders: [], auditLogs: [], currentBranch: 'ALL',
  branches: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
  users: [{ id: 'tester', name: 'Test User' }], plugins: [{ id: 'test' }], settings: {},
  session: { userId: 'tester', name: 'Test User', role: 'ADMIN' },
})
let writes = 0
globalThis.localStorage = {
  getItem: () => JSON.stringify(blank()),
  setItem: () => { writes++ },
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { enterpriseDashboardData, getDB, fmt } = await server.ssrLoadModule('/src/lib/db.jsx')
  const { default: Dashboard, RoleDashboard } = await server.ssrLoadModule('/src/pages/Dashboard.jsx')
  const db = getDB()
  const renderOwner = () => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Dashboard)))
  const renderRole = (role) => renderToStaticMarkup(React.createElement(RoleDashboard, { role, setRole() {}, data: enterpriseDashboardData(), nav() {}, me: db.session }))

  Object.assign(db, blank())
  let data = enterpriseDashboardData()
  assert.equal(data.kpis.sales, fmt(0))
  assert.equal(data.kpis.orders, 0)
  assert.equal(data.kpis.profit, fmt(0))
  assert.equal(data.kpis.customers, 0)
  assert.equal(data.kpis.grossMargin, '—')
  assert.equal(data.kpis.payables, fmt(0))
  assert.deepEqual(data.attention, { lowStock: 0, outOfStock: 0, nearExpiry: 0, expired: 0, awaitingOrders: 0, pendingPayments: 0 })
  assert.equal(data.capitalAtRisk.total, fmt(0))
  assert.equal(data.recentActivity.length, 0)
  assert.ok(data.salesTrendMonthly.every((m) => m.total === 0))
  let html = renderOwner()
  assert.ok(!html.includes('Calculated from saved records') && !html.includes('Payables are current balances') && !html.includes('How it’s calculated'))
  assert.ok(html.includes('No sales recorded this month'))
  assert.ok(html.includes('No activity recorded'))
  assert.ok(html.includes('No medicines in the saved catalogue'))
  for (const label of ['Owner branch revenue bar chart', 'Owner category sales distribution: no data', 'Owner inventory health distribution: no data', 'Owner monthly sales comparison by year', 'View monthly comparison data']) assert.ok(html.includes(label), label)
  assert.ok(html.includes('2024') && html.includes('2025') && html.includes('2026'))
  assert.ok(!html.includes('৳') && !html.includes('Dhanmondi') && !html.includes('22.3%'))
  assert.equal(data.operations.todayAverage, null)
  assert.equal(data.operations.sevenDayAverage, null)
  assert.equal(data.operations.sevenDayChange, 'No change vs prior 7 days')
  assert.equal(data.operations.salesTrendDaily.length, 14)
  assert.ok(data.operations.salesTrendDaily.every((day) => day.total === 0 && day.count === 0))
  assert.deepEqual(data.operations.topMedicines, [])
  assert.deepEqual(data.operations.replenishment, [])
  html = renderRole('MANAGER')
  assert.ok(html.includes('No sales recorded in the last 14 days'))
  assert.ok(html.includes('No positive medicine quantities recorded'))
  assert.ok(html.includes('Add medicines to see replenishment priorities'))
  assert.ok(!html.includes('NaN') && !html.includes('Infinity'))

  Object.assign(db, blank(), {
    medicines: [{ id: 'm1', name: 'One', category: 'Tablets', minStock: 5 }, { id: 'm2', name: 'Two', form: 'Syrup', minStock: 2 }, { id: 'm3', name: 'Three', minStock: 0 }],
    batches: [
      { id: 'ba', medicineId: 'm1', branchId: 'a', qty: 3, purchasePrice: 10, expiry: '2026-10-30', batchNo: 'A' },
      { id: 'bb', medicineId: 'm2', branchId: 'a', qty: 2, purchasePrice: 20, expiry: '2026-09-29', batchNo: 'B' },
      { id: 'bc', medicineId: 'm1', branchId: 'b', qty: 10, purchasePrice: 5, expiry: '2026-09-30', batchNo: 'C' },
      { id: 'bd', medicineId: 'm2', branchId: 'b', qty: 0, purchasePrice: 30, expiry: '2026-01-01' },
      { id: 'be', medicineId: 'm2', branchId: 'b', qty: 1, purchasePrice: 10, expiry: 'invalid' },
    ],
    suppliers: [{ id: 'sup1', balance: 100 }, { id: 'sup2', balance: -10 }],
    sales: [
      // UTC date differs from local date; this is September 30 in Karachi.
      { id: 's1', invoiceNo: 'LOCAL-TODAY', branchId: 'a', date: '2026-09-29T20:00:00Z', total: 90, profit: -10, customerId: 'c1', items: [{ medicineId: 'm1', qty: 2, price: 30 }, { medicineId: 'm2', qty: 1, price: 40 }] },
      { id: 's2', branchId: 'a', date: '2026-09-29', total: 50, profit: -20, customerId: 'c1', items: [{ medicineId: 'm1', qty: 1, price: 50 }] },
      { id: 's3', branchId: 'b', date: '2026-09-30', total: 200, profit: 20, customerId: 'walkin', items: [{ medicineId: 'm2', qty: 2, price: 100 }] },
      { id: 's4', branchId: 'a', date: '2026-08-15', total: 30, profit: 1, items: [] },
      { id: 's5', date: '2026-09-30', total: 10, profit: 0, items: [] },
      { id: 'future', branchId: 'a', date: '2026-10-01', total: 9999, profit: 999, items: [] },
    ],
    returns: [{ id: 'r1', saleId: 's1', date: '2026-09-30T04:00:00Z', refund: 5 }],
    purchases: [{ id: 'p1', invoiceNo: 'PUR-A', date: '2026-09-30', items: ['ba'], total: 30 }, { id: 'p2', date: '2026-09-29', items: [], total: 1000 }],
    purchaseOrders: [{ id: 'po1', branchId: 'a', status: 'DRAFT' }, { id: 'po2', status: 'SENT' }, { id: 'po3', branchId: 'a', status: 'RECEIVED' }],
    wholesaleOrders: [{ id: 'wo1', branchId: 'a', status: 'PENDING' }, { id: 'wo2', branchId: 'b', status: 'DISPATCHED' }],
  })
  data = enterpriseDashboardData()
  assert.equal(data.kpis.sales, fmt(300))
  assert.equal(data.kpis.orders, 3)
  assert.equal(data.kpis.customers, 1)
  assert.equal(data.kpis.payables, fmt(100))
  assert.equal(data.attention.awaitingOrders, 3)
  assert.equal(data.attention.pendingPayments, 1)
  assert.equal(data.capitalAtRisk.total, fmt(120))
  assert.equal(data.branchRankings[0].name, 'Beta')
  assert.equal(data.branchRankings.reduce((sum, b) => sum + b.total, 0), 350)
  assert.equal(data.categoryBreakdown.reduce((sum, c) => sum + c.amount, 0), 350)
  assert.ok(data.branchRevenueTrend.some((b) => b.name === 'Unassigned branch'))
  assert.equal(data.greeting, 'Good morning')
  assert.ok(data.dateLabel.includes('2026'))
  assert.equal(data.operations.sevenDayRevenue, 350)
  assert.equal(data.operations.sevenDayOrders, 4)
  assert.equal(data.operations.todayAverage, 100)
  assert.deepEqual(data.operations.topMedicines.map((m) => [m.name, m.units]), [['One', 3], ['Two', 3]])

  db.currentBranch = 'a'
  const before = JSON.stringify(db)
  const previousWrites = writes
  data = enterpriseDashboardData()
  assert.equal(JSON.stringify(db), before, 'Dashboard projection must not mutate stored records')
  assert.equal(writes, previousWrites, 'Dashboard projection must not persist anything')
  assert.equal(data.scopeLabel, 'Alpha')
  assert.equal(data.kpis.sales, fmt(90), 'Returns already incorporated in sale totals must not be subtracted again')
  assert.equal(data.kpis.salesChange, '+80.0% vs yesterday')
  assert.equal(data.kpis.orders, 1)
  assert.equal(data.kpis.profit, fmt(-10), 'Negative profit must remain negative')
  assert.equal(data.kpis.profitChange, '+50.0% vs yesterday')
  assert.equal(data.kpis.grossMargin, '-11.1%')
  assert.equal(data.kpis.payables, 'Unavailable')
  assert.equal(data.attention.pendingPayments, null)
  assert.equal(data.attention.awaitingOrders, 2)
  assert.equal(data.attention.lowStock, 2)
  assert.equal(data.attention.outOfStock, 1)
  assert.equal(data.attention.nearExpiry, 1, 'Thirty-day boundary is inclusive')
  assert.equal(data.attention.expired, 1, 'Expired batches must not also count as near expiry')
  assert.equal(data.capitalAtRisk.total, fmt(70))
  assert.equal(data.branchRankings.length, 1)
  assert.equal(data.branchRankings[0].total, 140)
  assert.equal(data.salesTrendMonthly.length, 12)
  assert.equal(data.salesTrendMonthly.at(-1).total, 140)
  assert.equal(data.salesTrendMonthly.at(-2).total, 30)
  assert.equal(data.categoryBreakdown.find((c) => c.label === 'Tablets').amount, 104)
  assert.equal(data.categoryBreakdown.find((c) => c.label === 'Syrup').amount, 36)
  assert.equal(data.inventoryHealth.reduce((sum, c) => sum + c.count, 0), 3)
  assert.ok(data.recentActivity.every((a) => a.branchId === 'a'))
  assert.ok(data.recentActivity.some((a) => a.id === 'purchase-p1'), 'Unambiguously linked purchases inherit branch')
  assert.ok(!data.recentActivity.some((a) => a.id === 'purchase-p2'), 'Unattributed purchases excluded from branch view')
  html = renderOwner()
  assert.ok(html.includes('Alpha') && !html.includes('Beta'))
  assert.ok(html.includes('Rs. -10'))
  assert.ok(!html.includes('Target Met') && !html.includes('৳'))
  const managerHtml = renderRole('MANAGER')
  assert.ok(managerHtml.includes('Supplier Payables') && managerHtml.includes(data.kpis.payables))
  assert.ok(!managerHtml.includes('Balances are not branch-tagged'))
  const pharmacistHtml = renderRole('PHARMACIST')
  assert.ok(pharmacistHtml.includes('Today Transactions'))
  assert.ok(!pharmacistHtml.includes('Recorded sales; prescriptions are not tracked'))
  assert.equal(data.operations.salesTrendDaily[0].key, '2026-09-17')
  assert.equal(data.operations.salesTrendDaily.at(-1).key, '2026-09-30')
  assert.equal(data.operations.salesTrendDaily.at(-1).total, 90, 'Daily bins use local sale dates and saved totals after returns')
  assert.equal(data.operations.sevenDayRevenue, 140)
  assert.equal(data.operations.sevenDayOrders, 2)
  assert.equal(data.operations.sevenDayAverage, 70)
  assert.equal(data.operations.todayAverage, 90)
  assert.equal(data.operations.sevenDayChange, 'No non-zero baseline in prior 7 days')
  assert.deepEqual(data.operations.topMedicines.map((m) => [m.name, m.units]), [['One', 3], ['Two', 1]])
  assert.deepEqual(data.operations.replenishment.map((m) => [m.name, m.qty, m.minimum]), [['Three', 0, 0], ['Two', 2, 2], ['One', 3, 5]])
  html = renderRole('MANAGER')
  for (const heading of ['Daily Sales Trend', 'Top Medicines by Units', 'Replenishment Priorities', 'Expiry Actions', 'Recent Operations Activity', 'Branch Snapshot', 'View daily sales data']) assert.ok(html.includes(heading))
  assert.ok(html.includes('Alpha') && !html.includes('Beta'), 'All manager sections honor the selected branch')
  assert.ok(html.includes('role="img"') && html.includes('aria-label="Daily saved sales'))
  assert.ok(!renderRole('PHARMACIST').includes('Daily Sales Trend'))

  db.sales.find((s) => s.id === 's1').profit = null
  assert.equal(enterpriseDashboardData().kpis.profit, 'Unavailable')
  db.currentBranch = 'b'
  data = enterpriseDashboardData()
  assert.equal(data.attention.nearExpiry, 1, 'Expiry today is near-expiry rather than expired')
  assert.equal(data.attention.expired, 0, 'Zero stock and invalid expiry are excluded')
  db.sales = []
  assert.equal(enterpriseDashboardData().kpis.sales, fmt(0), 'Clearing sales must immediately remove dashboard totals')
  assert.ok(renderOwner().includes('No sales to rank this month'))

  Object.assign(db, blank(), {
    currentBranch: 'a',
    sales: [
      { id: 'prior-start', branchId: 'a', date: '2026-09-17', total: 100, items: [] },
      { id: 'prior-end', branchId: 'a', date: '2026-09-23', total: 100, items: [] },
      { id: 'week-start', branchId: 'a', date: '2026-09-24', total: 80, items: [] },
      { id: 'negative', branchId: 'a', date: '2026-09-30', total: -20, items: [{ medicineId: 'missing', qty: 2 }] },
      { id: 'zero', branchId: 'a', date: '2026-09-29', total: 0, items: [{ medicineId: 'returned', qty: 0 }] },
      { id: 'outside', branchId: 'a', date: '2026-09-16', total: 1000, items: [] },
      { id: 'other-branch', branchId: 'b', date: '2026-09-30', total: 1000, items: [] },
    ],
  })
  data = enterpriseDashboardData()
  assert.equal(data.operations.sevenDayRevenue, 60)
  assert.equal(data.operations.sevenDayOrders, 3, 'Zero and negative-total recorded invoices still count')
  assert.equal(data.operations.sevenDayAverage, 20)
  assert.equal(data.operations.sevenDayChange, '-70.0% vs prior 7 days')
  assert.equal(data.operations.todayAverage, -20)
  assert.equal(data.operations.topMedicines.length, 1, 'Fully returned quantities do not rank')
  assert.equal(data.operations.topMedicines[0].name, 'Unknown medicine (missing)')
  html = renderRole('MANAGER')
  assert.ok(html.includes('Rs. -20') && html.includes('fill="#e11d48"'), 'Negative daily sales retain a signed chart value')
  assert.ok(!html.includes('NaN') && !html.includes('Infinity'))
  db.sales = [{ id: 'zero-only', branchId: 'a', date: '2026-09-30', total: 0, items: [] }]
  html = renderRole('MANAGER')
  assert.ok(html.includes('View daily sales data') && !html.includes('No sales recorded in the last 14 days'), 'Recorded zero totals differ from an empty dataset')
  assert.ok(!html.includes('NaN') && !html.includes('Infinity'))
  console.log('PASS: dashboard stored metrics, branch scope, returns, local dates, roles, read-only projections, manager trends, signed/zero charts, ranking and replenishment')
} finally {
  await server.close()
  globalThis.Date = NativeDate
  delete globalThis.localStorage
}
