import { useState, useMemo } from 'react'
import { useLocation } from 'react-router'
import {
  useDB,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  addBatch,
  stockOf,
  fmt,
  fefoBatches,
} from '../lib/db'
import { Plus, Search, Edit3, Trash2, Building2, CheckCircle2, Sparkles, Layers } from 'lucide-react'
import MedicineGroupFilter from '../components/MedicineGroupFilter'
import {
  DOSAGE_FORM_OPTIONS,
  dosageFormValue,
  filterMedicineRecords,
  medicineFormFields,
  POPULAR_PHARMA_COMPANIES,
  getDistinctCompanies,
} from '../lib/medicineGroups'

export default function Medicines() {
  const db = useDB()
  let search = ''
  try { search = useLocation().search } catch { search = '' }
  const controlledMode = new URLSearchParams(search).get('filter') === 'controlled'
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [batchFor, setBatchFor] = useState(null)
  const [companyAddOpen, setCompanyAddOpen] = useState(false)

  const distinctCompanies = useMemo(() => getDistinctCompanies(db.medicines || []), [db.medicines])

  // Count medicines per company for quick stats
  const activeCompanyCount = useMemo(() => {
    const map = {}
    for (const m of (db.medicines || [])) {
      const c = (m.manufacturer || 'Unassigned').trim()
      map[c] = (map[c] || 0) + 1
    }
    return map
  }, [db.medicines])

  const controlled = medicine => medicine.controlled === true || /clonazepam|alprazolam|diazepam|lorazepam|morphine|fentanyl|codeine|tramadol|buprenorphine|methadone/i.test(`${medicine.name} ${medicine.generic}`)
  const source = controlledMode ? db.medicines.filter(controlled) : db.medicines
  const { matches: list, counts } = filterMedicineRecords(source, { query: q, group, company: companyFilter })

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Row-based catalogue toolbar */}
      <div className="pb-4 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{controlledMode ? 'Controlled Substances' : 'Medicines Catalogue'}</span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-sm border border-indigo-200">
              {controlledMode ? `${source.length} Controlled` : `${db.medicines.length} Products`}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage medicines master catalog and add stock by manufacturer</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[160px] truncate"
              aria-label="Filter medicines by pharmaceutical company"
            >
              <option value="all">🏢 All Companies ({distinctCompanies.length})</option>
              {distinctCompanies.map((c) => (
                <option key={c} value={c}>
                  {c} {activeCompanyCount[c] ? `(${activeCompanyCount[c]})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 sm:w-64 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search medicines"
              placeholder="Name, generic, barcode, form..."
              className="w-full bg-slate-50 border border-slate-300 rounded-sm pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Dedicated Company-Wise Add Button */}
          <button
            onClick={() => setCompanyAddOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-sm inline-flex items-center gap-1.5 shrink-0"
            title="Add medicines grouped by pharma manufacturer"
          >
            <Building2 className="w-4 h-4" /> Add by Company
          </button>

          <button
            onClick={() => setEditing({})}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-sm inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Single
          </button>
        </div>
      </div>

      {/* Quick Company Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scroll">
        <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-slate-400" /> Top Companies:
        </span>
        <button
          type="button"
          onClick={() => setCompanyFilter('all')}
          className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition-colors shrink-0 ${
            companyFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({source.length})
        </button>
        {distinctCompanies.slice(0, 10).map((comp) => {
          const count = activeCompanyCount[comp] || 0
          return (
            <button
              key={comp}
              type="button"
              onClick={() => setCompanyFilter(companyFilter === comp ? 'all' : comp)}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold transition-colors shrink-0 ${
                companyFilter === comp
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {comp} {count > 0 && <span className="text-[10px] opacity-75 font-mono ml-0.5">({count})</span>}
            </button>
          )
        })}
      </div>

      <MedicineGroupFilter value={group} onChange={setGroup} counts={counts} />

      {/* One table row per medicine */}
      <section aria-label="Medicine catalogue" className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-slate-500" role="status">
            Showing <b className="text-slate-800">{list.length}</b> of {source.length} {controlledMode ? 'controlled medicines' : 'products'}
            {companyFilter !== 'all' && (
              <span className="ml-1 text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                🏢 {companyFilter}
              </span>
            )}
          </p>
          {(q || group !== 'all' || companyFilter !== 'all') && (
            <button
              type="button"
              onClick={() => { setQ(''); setGroup('all'); setCompanyFilter('all') }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Clear all filters
            </button>
          )}
        </div>
        <section className="bg-white border border-slate-200 overflow-x-auto" aria-label="Medicine list" tabIndex={0}>
          <table className="w-full min-w-[1250px] text-xs text-left">
            <caption className="sr-only">Medicine catalogue records</caption>
            <thead className="bg-slate-50 border-b border-slate-200"><tr>
              {['Medicine & Strength', 'Generic / Brand', 'Form', 'Manufacturer', 'Pack', 'Barcode', 'Stock', 'Batches', 'Purchase', 'Retail', 'Wholesale', 'Actions'].map((heading) => <th key={heading} scope="col" className={`p-3 whitespace-nowrap ${['Stock', 'Batches', 'Purchase', 'Retail', 'Wholesale'].includes(heading) ? 'text-right' : ''}`}>{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-200">
          {list.map((m) => {
            const st = stockOf(m.id)
            const isLow = st <= (m.minStock || 10)
            const batchesCount = (db.batches || []).filter((b) => b.medicineId === m.id).length
            return (
              <tr key={m.id} aria-label={`${m.name} ${m.strength || ''}`.trim()} className="hover:bg-slate-50 transition-colors">
                <th scope="row" className="p-3 min-w-48 text-slate-900">{m.name}{' '}<span className="font-medium text-slate-500">{m.strength}</span></th>
                <td className="p-3 min-w-40">{m.generic || '—'}<p className="mt-1 text-[10px] text-slate-500">Brand: {m.brand || m.name}</p></td>
                <td className="p-3">{dosageFormValue(m) || 'Not specified'}</td>
                <td className="p-3">
                  {m.manufacturer ? (
                    <button
                      type="button"
                      onClick={() => setCompanyFilter(m.manufacturer)}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold text-left"
                      title={`Filter products by ${m.manufacturer}`}
                    >
                      {m.manufacturer}
                    </button>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </td>
                <td className="p-3">{m.packSize || '—'}</td>
                <td className="p-3 font-mono">{m.barcode || '—'}</td>
                <td className={`p-3 text-right font-bold tabular-nums ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>{st}{isLow && <span className="block text-[9px] whitespace-nowrap">LOW STOCK</span>}</td>
                <td className="p-3 text-right tabular-nums">{batchesCount}</td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap">{m.purchasePrice == null ? '—' : fmt(m.purchasePrice)}</td>
                <td className="p-3 text-right font-semibold tabular-nums whitespace-nowrap">{fmt(m.salePrice)}</td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap">{m.wholesalePrice == null ? '—' : fmt(m.wholesalePrice)}</td>
                <td className="p-3"><div className="flex items-center gap-2 whitespace-nowrap">
                  <button
                    onClick={() => setBatchFor(m)}
                    className="inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                    title="Stock In New Batch"
                    aria-label={`Add batch for ${m.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Batch
                  </button>
                  <button
                    onClick={() => setEditing(m)}
                    className="inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                    title="Edit Medicine"
                    aria-label={`Edit ${m.name}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => confirm(`Permanently delete ${m.name}?`) && deleteMedicine(m.id)}
                    className="inline-flex items-center justify-center gap-1.5 text-rose-600 hover:bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                    title="Delete Medicine"
                    aria-label={`Delete ${m.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div></td>
              </tr>
            )
          })}
        {!list.length && (
          <tr><td colSpan={12} className="p-8 text-center text-sm text-slate-500 font-medium">
            {controlledMode ? 'No controlled medicines found. Mark a medicine as controlled or use a recognised controlled-substance name.' : db.medicines.length ? 'No medicines match this dosage form, company, and search. Try another form or clear the filters.' : 'No medicines yet. Add a medicine to start your catalogue.'}
          </td></tr>
        )}
            </tbody>
          </table>
        </section>
      </section>

      {editing && <MedicineForm med={editing} distinctCompanies={distinctCompanies} onClose={() => setEditing(null)} />}
      {batchFor && <BatchForm medicine={batchFor} onClose={() => setBatchFor(null)} />}
      {companyAddOpen && <CompanyAddMedicineModal onClose={() => setCompanyAddOpen(false)} />}
    </div>
  )
}

function MedicineForm({ med, distinctCompanies = [], onClose }) {
  const [f, setF] = useState({
    name: med.name || '',
    generic: med.generic || '',
    brand: med.brand || med.name || '',
    strength: med.strength || '',
    ...medicineFormFields(med),
    manufacturer: med.manufacturer || '',
    packSize: med.packSize || '20 Tablets',
    barcode: med.barcode || '',
    minStock: med.minStock ?? 10,
    maxStock: med.maxStock ?? 100,
    purchasePrice: med.purchasePrice ?? Math.round((med.salePrice || 100) * 0.75),
    salePrice: med.salePrice ?? 0,
    wholesalePrice: med.wholesalePrice ?? Math.round((med.salePrice || 100) * 0.85),
  })

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal title={med.id ? `Edit Medicine — ${med.name}` : 'Create Medicine Master Item'} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Medicine Name *" value={f.name} onChange={set('name')} placeholder="e.g. Panadol" />
          <Input label="Brand Name" value={f.brand} onChange={set('brand')} placeholder="e.g. Panadol ActiFast" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Generic Chemical Formula *" value={f.generic} onChange={set('generic')} placeholder="e.g. Paracetamol" />
          <Input label="Strength" value={f.strength} onChange={set('strength')} placeholder="e.g. 500mg, 10mg/5ml" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="medicine-dosage-form" className="block font-bold text-slate-700 mb-1">Dosage Form</label>
            <select
              id="medicine-dosage-form"
              value={dosageFormValue(f)}
              onChange={(e) => setF({ ...f, dosageForm: e.target.value, form: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
            >
              {!dosageFormValue(f) && <option value="">Not specified</option>}
              {dosageFormValue(f) && !DOSAGE_FORM_OPTIONS.includes(dosageFormValue(f)) && <option value={dosageFormValue(f)}>{dosageFormValue(f)} (existing)</option>}
              {DOSAGE_FORM_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Manufacturer / Company</label>
            <input
              type="text"
              list="form-pharma-list"
              value={f.manufacturer}
              onChange={set('manufacturer')}
              placeholder="e.g. GSK Pakistan, Abbott"
              className="w-full bg-white border border-slate-300 rounded-sm px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
            />
            <datalist id="form-pharma-list">
              {distinctCompanies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1 mt-1">
              {['GSK Pakistan', 'Abbott Laboratories', 'Getz Pharma', 'Sanofi Aventis', 'The Searle Company', 'Hilton Pharma'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF({ ...f, manufacturer: c })}
                  className="text-[9px] px-1 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200"
                >
                  {c.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <Input label="Pack Size" value={f.packSize} onChange={set('packSize')} placeholder="e.g. 20 Tablets" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Barcode" value={f.barcode} onChange={set('barcode')} placeholder="e.g. 1000001" />
          <Input label="Min Stock (Reorder)" type="number" value={f.minStock} onChange={set('minStock')} />
          <Input label="Max Stock" type="number" value={f.maxStock} onChange={set('maxStock')} />
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Purchase Price (Rs.)</label>
            <input
              type="number"
              value={f.purchasePrice}
              onChange={set('purchasePrice')}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Retail Price / MSRP (Rs.) *</label>
            <input
              type="number"
              value={f.salePrice}
              onChange={set('salePrice')}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Wholesale Price (Rs.)</label>
            <input
              type="number"
              value={f.wholesalePrice}
              onChange={set('wholesalePrice')}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-emerald-700"
            />
          </div>
        </div>

        <button
          onClick={() => {
            if (!f.name.trim()) return alert('Medicine Name is required')
            med.id ? updateMedicine(med.id, f) : addMedicine(f)
            onClose()
          }}
          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm"
        >
          Save Medicine Master
        </button>
      </div>
    </Modal>
  )
}

function BatchForm({ medicine, onClose }) {
  const db = useDB()
  const existing = fefoBatches(medicine.id)
  const [f, setF] = useState({
    batchNo: '',
    mfgDate: new Date().toISOString().slice(0, 10),
    expiry: '',
    qty: 50,
    purchasePrice: medicine.purchasePrice || Math.round(medicine.salePrice * 0.75),
    salePrice: medicine.salePrice,
    supplierId: db.suppliers[0]?.id || '',
    status: 'ACTIVE',
  })

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal title={`Stock In Batches — ${medicine.name} ${medicine.strength}`} onClose={onClose}>
      <div className="space-y-4 text-xs">
        {existing.length > 0 && (
          <div>
            <h4 className="font-bold text-slate-700 mb-1.5">Existing Active Batches (FEFO Order):</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-2 text-left">Batch #</th>
                    <th className="p-2 text-center">Expiry</th>
                    <th className="p-2 text-center">Stock</th>
                    <th className="p-2 text-right">Cost</th>
                    <th className="p-2 text-right">Retail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {existing.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-slate-800">{b.batchNo}</td>
                      <td className="p-2 text-center text-slate-600">{b.expiry}</td>
                      <td className="p-2 text-center font-bold text-slate-900">{b.qty}</td>
                      <td className="p-2 text-right text-slate-600">{fmt(b.purchasePrice)}</td>
                      <td className="p-2 text-right font-bold text-slate-800">{fmt(b.salePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-900">+ Stock In New Batch (FEFO Inward)</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Batch Number *" value={f.batchNo} onChange={set('batchNo')} placeholder="e.g. BT-9901" />
            <div>
              <label className="block font-bold text-slate-700 mb-1">Distributor / Supplier</label>
              <select
                value={f.supplierId}
                onChange={set('supplierId')}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                {db.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.company})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Manufacturing Date" type="date" value={f.mfgDate} onChange={set('mfgDate')} />
            <Input label="Expiry Date *" type="date" value={f.expiry} onChange={set('expiry')} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Inward Quantity *" type="number" value={f.qty} onChange={set('qty')} />
            <Input label="Purchase Price" type="number" value={f.purchasePrice} onChange={set('purchasePrice')} />
            <Input label="Sale Price (MSRP)" type="number" value={f.salePrice} onChange={set('salePrice')} />
          </div>
        </div>

        <button
          onClick={() => {
            if (!f.batchNo.trim() || !f.expiry) return alert('Batch Number and Expiry Date are required')
            addBatch({ ...f, medicineId: medicine.id })
            onClose()
          }}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm"
        >
          Confirm Inward Batch Stock
        </button>
      </div>
    </Modal>
  )
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-sm p-5 w-full max-w-xl max-h-[92vh] overflow-y-auto custom-scroll shadow-2xl border border-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
          <h3 className="font-bold text-base text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-sm text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <div>
      <label className="block font-bold text-slate-700 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-white border border-slate-300 rounded-sm px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
      />
    </div>
  )
}

export function CompanyAddMedicineModal({ onClose }) {
  const db = useDB()
  const distinctCompanies = useMemo(() => getDistinctCompanies(db.medicines || []), [db.medicines])
  const [company, setCompany] = useState(distinctCompanies[0] || 'GSK Pakistan')
  const [customCompany, setCustomCompany] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [addedList, setAddedList] = useState([])

  const activeCompanyName = isCustom ? customCompany.trim() : company.trim()

  // Medicine Master Form State
  const [f, setF] = useState({
    name: '',
    generic: '',
    brand: '',
    strength: '',
    dosageForm: 'Tablet',
    form: 'Tablet',
    packSize: '20 Tablets',
    barcode: '',
    minStock: 10,
    maxStock: 100,
    purchasePrice: 75,
    salePrice: 100,
    wholesalePrice: 85,
  })

  // Optional Initial Batch Form State
  const [stockInBatch, setStockInBatch] = useState(true)
  const [b, setB] = useState({
    batchNo: '',
    expiry: '',
    qty: 50,
  })

  const setMed = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }))
  const setBatch = (k) => (e) => setB((prev) => ({ ...prev, [k]: e.target.value }))

  const existingCompanyMeds = useMemo(() => {
    if (!activeCompanyName) return []
    return (db.medicines || []).filter(
      (m) => (m.manufacturer || '').toLowerCase().trim() === activeCompanyName.toLowerCase()
    )
  }, [db.medicines, activeCompanyName])

  function handleSave(andAddAnother = false) {
    if (!activeCompanyName) {
      alert('Please select or enter a Pharma Company name.')
      return
    }
    if (!f.name.trim()) {
      alert('Medicine Name is required.')
      return
    }

    const newMed = addMedicine({
      ...f,
      manufacturer: activeCompanyName,
      brand: f.brand || f.name,
      purchasePrice: Number(f.purchasePrice) || 0,
      salePrice: Number(f.salePrice) || 0,
      wholesalePrice: Number(f.wholesalePrice) || 0,
      minStock: Number(f.minStock) || 10,
      maxStock: Number(f.maxStock) || 100,
    })

    let batchAdded = null
    if (stockInBatch && b.batchNo.trim() && b.expiry) {
      batchAdded = addBatch({
        medicineId: newMed.id,
        batchNo: b.batchNo.trim(),
        mfgDate: new Date().toISOString().slice(0, 10),
        expiry: b.expiry,
        qty: Number(b.qty) || 0,
        purchasePrice: Number(f.purchasePrice) || 0,
        salePrice: Number(f.salePrice) || 0,
        supplierId: db.suppliers[0]?.id || '',
        status: 'ACTIVE',
      })
    }

    setAddedList((prev) => [
      {
        id: newMed.id,
        name: `${newMed.name} ${newMed.strength || ''}`,
        qty: batchAdded ? batchAdded.qty : 0,
        batchNo: batchAdded ? batchAdded.batchNo : null,
      },
      ...prev,
    ])

    if (andAddAnother) {
      setF({
        name: '',
        generic: '',
        brand: '',
        strength: '',
        dosageForm: f.dosageForm,
        form: f.form,
        packSize: f.packSize,
        barcode: '',
        minStock: 10,
        maxStock: 100,
        purchasePrice: 75,
        salePrice: 100,
        wholesalePrice: 85,
      })
      setB({
        batchNo: '',
        expiry: '',
        qty: 50,
      })
    } else {
      onClose()
    }
  }

  return (
    <Modal title="🏢 Add Medicines by Pharma Company" onClose={onClose}>
      <div className="space-y-4 text-xs">
        {/* Step 1: Select / Switch Company */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <span className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-700" /> 1. Select Pharmaceutical Company
              </span>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                All medicines added in this session will automatically be tagged to this company.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCustom(!isCustom)}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline self-start sm:self-auto"
            >
              {isCustom ? '← Select from popular list' : '+ Type custom company'}
            </button>
          </div>

          {isCustom ? (
            <input
              type="text"
              value={customCompany}
              onChange={(e) => setCustomCompany(e.target.value)}
              placeholder="e.g. Platinum Pharma, Horizon, Bio-Labs..."
              className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
            >
              {distinctCompanies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Quick Click Pills */}
          {!isCustom && (
            <div className="flex flex-wrap gap-1 pt-1">
              {['GSK Pakistan', 'Abbott Laboratories', 'Getz Pharma', 'Sanofi Aventis', 'The Searle Company', 'Hilton Pharma', 'Sami Pharmaceuticals', 'Ferozsons Laboratories'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCompany(p)}
                  className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${
                    company === p
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'bg-white/80 hover:bg-white text-indigo-900 border border-indigo-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-medium text-indigo-800 pt-1 border-t border-indigo-200/60">
            <span>Target Company: <strong className="font-extrabold text-indigo-950">{activeCompanyName || 'None'}</strong></span>
            <span>{existingCompanyMeds.length} existing products in catalog</span>
          </div>
        </div>

        {/* Step 2: Medicine Master Details */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <span className="font-extrabold text-slate-900 text-xs block">
            2. Product Information
          </span>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Medicine Name *" value={f.name} onChange={setMed('name')} placeholder="e.g. Risek, Panadol, Augmentin" />
            <Input label="Brand Name" value={f.brand} onChange={setMed('brand')} placeholder="e.g. Risek Insta, Panadol CF" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Generic Formula *" value={f.generic} onChange={setMed('generic')} placeholder="e.g. Omeprazole, Paracetamol" />
            <Input label="Strength" value={f.strength} onChange={setMed('strength')} placeholder="e.g. 20mg, 40mg, 500mg" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dosage Form</label>
              <select
                value={f.dosageForm}
                onChange={(e) => setF((prev) => ({ ...prev, dosageForm: e.target.value, form: e.target.value }))}
                className="w-full bg-white border border-slate-300 rounded-sm px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
              >
                {DOSAGE_FORM_OPTIONS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>
            <Input label="Pack Size" value={f.packSize} onChange={setMed('packSize')} placeholder="e.g. 14 Capsules, 20 Tablets" />
            <Input label="Barcode" value={f.barcode} onChange={setMed('barcode')} placeholder="e.g. 8964000..." />
          </div>

          <div className="grid grid-cols-3 gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Purchase Price (Rs.)</label>
              <input
                type="number"
                value={f.purchasePrice}
                onChange={setMed('purchasePrice')}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Retail Price (MSRP) *</label>
              <input
                type="number"
                value={f.salePrice}
                onChange={setMed('salePrice')}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Wholesale Price</label>
              <input
                type="number"
                value={f.wholesalePrice}
                onChange={setMed('wholesalePrice')}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold text-emerald-700"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Optional Inward Batch to Inventory */}
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stockInBatch}
                onChange={(e) => setStockInBatch(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="font-extrabold text-emerald-950 text-xs">
                3. Stock In Initial Batch to Inventory (Immediate FEFO Inward)
              </span>
            </label>
            <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
              Auto-Stock
            </span>
          </div>

          {stockInBatch && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              <Input label="Batch Number *" value={b.batchNo} onChange={setBatch('batchNo')} placeholder="e.g. BT-8891" />
              <Input label="Expiry Date *" type="date" value={b.expiry} onChange={setBatch('expiry')} />
              <Input label="Inward Quantity *" type="number" value={b.qty} onChange={setBatch('qty')} />
            </div>
          )}
        </div>

        {/* Recently Added in this session */}
        {addedList.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 block">
              ✓ Added under {activeCompanyName} in this session ({addedList.length}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {addedList.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {item.name}
                  {item.qty > 0 && (
                    <span className="text-indigo-600 font-mono text-[10px] font-bold">
                      ({item.qty} units · {item.batchNo})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Save & Add Another from {activeCompanyName.split(' ')[0] || 'Company'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Save & Finish
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
