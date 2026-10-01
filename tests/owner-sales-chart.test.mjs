import test from 'node:test'
import assert from 'node:assert/strict'
import { ownerSalesComparison } from '../src/lib/ownerSalesChart.js'
const now = new Date(2026, 8, 30, 12)
test('owner comparison keeps 12 months and 3 real calendar years with empty zero values', () => {
  const chart = ownerSalesComparison({}, now)
  assert.deepEqual(chart.years, [2024, 2025, 2026])
  assert.equal(chart.months.length, 12)
  assert.ok(chart.months.flatMap(month => month.values).every(value => value.total === 0 && value.count === 0))
  assert.equal(chart.months[11].values[2].future, true)
})
test('owner chart scopes sales, preserves negative amounts, ignores invalid and future records', () => {
  const db = { currentBranch: 'a', sales: [
    { branchId: 'a', date: '2024-01-12', total: 100 },
    { branchId: 'a', date: '2025-01-12', total: 80 },
    { branchId: 'a', date: '2026-01-12', total: -20 },
    { branchId: 'b', date: '2026-01-12', total: 1000 },
    { branchId: 'a', date: '2026-12-12', total: 900 },
    { branchId: 'a', date: 'invalid', total: 900 },
    { branchId: 'a', date: '2026-01-12', total: 'invalid' },
  ] }
  const chart = ownerSalesComparison(db, now)
  assert.deepEqual(chart.months[0].values.map(value => value.total), [100, 80, -20])
  assert.deepEqual(chart.months[0].values.map(value => value.count), [1, 1, 1])
  assert.equal(chart.months[11].values[2].total, 0)
  assert.equal(ownerSalesComparison({ ...db, currentBranch: 'ALL' }, now).months[0].values[2].total, 980)
})
