import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MEDICINE_GROUPS,
  DOSAGE_FORM_OPTIONS,
  batchMatchesStockTab,
  dosageFormValue,
  filterMedicineRecords,
  medicineFormFields,
  medicineGroup,
  medicineMatchesSearch,
} from '../src/lib/medicineGroups.js'

test('normalizes common pharmacy form aliases, case and punctuation into the same groups', () => {
  const cases = {
    tablet: ['Tablet', 'TABLETS', ' tab. ', 'Film-coated tablet', 'Dispersible Tablets'],
    capsule: ['Capsule', 'CAPS', 'cap.', 'Softgel'],
    liquid: ['Syrup', 'syp.', 'SUSP', 'Oral Suspension', 'Syrup / Suspension'],
    injection: ['INJ.', 'Injectable', 'Injection', 'Ampoule', 'Vials'],
    topical: ['Cream / Ointment', 'CREAMS', 'Oint.', 'Tubes', 'Topical Gel'],
    drops: ['Eye Drops', 'EAR DROP', 'gtt.', 'Nasal drops'],
    inhaler: ['Inhaler', 'INHALATION', 'MDI', 'DPI'],
    other: ['Sachet', 'Powder', 'Solution', 'Other', ''],
  }
  for (const [expected, aliases] of Object.entries(cases)) {
    for (const alias of aliases) assert.equal(medicineGroup({ dosageForm: alias }), expected, alias)
  }
})

test('prefers dosageForm, falls back to a usable legacy form, and never guesses from a product name', () => {
  assert.equal(medicineGroup({ dosageForm: 'Syrup', form: 'Tablet' }), 'liquid')
  assert.equal(medicineGroup({ dosageForm: '   ', form: 'capsule' }), 'capsule')
  assert.equal(medicineGroup({ dosageForm: null, form: 'tube' }), 'topical')
  assert.equal(medicineGroup({ dosageForm: 'Custom powder', form: 'Tablet' }), 'other')
  assert.equal(medicineGroup({ name: 'Tablet brand', packSize: '20 Tablets' }), 'other')
  assert.equal(medicineGroup(undefined), 'other')
  assert.equal(dosageFormValue({ form: ' Eye Drops ' }), 'Eye Drops')
  assert.equal(dosageFormValue({}), '')
})

test('editor retains original current, legacy, custom and absent form fields on unrelated edits', () => {
  const records = [
    { id: 'one', dosageForm: 'Custom formulation', form: 'Legacy powder' },
    { id: 'two', form: 'syp.' },
    { id: 'three', dosageForm: ' CAPS ', form: '' },
    { id: 'four' },
    { id: 'five', dosageForm: null },
  ]
  for (const medicine of records) {
    const { id, ...originalFields } = medicine
    assert.deepEqual(medicineFormFields(medicine), originalFields, id)
    assert.deepEqual(medicine, { id, ...originalFields }, 'must not mutate the medicine')
  }
  assert.deepEqual(medicineFormFields({}), { dosageForm: 'Tablet', form: 'Tablet' })
  for (const group of MEDICINE_GROUPS.filter(({ id }) => id !== 'all')) {
    assert.ok(DOSAGE_FORM_OPTIONS.some((form) => medicineGroup({ form }) === group.id), group.label)
  }
})

// Deliberately generic fixtures: no patient data or clinical/product claims.
const medicines = [
  { id: 'tablet', name: 'Fixture A', dosageForm: 'TAB', barcode: '1001', generic: 'Fixture generic', manufacturer: 'Maker A', strength: '10' },
  { id: 'syrup', name: 'Fixture B', form: 'Syrup', barcode: '1002', brand: 'Fixture brand' },
  { id: 'suspension', name: 'Fixture C', dosageForm: 'Suspension' },
  { id: 'tube', name: 'Fixture D', form: 'Tube' },
  { id: 'unknown', name: 'Fixture E' },
]

test('catalogue form + multi-term search intersect; counts are real search matches before form selection', () => {
  const { matches, counts } = filterMedicineRecords(medicines, { query: '  fixture  ', group: 'liquid' })
  assert.deepEqual(matches.map(({ id }) => id), ['syrup', 'suspension'])
  assert.deepEqual(counts, { all: 5, tablet: 1, capsule: 0, liquid: 2, injection: 0, topical: 1, drops: 0, inhaler: 0, other: 1 })
  const result = filterMedicineRecords(medicines, { query: 'maker 1001', group: 'tablet' })
  assert.deepEqual(result.matches.map(({ id }) => id), ['tablet'])
  assert.equal(result.counts.all, 1)
  assert.equal(filterMedicineRecords(medicines, { query: '1001', group: 'liquid' }).matches.length, 0)
  assert.equal(medicineMatchesSearch(medicines[1], 'BRAND syrup'), true)
  assert.equal(medicineMatchesSearch({}, 'undefined'), false)
})

test('empty catalogues and searches have zero results and zero group counts', () => {
  for (const result of [filterMedicineRecords([]), filterMedicineRecords(medicines, { query: 'no-such-record' })]) {
    assert.deepEqual(result.matches, [])
    assert.ok(Object.values(result.counts).every((count) => count === 0))
  }
})

const now = new Date('2026-09-30T12:00:00Z')
const batches = [
  { id: 'b1', medicineId: 'tablet', batchNo: 'LOT-A', expiry: '2026-10-10', status: 'ACTIVE', qty: 5 },
  { id: 'b2', medicineId: 'syrup', batchNo: 'LOT-B', expiry: '2026-10-10', status: 'AVAILABLE', qty: 4 },
  { id: 'b3', medicineId: 'syrup', batchNo: 'LOT-C', expiry: '2026-10-10', status: 'DAMAGED', qty: 2 },
  { id: 'b4', medicineId: 'syrup', batchNo: 'LOT-D', expiry: '2026-09-01', status: 'ACTIVE', qty: 3 },
  { id: 'b5', medicineId: 'suspension', batchNo: 'LOT-E', expiry: '2027-10-10', status: 'AVAILABLE', qty: 7 },
  { id: 'b6', medicineId: 'syrup', batchNo: 'LOT-F', expiry: '2026-10-10', status: 'RETURNED', qty: 1 },
  { id: 'b7', medicineId: 'syrup', batchNo: 'LOT-G', expiry: '2026-10-10', status: 'RESERVED', qty: 1 },
]
const medicineFor = (record) => medicines.find(({ id }) => id === record.medicineId)

test('inventory combines stock tab, dosage form and batch search without mixing units and batch counts', () => {
  const candidates = batches.filter((batch) => batchMatchesStockTab(batch, 'NEAR_EXPIRY', now))
  const { matches, counts } = filterMedicineRecords(candidates, {
    group: 'liquid', query: 'LOT', medicineFor, extraSearch: (batch) => [batch.batchNo],
  })
  assert.deepEqual(matches.map(({ id }) => id), ['b2'])
  assert.equal(counts.all, 2)
  assert.equal(counts.tablet, 1)
  assert.equal(counts.liquid, 1)
  const all = filterMedicineRecords(batches, { group: 'liquid', query: 'LOT-C', medicineFor, extraSearch: (batch) => [batch.batchNo] })
  assert.deepEqual(all.matches.map(({ id }) => id), ['b3'])
})

test('stock status logic retains ACTIVE alias, expiry precedence, near-expiry window, returns and reservations', () => {
  const expected = {
    ALL: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
    AVAILABLE: ['b1', 'b2', 'b5'],
    NEAR_EXPIRY: ['b1', 'b2'],
    EXPIRED: ['b4'],
    DAMAGED: ['b3'],
    RETURNED: ['b6'],
    RESERVED: ['b7'],
  }
  for (const [tab, ids] of Object.entries(expected)) {
    assert.deepEqual(batches.filter((batch) => batchMatchesStockTab(batch, tab, now)).map(({ id }) => id), ids, tab)
  }
  assert.equal(batchMatchesStockTab({ expiry: '2027-01-01' }, 'AVAILABLE', now), true)
  assert.equal(batchMatchesStockTab({ expiry: '2026-10-01', status: 'active' }, 'NEAR_EXPIRY', now), true)
  assert.equal(batchMatchesStockTab({ expiry: '2026-09-01', status: 'DAMAGED' }, 'EXPIRED', now), true)
  const boundary = new Date(now.getTime() + 90 * 86400000).toISOString()
  assert.equal(batchMatchesStockTab({ expiry: boundary }, 'NEAR_EXPIRY', now), true)
  assert.equal(batchMatchesStockTab({ expiry: new Date(Date.parse(boundary) + 1).toISOString() }, 'NEAR_EXPIRY', now), false)
})

test('adjustment search honors snapshots and missing medicine records remain discoverable in Other', () => {
  const adjustments = [
    { medicineId: 'tube', medicineName: 'Fixture D', batchNo: 'OLD-1', reason: 'Record note' },
    { medicineId: 'deleted', medicineName: 'Historical fixture', batchNo: 'OLD-2', reason: 'Record note' },
  ]
  const result = filterMedicineRecords(adjustments, {
    group: 'other', query: 'Historical OLD-2', medicineFor,
    extraSearch: (record) => [record.medicineName, record.batchNo, record.reason],
  })
  assert.deepEqual(result.matches, [adjustments[1]])
  assert.equal(result.counts.other, 1)
})
