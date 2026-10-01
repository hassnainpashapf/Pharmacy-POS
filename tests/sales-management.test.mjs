import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let server
let db

const initial = {
  currentBranch: 'ALL',
  medicines: [
    {
      id: 'm1',
      name: 'Panadol 500mg',
      generic: 'Paracetamol',
      strength: '500mg',
      form: 'Tablet',
      barcode: '123456789',
      salePrice: 50,
      purchasePrice: 35,
    },
  ],
  batches: [
    {
      id: 'b1',
      medicineId: 'm1',
      batchNo: 'PAN-01',
      qty: 100,
      expiry: '2028-01-01',
      salePrice: 50,
      purchasePrice: 35,
      status: 'ACTIVE',
      branchId: 'main',
    },
  ],
  sales: [],
  users: [{ id: 'usr_admin', username: 'admin', role: 'ADMIN', active: true, name: 'Admin' }],
  session: { userId: 'usr_admin', username: 'admin', role: 'ADMIN', name: 'Admin' },
  settings: { pharmacyName: 'Test Pharmacy' },
}

before(async () => {
  let saved = JSON.stringify(initial)
  globalThis.localStorage = {
    getItem: () => saved,
    setItem: (_, value) => {
      saved = value
    },
  }
  server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  db = await server.ssrLoadModule('/src/lib/db.jsx')
})

after(async () => {
  await server?.close()
})

test('sales management: completing sale, viewing in scope, editing and voiding with inventory restock', () => {
  const salesBefore = db.allSalesInScope()
  const initialStock = db.stockOf('m1')
  assert.equal(initialStock, 100)

  // 1. Complete a sale
  const sale = db.completeSale({
    items: [{ medicineId: 'm1', qty: 2, price: 50 }],
    discount: 10,
    payMethod: 'CASH',
    paid: 90,
  })

  assert.ok(sale.id, 'Sale should have an id')
  assert.equal(sale.total, 90, 'Total should be 100 - 10 = 90')
  assert.equal(db.stockOf('m1'), 98, 'Stock should decrease by 2 units')

  // 2. Sales in scope should include the new sale
  const salesAfter = db.allSalesInScope()
  assert.equal(salesAfter.length, salesBefore.length + 1)
  assert.equal(salesAfter[0].id, sale.id, 'New sale should be at top of list')

  // 3. Edit sale: adjust discount to 0
  const updated = db.updateSale(sale.id, {
    discount: 0,
    payMethod: 'CARD',
  })
  assert.equal(updated.discount, 0)
  assert.equal(updated.total, 100, 'Total should now be 100 without discount')
  assert.equal(updated.payMethod, 'CARD')

  // 4. Void / Delete sale: stock must be restored
  const deleted = db.deleteSale(sale.id)
  assert.equal(deleted.ok, true)
  assert.equal(db.stockOf('m1'), 100, 'Stock should be 100% restored after deleting the sale')

  const salesFinal = db.allSalesInScope()
  assert.equal(salesFinal.length, salesBefore.length, 'Sale should be removed from sales history')
})

test('mergeCloudSyncData: updates medicines and batches from cloud response', () => {
  const cloudData = {
    medicines: [
      {
        id: 'cloud_med_999',
        name: 'Cloud Test Capsule',
        generic: 'Cloudium',
        strength: '500mg',
        form: 'Capsule',
        barcode: '999888777666',
        salePrice: 125,
        purchasePrice: 90,
      },
    ],
    batches: [
      {
        id: 'cloud_bat_999',
        medicineId: 'cloud_med_999',
        batchNo: 'CLOUD-001',
        qty: 150,
        expiry: '2028-12-31',
        salePrice: 125,
        purchasePrice: 90,
      },
    ],
    pharmacyName: 'Cloud Linked Pharmacy',
  }

  const res = db.mergeCloudSyncData(cloudData)
  assert.equal(res.updated, true)
  assert.equal(res.stats.medicines, 1)
  assert.equal(res.stats.batches, 1)

  const importedMed = db.medicineById('cloud_med_999')
  assert.ok(importedMed, 'Imported medicine should be in local database')
  assert.equal(importedMed.name, 'Cloud Test Capsule')
  assert.equal(importedMed.salePrice, 125)
  assert.equal(db.stockOf('cloud_med_999'), 150, 'Batch stock should be installed locally')
})
