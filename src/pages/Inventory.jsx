import { useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router'
import {
  useDB,
  fmt,
  medicineById,
  adjustStockStatus,
  getStockStatusSummary,
  getStockAdjustments,
  addBatch,
  addMedicine,
} from '../lib/db'
import { Search, Building2, Plus, CheckCircle2 } from 'lucide-react'
import MedicineGroupFilter from '../components/MedicineGroupFilter'
import {
  batchMatchesStockTab,
  dosageFormValue,
  filterMedicineRecords,
  getDistinctCompanies,
  DOSAGE_FORM_OPTIONS,
} from '../lib/medicineGroups'

export default function Inventory() {
  const db = useDB()
  let location = { search: '' }
  try {
    location = useLocation()
  } catch {}
  const [tab, setTab] = useState('ALL')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [reclassModal, setReclassModal] = useState(null)
  const [companyStockInOpen, setCompanyStockInOpen] = useState(false)
  const adjustments = getStockAdjustments()

  const distinctCompanies = useMemo(() => getDistinctCompanies(db.medicines || []), [db.medicines])

  // Compute stock units per company for badge counts
  const companyStockCounts = useMemo(() => {
    const map = {}
    for (const b of (db.batches || [])) {
      const m = medicineById(b.medicineId)
      const c = (m?.manufacturer || 'Unassigned').trim()
      map[c] = (map[c] || 0) + (Number(b.qty) || 0)
    }
    return map
  }, [db.batches, db.medicines])

  // Keep sidebar deep-links separate: Stock Management opens all stock while
  // Batch & Expiry opens the near-expiry FEFO view.
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab')
    setTab(['ALL', 'AVAILABLE', 'NEAR_EXPIRY', 'EXPIRED', 'DAMAGED', 'RETURNED', 'adjustments'].includes(requested) ? requested : 'ALL')
  }, [location.search])

  const summary = getStockStatusSummary()

  const now = new Date()

  const allBatches = db.batches || []
  const { matches: batches, counts: batchCounts } = filterMedicineRecords(
    allBatches.filter((batch) => batchMatchesStockTab(batch, tab, now)),
    {
      query: search,
      group,
      company: companyFilter,
      medicineFor: (batch) => medicineById(batch.medicineId),
      extraSearch: (batch) => [batch.batchNo],
    }
  )
  const { matches: filteredAdjustments, counts: adjustmentCounts } = filterMedicineRecords(adjustments, {
    query: search,
    group,
    company: companyFilter,
    medicineFor: (adjustment) => medicineById(adjustment.medicineId),
    extraSearch: (adjustment) => [adjustment.medicineName, adjustment.batchNo, adjustment.reason, adjustment.by],
  })
  const clearFilters = () => { setSearch(''); setGroup('all'); setCompanyFilter('all') }

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Compact row-based inventory toolbar */}
      <div className="pb-4 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{tab === 'NEAR_EXPIRY' ? 'Batch & Expiry' : 'Stock Management'}</span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-sm border border-indigo-200">
              FEFO Managed
            </span>
          </h2>
          {tab === 'NEAR_EXPIRY' && <p className="text-xs text-slate-600 mt-1">Expiring within 90 days</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[170px] truncate"
              aria-label="Filter inventory by pharmaceutical company"
            >
              <option value="all">🏢 All Companies ({distinctCompanies.length})</option>
              {distinctCompanies.map((c) => (
                <option key={c} value={c}>
                  {c} {companyStockCounts[c] != null ? `(${companyStockCounts[c]} u)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 sm:w-64 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search inventory"
              placeholder="Batch, medicine, barcode, form..."
              className="w-full bg-slate-50 border border-slate-300 rounded-sm pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Stock In by Company Button */}
          <button
            type="button"
            onClick={() => setCompanyStockInOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-sm text-xs font-bold transition-colors shadow-sm inline-flex items-center gap-1.5 shrink-0"
            title="Stock in batches grouped by pharma manufacturer delivery invoice"
          >
            <Building2 className="w-4 h-4" /> Stock In by Company
          </button>
        </div>
      </div>

      {/* Quick Company Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scroll">
        <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <Building2 className="w-3 h-3 text-slate-400" /> By Company:
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
          All Companies
        </button>
        {distinctCompanies.slice(0, 10).map((comp) => {
          const units = companyStockCounts[comp] || 0
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
              {comp} {units > 0 && <span className="text-[10px] opacity-75 font-mono ml-0.5">({units}u)</span>}
            </button>
          )
        })}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-0.5 rounded-sm border border-slate-300 w-fit">
        {[
          ['ALL', `All Batches (${allBatches.length})`],
          ['AVAILABLE', `Available (${summary.available} units)`],
          ['NEAR_EXPIRY', `Near Expiry (FEFO) (${allBatches.filter((b) => batchMatchesStockTab(b, 'NEAR_EXPIRY', now) && b.qty > 0).reduce((a, b) => a + b.qty, 0)} units)`],
          ['EXPIRED', `Expired (${summary.expired} units)`],
          ['DAMAGED', `Damaged (${summary.damaged} units)`],
          ['RETURNED', `Returned (${summary.returned} units)`],
          ['adjustments', `Adjustment History (${adjustments.length})`],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`px-3 py-1 rounded-sm text-xs font-bold transition-all ${
              tab === k ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <MedicineGroupFilter
        value={group}
        onChange={setGroup}
        counts={tab === 'adjustments' ? adjustmentCounts : batchCounts}
        unit={tab === 'adjustments' ? 'adjustments' : 'batches'}
        context={tab === 'adjustments' ? 'current search' : 'current search and stock status'}
      />
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-slate-500" role="status">
          Showing <b className="text-slate-800">{tab === 'adjustments' ? filteredAdjustments.length : batches.length}</b> {tab === 'adjustments' ? 'adjustments' : 'batches'}
          {tab !== 'adjustments' && <> · {batches.reduce((total, batch) => total + (Number(batch.qty) || 0), 0)} stock units</>}
        </p>
        {(search || group !== 'all') && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Clear form & search</button>}
      </div>

      {/* One row per batch; keep the table scrollable on smaller screens. */}
      {tab !== 'adjustments' && (
        <section aria-label="Inventory batch list" className="bg-white border border-slate-200 overflow-x-auto" tabIndex={0}>
          <table className="w-full min-w-[1100px] text-xs text-left">
            <caption className="sr-only">Inventory batches</caption>
            <thead className="bg-slate-50 border-b border-slate-200"><tr>
              {['Medicine & Strength', 'Form', 'Company', 'Batch #', 'Mfg Date', 'Expiry Date', 'Status', 'Stock Units', 'Cost Price', 'Retail Price', 'Actions'].map((heading) => <th key={heading} scope="col" className={`p-3 whitespace-nowrap ${['Stock Units', 'Cost Price', 'Retail Price'].includes(heading) ? 'text-right' : ''}`}>{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-200">
              {batches.map((batch) => <InventoryBatchRow key={batch.id} batch={batch} medicine={medicineById(batch.medicineId)} now={now} onReclassify={() => setReclassModal(batch)} />)}
              {!batches.length && <tr><td colSpan={11} className="p-8 text-center text-slate-500">No batches match this dosage form, stock status, company, and search. Try another form or status, or clear the search.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {/* Adjustments Audit Log */}
      {tab === 'adjustments' && (
        <section className="bg-white border border-slate-200 overflow-x-auto" aria-label="Stock adjustment ledger" tabIndex={0}>
          <table className="w-full min-w-[720px] text-xs">
            <caption className="text-left p-4 font-bold text-slate-800">Stock adjustment ledger</caption>
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 text-left">Timestamp</th>
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-center">Batch #</th>
                <th className="p-3 text-center">Qty Reclassified</th>
                <th className="p-3 text-center">Transition</th>
                <th className="p-3 text-left">Reason / Note</th>
                <th className="p-3 text-center">Audited By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdjustments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 text-left text-slate-500">{new Date(a.date).toLocaleString()}</td>
                  <td className="p-3 text-left font-bold text-slate-800">{a.medicineName}</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-700">{a.batchNo}</td>
                  <td className="p-3 text-center font-black text-indigo-700">{a.qty} units</td>
                  <td className="p-3 text-center font-bold">
                    <span className="text-slate-500">{a.fromStatus}</span> →{' '}
                    <span className="text-indigo-600">{a.toStatus}</span>
                  </td>
                  <td className="p-3 text-left text-slate-600">{a.reason}</td>
                  <td className="p-3 text-center font-semibold text-slate-700">{a.by}</td>
                </tr>
              ))}
              {!filteredAdjustments.length && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 font-semibold">
                    {adjustments.length ? 'No adjustments match this dosage form and search.' : 'No stock status reclassifications logged yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Reclassification Modal */}
      {reclassModal && (
        <ReclassifyModal
          batch={reclassModal}
          onClose={() => setReclassModal(null)}
        />
      )}

      {/* Stock In by Company Modal */}
      {companyStockInOpen && (
        <CompanyStockInModal
          distinctCompanies={distinctCompanies}
          onClose={() => setCompanyStockInOpen(false)}
        />
      )}
    </div>
  )
}

export function InventoryBatchRow({ batch, medicine, now = new Date(), onReclassify }) {
  const expiryTime = batch.expiry ? new Date(batch.expiry).getTime() : NaN
  const knownExpiry = Number.isFinite(expiryTime)
  const expired = knownExpiry && expiryTime < now.getTime()
  const daysLeft = knownExpiry ? Math.ceil((expiryTime - now.getTime()) / 86400000) : null
  const status = expired ? 'EXPIRED' : String(batch.status || 'AVAILABLE').toUpperCase()
  const statusClass = status === 'AVAILABLE' || status === 'ACTIVE' ? 'bg-[#e6f7f2] text-[#008784] border-teal-200' : status === 'EXPIRED' || status === 'DAMAGED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-[#f5eef4] text-[#714B67] border-purple-200'
  return <tr className="hover:bg-slate-50 transition-colors">
    <th scope="row" className="p-3 min-w-48 font-bold text-slate-900">{medicine?.name || 'Unknown medicine'} <span className="font-medium text-slate-500">{medicine?.strength}</span></th>
    <td className="p-3">{dosageFormValue(medicine) || 'Dosage form not specified'}</td>
    <td className="p-3">
      {medicine?.manufacturer ? (
        <span className="text-indigo-700 font-semibold bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
          {medicine.manufacturer}
        </span>
      ) : (
        <span className="text-slate-400 italic">Unassigned</span>
      )}
    </td>
    <td className="p-3 font-mono">{batch.batchNo || 'Not recorded'}</td>
    <td className="p-3 whitespace-nowrap">{batch.mfgDate || 'Not recorded'}</td>
    <td className={`p-3 whitespace-nowrap ${expired ? 'text-rose-700' : daysLeft !== null && daysLeft <= 90 ? 'text-amber-700' : 'text-slate-700'}`}>
      <span className="font-semibold">{batch.expiry || 'Not recorded'}</span>
      <p className="text-[10px] mt-1">{expired ? 'Past expiry · review stock' : daysLeft === null ? 'Expiry needs review' : `${daysLeft} days left`}</p>
    </td>
    <td className="p-3"><span className={`border rounded-full px-2 py-1 text-[10px] font-bold whitespace-nowrap ${statusClass}`}>{status}</span></td>
    <td className="p-3 text-right font-bold tabular-nums">{batch.qty}</td>
    <td className="p-3 text-right tabular-nums whitespace-nowrap">{fmt(batch.purchasePrice)}</td>
    <td className="p-3 text-right font-semibold tabular-nums whitespace-nowrap">{fmt(batch.salePrice)}</td>
    <td className="p-3"><button type="button" onClick={onReclassify} aria-label={`Reclassify ${medicine?.name || 'medicine'}, batch ${batch.batchNo || 'not recorded'}`} className="rounded-lg bg-[#f5eef4] border border-[#714B67]/20 text-[#714B67] hover:bg-[#714B67] hover:text-white px-3 py-2 text-xs font-bold transition-colors">Reclassify</button></td>
  </tr>
}

function ReclassifyModal({ batch, onClose }) {
  const med = medicineById(batch.medicineId)
  const [qty, setQty] = useState(batch.qty)
  const [toStatus, setToStatus] = useState('DAMAGED')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  function handleSubmit() {
    setErr('')
    try {
      adjustStockStatus({
        batchId: batch.id,
        qty: Number(qty),
        toStatus,
        reason,
      })
      onClose()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-sm p-5 w-full max-w-md shadow-2xl border border-slate-300 space-y-4">
        <h3 className="font-bold text-base text-slate-900 border-b border-slate-200 pb-2">
          Reclassify Stock Status
        </h3>

        <div className="text-xs space-y-1.5 bg-slate-50 p-2.5 rounded-sm border border-slate-200">
          <div>Medicine: <b>{med?.name} {med?.strength}</b></div>
          <div>Batch: <b className="font-mono">{batch.batchNo}</b> · Available: <b>{batch.qty} units</b></div>
        </div>

        {err && <div className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-sm border border-rose-200">{err}</div>}

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Status</label>
            <select
              value={toStatus}
              onChange={(e) => setToStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 text-xs font-bold"
            >
              <option value="AVAILABLE">AVAILABLE (Active for Sale)</option>
              <option value="DAMAGED">DAMAGED (Broken seal / Broken bottles)</option>
              <option value="EXPIRED">EXPIRED (Past expiry quarantine)</option>
              <option value="RETURNED">RETURNED (Customer return quarantine)</option>
              <option value="RESERVED">RESERVED (Hold for institution)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Quantity to Reclassify (Max: {batch.qty})</label>
            <input
              type="number"
              min="1"
              max={batch.qty}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason / Clinical Audit Note</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Moisture damage during unloading"
              className="w-full bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-sm border border-slate-300 text-slate-600 font-bold text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 rounded-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm"
          >
            Confirm Reclassification
          </button>
        </div>
      </div>
    </div>
  )
}

export function CompanyStockInModal({ distinctCompanies = [], onClose }) {
  const db = useDB()
  const [company, setCompany] = useState(distinctCompanies[0] || 'GSK Pakistan')
  const [customCompany, setCustomCompany] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const activeCompany = isCustom ? customCompany.trim() : company.trim()

  const [selectedMedId, setSelectedMedId] = useState('')
  const [createNewMed, setCreateNewMed] = useState(false)

  // New product fields if creating
  const [newMed, setNewMed] = useState({
    name: '',
    generic: '',
    strength: '',
    dosageForm: 'Tablet',
    packSize: '20 Tablets',
  })

  // Batch fields
  const [b, setB] = useState({
    batchNo: '',
    mfgDate: new Date().toISOString().slice(0, 10),
    expiry: '',
    qty: 50,
    purchasePrice: '',
    salePrice: '',
    supplierId: db.suppliers[0]?.id || '',
  })

  const [addedBatches, setAddedBatches] = useState([])

  const companyMeds = useMemo(() => {
    if (!activeCompany) return []
    return (db.medicines || []).filter(
      (m) => (m.manufacturer || '').toLowerCase().trim() === activeCompany.toLowerCase()
    )
  }, [db.medicines, activeCompany])

  // When active company changes or companyMeds load, set default selected med
  useEffect(() => {
    if (companyMeds.length > 0 && !selectedMedId) {
      setSelectedMedId(companyMeds[0].id)
    }
  }, [companyMeds, selectedMedId])

  // When selected medicine changes, prefill prices
  useEffect(() => {
    if (selectedMedId && !createNewMed) {
      const m = db.medicines.find((x) => x.id === selectedMedId)
      if (m) {
        setB((prev) => ({
          ...prev,
          purchasePrice: m.purchasePrice != null ? m.purchasePrice : Math.round((m.salePrice || 100) * 0.75),
          salePrice: m.salePrice || '',
        }))
      }
    }
  }, [selectedMedId, createNewMed, db.medicines])

  function handleStockIn(andAddAnother = false) {
    if (!activeCompany) {
      alert('Please select or specify a Pharma Company.')
      return
    }

    let targetMedId = selectedMedId
    let medNameForRecord = ''

    if (createNewMed) {
      if (!newMed.name.trim()) {
        alert('Medicine Name is required.')
        return
      }
      const created = addMedicine({
        name: newMed.name.trim(),
        generic: newMed.generic.trim(),
        brand: newMed.name.trim(),
        strength: newMed.strength.trim(),
        dosageForm: newMed.dosageForm,
        form: newMed.dosageForm,
        packSize: newMed.packSize,
        manufacturer: activeCompany,
        purchasePrice: Number(b.purchasePrice) || 0,
        salePrice: Number(b.salePrice) || 0,
      })
      targetMedId = created.id
      medNameForRecord = `${created.name} ${created.strength || ''}`
    } else {
      if (!targetMedId) {
        alert('Please select a medicine or choose "+ Add New Product for this Company".')
        return
      }
      const m = db.medicines.find((x) => x.id === targetMedId)
      medNameForRecord = m ? `${m.name} ${m.strength || ''}` : 'Medicine'
    }

    if (!b.batchNo.trim() || !b.expiry) {
      alert('Batch Number and Expiry Date are required.')
      return
    }

    const inwardQty = Number(b.qty) || 0
    if (inwardQty <= 0) {
      alert('Quantity must be greater than 0.')
      return
    }

    const batch = addBatch({
      medicineId: targetMedId,
      batchNo: b.batchNo.trim(),
      mfgDate: b.mfgDate,
      expiry: b.expiry,
      qty: inwardQty,
      purchasePrice: Number(b.purchasePrice) || 0,
      salePrice: Number(b.salePrice) || 0,
      supplierId: b.supplierId || db.suppliers[0]?.id || '',
      status: 'ACTIVE',
    })

    setAddedBatches((prev) => [
      {
        id: batch.id,
        medName: medNameForRecord,
        batchNo: batch.batchNo,
        qty: batch.qty,
        expiry: batch.expiry,
      },
      ...prev,
    ])

    if (andAddAnother) {
      setB({
        batchNo: '',
        mfgDate: new Date().toISOString().slice(0, 10),
        expiry: '',
        qty: 50,
        purchasePrice: '',
        salePrice: '',
        supplierId: b.supplierId,
      })
      setCreateNewMed(false)
      setNewMed({
        name: '',
        generic: '',
        strength: '',
        dosageForm: 'Tablet',
        packSize: '20 Tablets',
      })
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-sm p-5 w-full max-w-xl max-h-[92vh] overflow-y-auto custom-scroll shadow-2xl border border-slate-300 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Stock In by Pharma Company (Delivery Invoice)
          </h3>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* Step 1: Company Selection */}
        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
          <div className="flex justify-between items-center">
            <label className="font-extrabold text-indigo-950 text-xs">
              1. Pharmaceutical Company / Manufacturer
            </label>
            <button
              type="button"
              onClick={() => setIsCustom(!isCustom)}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline"
            >
              {isCustom ? '← Pick from list' : '+ Type custom company'}
            </button>
          </div>

          {isCustom ? (
            <input
              type="text"
              value={customCompany}
              onChange={(e) => setCustomCompany(e.target.value)}
              placeholder="e.g. Platinum Pharma, Horizon..."
              className="w-full bg-white border border-indigo-300 rounded px-3 py-1.5 text-xs font-bold text-indigo-950"
            />
          ) : (
            <select
              value={company}
              onChange={(e) => {
                setCompany(e.target.value)
                setSelectedMedId('')
              }}
              className="w-full bg-white border border-indigo-300 rounded px-3 py-1.5 text-xs font-bold text-indigo-950"
            >
              {distinctCompanies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {!isCustom && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {['GSK Pakistan', 'Abbott Laboratories', 'Getz Pharma', 'Sanofi Aventis', 'The Searle Company', 'Hilton Pharma', 'Sami Pharmaceuticals'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setCompany(p)
                    setSelectedMedId('')
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all ${
                    company === p
                      ? 'bg-indigo-700 text-white'
                      : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  {p.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          <div className="text-[11px] font-medium text-indigo-800 flex justify-between pt-1">
            <span>Invoice Vendor: <strong>{activeCompany}</strong></span>
            <span>{companyMeds.length} products available for restocking</span>
          </div>
        </div>

        {/* Step 2: Medicine Selection or Quick Creation */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="font-extrabold text-slate-900 text-xs">
              2. Select Product under {activeCompany}
            </span>
            <button
              type="button"
              onClick={() => setCreateNewMed(!createNewMed)}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
            >
              {createNewMed ? '← Choose Existing Product' : '+ Add New Product for this Company'}
            </button>
          </div>

          {!createNewMed ? (
            <div>
              {companyMeds.length > 0 ? (
                <select
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-sm px-3 py-2 text-xs font-bold text-slate-800"
                >
                  <option value="">-- Choose medicine to stock in --</option>
                  {companyMeds.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.strength} ({dosageFormValue(m) || 'Item'}) · {m.packSize || ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  No products registered under <b>{activeCompany}</b> yet. Click <b>"+ Add New Product for this Company"</b> above.
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 bg-white p-2.5 rounded border border-emerald-200">
              <input
                type="text"
                placeholder="Product Name * (e.g. Risek)"
                value={newMed.name}
                onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Strength (e.g. 20mg)"
                value={newMed.strength}
                onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Generic Formula (e.g. Omeprazole)"
                value={newMed.generic}
                onChange={(e) => setNewMed({ ...newMed, generic: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
              />
              <select
                value={newMed.dosageForm}
                onChange={(e) => setNewMed({ ...newMed, dosageForm: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
              >
                {DOSAGE_FORM_OPTIONS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Step 3: Batch and Pricing Information */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
          <span className="font-extrabold text-slate-900 text-xs block">
            3. Batch Delivery Details (Inward FEFO)
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Batch Number *</label>
              <input
                type="text"
                value={b.batchNo}
                onChange={(e) => setB({ ...b, batchNo: e.target.value })}
                placeholder="e.g. BT-7819"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Expiry Date *</label>
              <input
                type="date"
                value={b.expiry}
                onChange={(e) => setB({ ...b, expiry: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                value={b.qty}
                onChange={(e) => setB({ ...b, qty: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Purchase Cost (Rs.)</label>
              <input
                type="number"
                value={b.purchasePrice}
                onChange={(e) => setB({ ...b, purchasePrice: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Retail Price (Rs.)</label>
              <input
                type="number"
                value={b.salePrice}
                onChange={(e) => setB({ ...b, salePrice: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Recently Inwarded Batches in this Session */}
        {addedBatches.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <span className="font-bold text-slate-700 block">
              ✓ Stocked In this Session ({addedBatches.length}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {addedBatches.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-800 px-2 py-1 rounded text-[11px] font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {item.medName}
                  <span className="font-mono text-indigo-600 font-bold">
                    ({item.qty}u · {item.batchNo})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={() => handleStockIn(true)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Stock In & Add Another from {activeCompany.split(' ')[0] || 'Company'}
          </button>
          <button
            type="button"
            onClick={() => handleStockIn(false)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Stock In & Finish
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
