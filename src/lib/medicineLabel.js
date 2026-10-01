// OCR is fallible. These are candidates, never confirmed product identity or
// actual buying prices. Unlabelled numbers (batch/expiry/strength) are not prices.
export function parseMedicineLabel(text = '') {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const prices = []
  for (const line of lines) {
    const pattern = /(?:M\.?\s*R\.?\s*P\.?|Rs\.?|PKR|retail\s+price|price)\s*[:=\-]?\s*(?:(?:Rs\.?|PKR)\s*)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)(?![\d.])/gi
    for (const match of line.matchAll(pattern)) {
      const value = Number(match[1].replaceAll(',', ''))
      if (Number.isFinite(value) && value >= 0 && value <= 10000000 && !prices.some(p => p.value === value)) prices.push({ value, line })
    }
  }
  const names = lines.filter(line => /[a-z]/i.test(line) && line.length <= 200
    && !/\b(mrp|rs|pkr|price|batch|expiry|exp|mfg|manufactured|manufacture|store|storage|keep|children|dosage|licensed|licence|registration)\b/i.test(line)).slice(0, 12)
  const strength = String(text).match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu)(?:\s*\/\s*\d+(?:\.\d+)?\s*ml)?\b/i)?.[0] || ''
  const form = String(text).match(/\b(tablets?|capsules?|syrup|suspension|injection|cream|ointment|drops|inhaler|gel)\b/i)?.[0] || ''
  return { names, prices, strength, form }
}

export function labelRetailPrice(printed, basis, units) {
  if (String(printed).trim() === '') return ''
  const price = Number(printed)
  if (!Number.isFinite(price) || price < 0 || price > 10000000) throw new Error('Enter a valid printed price.')
  if (basis === 'unit') return price.toFixed(2)
  if (basis !== 'pack') throw new Error('Confirm whether the printed price is per unit or per pack.')
  const count = Number(units)
  if (!Number.isInteger(count) || count < 1 || count > 1000000) throw new Error('Enter the number of stock units covered by this printed price.')
  return (Math.round(price * 100 / count) / 100).toFixed(2)
}
