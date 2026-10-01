import test from 'node:test'
import assert from 'node:assert/strict'
import { appIdFromSearch, inventorySessionMode, pharmacyLinks, tenantTotals } from './tenantUi.js'

test('tenant UI derives an exact App ID and same-origin pharmacy links', () => {
  assert.equal(appIdFromSearch('?appId=pharmacy%2F001'), 'pharmacy/001')
  assert.deepEqual(pharmacyLinks('p-001', 'https://server.example'), {
    admin: 'https://server.example/admin?appId=p-001',
    mobile: 'https://server.example/mobile?appId=p-001',
  })
})

test('inventory UI separates platform sessions from tenant sessions', () => {
  assert.equal(inventorySessionMode({ id: 's', role: 'SUPERADMIN' }, 'p-001'), 'platform')
  assert.equal(inventorySessionMode({ id: 'u', role: 'ADMIN', tenantId: 't', appId: 'p-001' }, 'p-001'), 'ready')
  assert.equal(inventorySessionMode({ id: 'u', role: 'ADMIN', tenantId: 't', appId: 'p-001' }, 'p-002'), 'different-pharmacy')
  assert.equal(inventorySessionMode({ id: 'u', role: 'ADMIN' }, ''), 'invalid')
})

test('platform totals are numeric and do not mutate tenant records', () => {
  const tenants = [{ id: 't', disabled: false, medicineCount: 2, stockUnits: 13, userCount: 3 }, { id: 'x', disabled: true, medicineCount: 1, stockUnits: 0, userCount: 2 }]
  assert.deepEqual(tenantTotals(tenants), { pharmacies: 2, active: 1, medicines: 3, stock: 13, users: 5 })
  assert.deepEqual(tenants[0], { id: 't', disabled: false, medicineCount: 2, stockUnits: 13, userCount: 3 })
})
