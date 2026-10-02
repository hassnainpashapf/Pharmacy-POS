export const MEDICINE_GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'liquid', label: 'Syrup / Suspension' },
  { id: 'injection', label: 'Injection' },
  { id: 'topical', label: 'Cream / Ointment / Tube' },
  { id: 'drops', label: 'Drops' },
  { id: 'inhaler', label: 'Inhaler' },
  { id: 'other', label: 'Other' },
]

export const DOSAGE_FORM_OPTIONS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection',
  'Cream', 'Ointment', 'Tube', 'Gel', 'Cream / Ointment',
  'Drops', 'Inhaler', 'Sachet', 'Other',
]

// Use the explicit dosage form first. Missing forms stay unclassified rather
// than guessing a medicine's formulation from its name or pack size.
export function dosageFormValue(medicine) {
  return [medicine?.dosageForm, medicine?.form]
    .find((value) => typeof value === 'string' && value.trim())?.trim() || ''
}

export function medicineGroup(medicine) {
  const form = dosageFormValue(medicine).toLowerCase()
  if (/\b(tablets?|tabs?)\b/.test(form)) return 'tablet'
  if (/\b(capsules?|caps?|softgels?)\b/.test(form)) return 'capsule'
  if (/\b(syrups?|syr|syp|suspensions?|susp)\b/.test(form)) return 'liquid'
  if (/\b(injections?|injectables?|inj|ampoules?|ampules?|vials?)\b/.test(form)) return 'injection'
  if (/\b(creams?|ointments?|oint|tubes?|gels?)\b/.test(form)) return 'topical'
  if (/\b(drops?|gtt)\b/.test(form)) return 'drops'
  if (/\b(inhalers?|inhalation|mdi|dpi)\b/.test(form)) return 'inhaler'
  return 'other'
}

export function medicineGroupLabel(medicine) {
  return MEDICINE_GROUPS.find(({ id }) => id === medicineGroup(medicine)).label
}

// Preserve both legacy and current fields verbatim on unrelated edits, including
// missing fields. Only an explicit form selection should synchronize the fields.
export function medicineFormFields(medicine) {
  if (!medicine.id) return { dosageForm: 'Tablet', form: 'Tablet' }
  return Object.fromEntries(
    ['dosageForm', 'form'].filter((key) => Object.hasOwn(medicine, key)).map((key) => [key, medicine[key]])
  )
}

export function medicineMatchesSearch(medicine, query, extra = []) {
  const text = [
    medicine?.name, medicine?.generic, medicine?.brand, medicine?.barcode,
    medicine?.manufacturer, medicine?.strength, medicine?.dosageForm,
    medicine?.form, medicineGroupLabel(medicine), ...extra,
  ].filter((value) => value != null).join(' ').toLowerCase()
  return String(query || '').trim().toLowerCase().split(/\s+/).every((term) => text.includes(term))
}

export const POPULAR_PHARMA_COMPANIES = [
  'GSK Pakistan',
  'Abbott Laboratories',
  'Getz Pharma',
  'Sanofi Aventis',
  'The Searle Company',
  'Hilton Pharma',
  'Sami Pharmaceuticals',
  'Ferozsons Laboratories',
  'CCL Pharmaceuticals',
  'Bosch Pharmaceuticals',
  'Martin Dow',
  'AGP Limited',
  'Pfizer Pakistan',
  'Novartis / Haleon',
  'Reckitt Benckiser',
  'Platinum Pharmaceuticals',
  'Atco Laboratories',
  'PharmEvo (Pvt) Ltd',
  'Highnoon Laboratories',
  'Genix Pharma',
  'Barrett Hodgson',
  'Macter International',
  'Bayer Pakistan',
  'English Pharma',
  'Horizon Pharmaceuticals',
]

export function getDistinctCompanies(medicines = []) {
  const set = new Set()
  medicines.forEach((m) => {
    if (m?.manufacturer && typeof m.manufacturer === 'string' && m.manufacturer.trim()) {
      set.add(m.manufacturer.trim())
    }
  })
  POPULAR_PHARMA_COMPANIES.forEach((c) => set.add(c))
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function getCompanyMedicineCounts(medicines = []) {
  const map = {}
  medicines.forEach((m) => {
    const c = (m?.manufacturer && m.manufacturer.trim()) ? m.manufacturer.trim() : 'Unassigned'
    map[c] = (map[c] || 0) + 1
  })
  return map
}

// Counts describe records matching the search/status, before the form selection.
// Catalogue records are products; inventory records are batches or adjustments.
export function filterMedicineRecords(records, {
  query = '', group = 'all', company = 'all', medicineFor = (record) => record, extraSearch = () => [],
} = {}) {
  const counts = Object.fromEntries(MEDICINE_GROUPS.map(({ id }) => [id, 0]))
  const matches = []
  for (const record of records) {
    const medicine = medicineFor(record)
    if (!medicineMatchesSearch(medicine, query, extraSearch(record))) continue
    const medCompany = (medicine?.manufacturer || 'Unassigned').trim()
    if (company && company !== 'all' && medCompany.toLowerCase() !== company.toLowerCase()) continue
    const recordGroup = medicineGroup(medicine)
    counts.all += 1
    counts[recordGroup] += 1
    if (group === 'all' || group === recordGroup) matches.push(record)
  }
  return { matches, counts }
}

export function batchMatchesStockTab(batch, tab, now = new Date()) {
  const expiry = new Date(batch.expiry)
  const isPastExpiry = expiry < now
  const isNear = !isPastExpiry && expiry <= new Date(now.getTime() + 90 * 86400000)
  const status = isPastExpiry ? 'EXPIRED' : (batch.status || 'AVAILABLE').toUpperCase()
  const isAvailable = status === 'ACTIVE' || status === 'AVAILABLE'
  if (tab === 'ALL') return true
  if (tab === 'AVAILABLE') return isAvailable && !isPastExpiry
  if (tab === 'NEAR_EXPIRY') return isNear && isAvailable
  if (tab === 'EXPIRED') return status === 'EXPIRED'
  return status === tab
}
