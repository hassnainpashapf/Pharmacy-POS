import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMedicineLabel, labelRetailPrice } from '../src/lib/medicineLabel.js'

test('extracts label name/strength/form candidates and explicit Rs price, never buying price', () => {
  const result = parseMedicineLabel('Example Brand\n500mg Tablets\nMRP: Rs. 1,250.50\nBatch 1234\nEXP 12/2027')
  assert.equal(result.names[0], 'Example Brand')
  assert.equal(result.strength, '500mg')
  assert.equal(result.form, 'Tablets')
  assert.deepEqual(result.prices.map(p => p.value), [1250.5])
  assert.equal(result.purchasePrice, undefined)
})
test('batch, strength, dates and barcodes never become guessed prices', () => {
  assert.deepEqual(parseMedicineLabel('500 mg\nEXP 2027-10\nBATCH 180\n896123456789').prices, [])
})
test('multiple printed prices require review rather than guessing one', () => {
  assert.deepEqual(parseMedicineLabel('MRP 250\nPKR 300').prices.map(p => p.value), [250, 300])
})
test('pack prices require explicit basis and unit count', () => {
  assert.throws(() => labelRetailPrice('1200', '', ''), /per unit or per pack/)
  assert.throws(() => labelRetailPrice('1200', 'pack', ''), /units/)
  assert.equal(labelRetailPrice('1200', 'pack', '10'), '120.00')
  assert.equal(labelRetailPrice('1200', 'unit', ''), '1200.00')
  assert.equal(labelRetailPrice('', '', ''), '')
})
test('invalid prices cannot enter stock drafts', () => {
  for (const value of ['-1', 'Infinity', 'unknown']) assert.throws(() => labelRetailPrice(value, 'unit', ''))
  assert.throws(() => labelRetailPrice('500', 'pack', '1.5'))
})
