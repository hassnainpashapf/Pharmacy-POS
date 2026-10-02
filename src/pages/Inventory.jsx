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
  recordStockAudit,
  getStockAudits,
  savePurchaseOrder,
  todayStr,
} from '../lib/db'
import {
  Search,
  Building2,
  Plus,
  Minus,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Printer,
  Download,
  RotateCcw,
  ShoppingBag,
  Check,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react'
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
  // Batch & Expiry opens the near-expiry FEFO view, and Stock Audit opens physical verification.
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('tab')
    setTab(['ALL', 'AVAILABLE', 'NEAR_EXPIRY', 'EXPIRED', 'DAMAGED', 'RETURNED', 'adjustments', 'audit'].includes(requested) ? requested : 'ALL')
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
          ['audit', `📋 Stock Audit (Kam / Zyada)`],
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

      {tab !== 'audit' && (
        <MedicineGroupFilter
          value={group}
          onChange={setGroup}
          counts={tab === 'adjustments' ? adjustmentCounts : batchCounts}
          unit={tab === 'adjustments' ? 'adjustments' : 'batches'}
          context={tab === 'adjustments' ? 'current search' : 'current search and stock status'}
        />
      )}
      {tab !== 'audit' && (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-slate-500" role="status">
            Showing <b className="text-slate-800">{tab === 'adjustments' ? filteredAdjustments.length : batches.length}</b> {tab === 'adjustments' ? 'adjustments' : 'batches'}
            {tab !== 'adjustments' && <> · {batches.reduce((total, batch) => total + (Number(batch.qty) || 0), 0)} stock units</>}
          </p>
          {(search || group !== 'all') && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Clear form & search</button>}
        </div>
      )}

      {/* One row per batch; keep the table scrollable on smaller screens. */}
      {tab !== 'adjustments' && tab !== 'audit' && (
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

      {/* Stock Audit (Kam vs Zyada) View */}
      {tab === 'audit' && (
        <StockAuditView
          db={db}
          companyFilter={companyFilter}
          onCompanyChange={setCompanyFilter}
          distinctCompanies={distinctCompanies}
        />
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

export function StockAuditView({ db, companyFilter = 'all', onCompanyChange, distinctCompanies = [] }) {
  const [q, setQ] = useState('')
  const [varianceFilter, setVarianceFilter] = useState('ALL') // 'ALL' | 'KAM' | 'ZYADA' | 'MATCHED'
  const [subTab, setSubTab] = useState('worksheet') // 'worksheet' | 'history'
  const [auditTitle, setAuditTitle] = useState(`Physical Stock Audit — ${todayStr()}`)
  const [physicalCounts, setPhysicalCounts] = useState({})
  const [selectedForPO, setSelectedForPO] = useState(new Set())
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [reconciledConfirmOpen, setReconciledConfirmOpen] = useState(false)

  const medicines = db.medicines || []
  const batches = db.batches || []
  const suppliers = db.suppliers || []
  const pastAudits = getStockAudits()

  // Calculate live system stock vs physical count for all medicines
  const auditData = useMemo(() => {
    return medicines.map((m) => {
      const activeBatches = batches.filter(
        (b) => b.medicineId === m.id && b.qty > 0 && b.status !== 'EXPIRED' && b.status !== 'DAMAGED'
      )
      const systemStock = activeBatches.reduce((a, b) => a + Number(b.qty), 0)
      const countEntered = physicalCounts[m.id]
      const physicalStock = countEntered !== undefined && countEntered !== '' ? Number(countEntered) : systemStock
      const variance = physicalStock - systemStock
      const costPrice = m.purchasePrice != null ? m.purchasePrice : Math.round((m.salePrice || 100) * 0.75)
      const salePrice = m.salePrice || 0
      const financialImpact = variance * costPrice

      let varianceType = 'MATCHED'
      if (variance < 0) varianceType = 'KAM'
      else if (variance > 0) varianceType = 'ZYADA'

      return {
        medicine: m,
        systemStock,
        physicalStock,
        variance,
        varianceType,
        costPrice,
        salePrice,
        financialImpact,
      }
    })
  }, [medicines, batches, physicalCounts])

  // Summary Metrics
  const kamItems = useMemo(() => auditData.filter((x) => x.variance < 0), [auditData])
  const zyadaItems = useMemo(() => auditData.filter((x) => x.variance > 0), [auditData])
  const matchedItems = useMemo(() => auditData.filter((x) => x.variance === 0), [auditData])

  const totalKamUnits = useMemo(() => kamItems.reduce((a, b) => a + Math.abs(b.variance), 0), [kamItems])
  const totalZyadaUnits = useMemo(() => zyadaItems.reduce((a, b) => a + b.variance, 0), [zyadaItems])
  const totalKamLoss = useMemo(() => kamItems.reduce((a, b) => a + Math.abs(b.financialImpact), 0), [kamItems])
  const totalZyadaSurplus = useMemo(() => zyadaItems.reduce((a, b) => a + b.financialImpact, 0), [zyadaItems])
  const netVarianceValuation = totalZyadaSurplus - totalKamLoss

  // Filtered rows for active worksheet
  const displayRows = useMemo(() => {
    return auditData.filter((row) => {
      const m = row.medicine
      // Company filter
      if (companyFilter !== 'all') {
        const c = (m.manufacturer || 'Unassigned').trim().toLowerCase()
        if (c !== companyFilter.trim().toLowerCase()) return false
      }
      // Status filter
      if (varianceFilter === 'KAM' && row.varianceType !== 'KAM') return false
      if (varianceFilter === 'ZYADA' && row.varianceType !== 'ZYADA') return false
      if (varianceFilter === 'MATCHED' && row.varianceType !== 'MATCHED') return false

      // Search query
      if (q.trim()) {
        const query = q.toLowerCase()
        const text = `${m.name} ${m.generic || ''} ${m.barcode || ''} ${m.manufacturer || ''}`.toLowerCase()
        if (!text.includes(query)) return false
      }
      return true
    })
  }, [auditData, companyFilter, varianceFilter, q])

  function handleCountChange(medId, val) {
    const num = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)
    setPhysicalCounts((prev) => ({
      ...prev,
      [medId]: num,
    }))
  }

  function adjustCount(medId, currentPhysical, delta) {
    const nextVal = Math.max(0, currentPhysical + delta)
    handleCountChange(medId, nextVal)
  }

  function handleResetAll() {
    if (confirm('Reset all entered counts back to match system stock?')) {
      setPhysicalCounts({})
      setFeedbackMsg('Physical counts reset to match system.')
      setTimeout(() => setFeedbackMsg(''), 4000)
    }
  }

  function handleOpenPOModalForKam() {
    if (kamItems.length === 0) {
      alert('Audit count mein koi medicine Kam (short) nahi hai.')
      return
    }
    const s = new Set()
    kamItems.forEach((x) => s.add(x.medicine.id))
    setSelectedForPO(s)
    setPoModalOpen(true)
  }

  function togglePOSelect(medId) {
    setSelectedForPO((prev) => {
      const next = new Set(prev)
      next.has(medId) ? next.delete(medId) : next.add(medId)
      return next
    })
  }

  function handleSaveAudit(reconcile = false) {
    const itemsToSave = auditData.map((d) => ({
      medicineId: d.medicine.id,
      medicineName: `${d.medicine.name} ${d.medicine.strength || ''}`,
      systemStock: d.systemStock,
      physicalStock: d.physicalStock,
      variance: d.variance,
      varianceType: d.varianceType,
      costPrice: d.costPrice,
      salePrice: d.salePrice,
    }))

    const record = recordStockAudit({
      title: auditTitle,
      items: itemsToSave,
      reconcile,
    })

    setReconciledConfirmOpen(false)
    setFeedbackMsg(`✓ Stock Audit ${record.auditNo} successfully saved! (${record.kamCount} Kam, ${record.zyadaCount} Zyada)${reconcile ? ' · Inventory Batches Reconciled' : ''}`)
    setTimeout(() => setFeedbackMsg(''), 7000)
  }

  function handleExportCSV() {
    const header = ['Medicine', 'Strength', 'Generic', 'Manufacturer', 'System Stock', 'Physical Count', 'Discrepancy (Units)', 'Status', 'Unit Cost', 'Financial Impact (Rs.)']
    const rows = displayRows.map((r) => [
      `"${r.medicine.name}"`,
      `"${r.medicine.strength || ''}"`,
      `"${r.medicine.generic || ''}"`,
      `"${r.medicine.manufacturer || 'Unassigned'}"`,
      r.systemStock,
      r.physicalStock,
      r.variance,
      r.varianceType === 'KAM' ? 'KAM (Shortage)' : r.varianceType === 'ZYADA' ? 'ZYADA (Surplus)' : 'MATCHED (OK)',
      r.costPrice,
      r.financialImpact,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const encoded = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encoded)
    link.setAttribute('download', `Stock_Audit_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {feedbackMsg}
          </span>
          <button onClick={() => setFeedbackMsg('')} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* Top Banner Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Stock Audit & Physical Verification</span>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Kam vs Zyada Medicines
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical count vs system inventory verification. Detect shortages & surpluses, and generate Purchase Orders.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* ⚡ Generate Purchase Order Button */}
          <button
            type="button"
            onClick={handleOpenPOModalForKam}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2 shrink-0 animate-pulse hover:animate-none"
            title="Automatically create a Purchase Order for all deficit medicines"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>⚡ Generate Purchase Order ({kamItems.length} Kam)</span>
          </button>

          {/* Save Audit Button */}
          <button
            type="button"
            onClick={() => handleSaveAudit(false)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            title="Save this audit count record without adjusting system stock"
          >
            <CheckCircle2 className="w-4 h-4" /> Save Audit
          </button>

          {/* Reconcile Batches Button */}
          <button
            type="button"
            onClick={() => setReconciledConfirmOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            title="Adjust system inventory batches to match physical count"
          >
            <RotateCcw className="w-4 h-4" /> Reconcile Stock
          </button>

          {/* Print & CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards (Kam vs Zyada) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Kam Medicines (Shortages) */}
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-4 h-4" /> 🔻 Kam Medicines (Shortages)
            </span>
            <span className="text-[10px] font-bold bg-rose-200/80 px-2 py-0.5 rounded-full">
              Deficit
            </span>
          </div>
          <div className="text-2xl font-black text-rose-900 tracking-tight">
            {kamItems.length} <span className="text-sm font-semibold text-rose-700">Products</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2 text-rose-800 font-medium pt-2 border-t border-rose-200/60">
            <span>Missing Units: <b>-{totalKamUnits}</b></span>
            <span>Cost Loss: <b>Rs. {fmt(totalKamLoss)}</b></span>
          </div>
        </div>

        {/* Card 2: Zyada Medicines (Surplus / Excess) */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> 🔺 Zyada Medicines (Surplus)
            </span>
            <span className="text-[10px] font-bold bg-emerald-200/80 px-2 py-0.5 rounded-full">
              Excess
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-900 tracking-tight">
            {zyadaItems.length} <span className="text-sm font-semibold text-emerald-700">Products</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2 text-emerald-800 font-medium pt-2 border-t border-emerald-200/60">
            <span>Surplus Units: <b>+{totalZyadaUnits}</b></span>
            <span>Excess Value: <b>Rs. {fmt(totalZyadaSurplus)}</b></span>
          </div>
        </div>

        {/* Card 3: Matched Stock */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-600" /> ✓ Matched Stock (Accurate)
            </span>
            <span className="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded-full text-slate-700">
              0 Variance
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {matchedItems.length} <span className="text-sm font-semibold text-slate-500">Products</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2 text-slate-600 font-medium pt-2 border-t border-slate-200">
            <span>Accuracy Rate: <b>{medicines.length ? Math.round((matchedItems.length / medicines.length) * 100) : 100}%</b></span>
            <span>Net Discrepancy: <b>Rs. {fmt(netVarianceValuation)}</b></span>
          </div>
        </div>

        {/* Card 4: Purchase Order Call-to-Action */}
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-indigo-700 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" /> 📋 Purchase Order Ready
              </span>
              <span className="text-[10px] font-bold bg-indigo-200/70 px-2 py-0.5 rounded-full text-indigo-900">
                Action
              </span>
            </div>
            <p className="text-xs text-indigo-900 font-bold mt-1">
              {kamItems.length > 0 ? `${kamItems.length} medicines need restocking` : 'All inventory levels verified'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenPOModalForKam}
            disabled={kamItems.length === 0}
            className={`mt-2 w-full py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
              kamItems.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Draft Purchase Order</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub Tabs: Live Worksheet vs Audit History */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('worksheet')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              subTab === 'worksheet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Audit Worksheet ({auditData.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              subTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit History Ledger ({pastAudits.length})
          </button>
        </div>

        {subTab === 'worksheet' && (
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 underline"
          >
            Reset Physical Counts
          </button>
        )}
      </div>

      {/* VIEW 1: Live Audit Worksheet */}
      {subTab === 'worksheet' && (
        <div className="space-y-3">
          {/* Worksheet Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            {/* Variance Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-500 mr-1">Filter by Variance:</span>
              <button
                type="button"
                onClick={() => setVarianceFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  varianceFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Items ({auditData.length})
              </button>
              <button
                type="button"
                onClick={() => setVarianceFilter('KAM')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  varianceFilter === 'KAM'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                🔻 Kam (Shortage) ({kamItems.length})
              </button>
              <button
                type="button"
                onClick={() => setVarianceFilter('ZYADA')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  varianceFilter === 'ZYADA'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                🔺 Zyada (Surplus) ({zyadaItems.length})
              </button>
              <button
                type="button"
                onClick={() => setVarianceFilter('MATCHED')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                  varianceFilter === 'MATCHED'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Matched ({matchedItems.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search audit lines..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Audit Worksheet Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3 text-center w-10">PO</th>
                    <th className="p-3 text-left">Medicine & Strength</th>
                    <th className="p-3 text-left">Pharma Company</th>
                    <th className="p-3 text-center">System Stock</th>
                    <th className="p-3 text-center">Physical Count (Shelf)</th>
                    <th className="p-3 text-center">Audit Variance (Kam / Zyada)</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Valuation Impact</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayRows.map((row) => {
                    const m = row.medicine
                    const isKam = row.variance < 0
                    const isZyada = row.variance > 0
                    const isMatched = row.variance === 0
                    const isPOSelected = selectedForPO.has(m.id)

                    return (
                      <tr
                        key={m.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isKam ? 'bg-rose-50/30' : isZyada ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        {/* Checkbox for PO */}
                        <td className="p-3 text-center">
                          {isKam ? (
                            <input
                              type="checkbox"
                              checked={isPOSelected}
                              onChange={() => togglePOSelect(m.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              title="Include in Purchase Order"
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Medicine */}
                        <td className="p-3 text-left font-bold text-slate-900">
                          {m.name} <span className="font-normal text-slate-500">{m.strength}</span>
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {m.generic || dosageFormValue(m) || 'Item'}
                          </span>
                        </td>

                        {/* Company */}
                        <td className="p-3 text-left font-medium text-slate-700">
                          {m.manufacturer ? (
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700 font-semibold">
                              {m.manufacturer}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* System Stock */}
                        <td className="p-3 text-center font-bold text-slate-800 font-mono text-sm">
                          {row.systemStock}
                        </td>

                        {/* Physical Count with [-] and [+] Quick Adjusters */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => adjustCount(m.id, row.physicalStock, -1)}
                              className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-200 cursor-pointer text-xs"
                              title="Minus 1"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={row.physicalStock}
                              onChange={(e) => handleCountChange(m.id, e.target.value)}
                              className="w-14 text-center font-black font-mono text-slate-900 bg-white border-0 outline-none text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => adjustCount(m.id, row.physicalStock, 1)}
                              className="w-6 h-6 rounded bg-white hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center border border-slate-200 cursor-pointer text-xs"
                              title="Plus 1"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Variance Badge */}
                        <td className="p-3 text-center">
                          {isKam && (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full font-extrabold text-[11px]">
                              🔻 {Math.abs(row.variance)} Kam (Shortage)
                            </span>
                          )}
                          {isZyada && (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full font-extrabold text-[11px]">
                              🔺 +{row.variance} Zyada (Surplus)
                            </span>
                          )}
                          {isMatched && (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold text-[11px]">
                              ✓ Matched (OK)
                            </span>
                          )}
                        </td>

                        {/* Unit Cost */}
                        <td className="p-3 text-right font-mono text-slate-600">
                          {fmt(row.costPrice)}
                        </td>

                        {/* Financial Impact */}
                        <td className={`p-3 text-right font-bold font-mono ${
                          isKam ? 'text-rose-600 font-extrabold' : isZyada ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {isKam ? `-Rs. ${fmt(Math.abs(row.financialImpact))}` : isZyada ? `+Rs. ${fmt(row.financialImpact)}` : 'Rs. 0'}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          {isKam ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedForPO(new Set([m.id]))
                                setPoModalOpen(true)
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] transition-colors"
                            >
                              + PO
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!displayRows.length && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                        No medicines match the selected filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Audit History Ledger */}
      {subTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-extrabold text-slate-900 text-sm">
              📜 Past Stock Audits History ({pastAudits.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3 text-left">Audit #</th>
                  <th className="p-3 text-left">Date & Time</th>
                  <th className="p-3 text-left">Title / Auditor</th>
                  <th className="p-3 text-center">🔻 Kam Items</th>
                  <th className="p-3 text-center">🔺 Zyada Items</th>
                  <th className="p-3 text-right">Shortage Loss</th>
                  <th className="p-3 text-right">Surplus Value</th>
                  <th className="p-3 text-center">Reconciled</th>
                  <th className="p-3 text-center">Linked PO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastAudits.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">{a.auditNo}</td>
                    <td className="p-3 text-slate-600">{new Date(a.date).toLocaleString()}</td>
                    <td className="p-3 font-semibold text-slate-800">
                      {a.title}
                      <span className="block text-[10px] text-slate-400 font-normal">Auditor: {a.auditor}</span>
                    </td>
                    <td className="p-3 text-center font-bold text-rose-600">
                      {a.kamCount > 0 ? `🔻 ${a.kamCount} items (-${a.totalKamUnits}u)` : '✓ 0'}
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-600">
                      {a.zyadaCount > 0 ? `🔺 ${a.zyadaCount} items (+${a.totalZyadaUnits}u)` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-rose-600 font-bold">
                      {a.totalKamCost > 0 ? `Rs. ${fmt(a.totalKamCost)}` : 'Rs. 0'}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-600 font-semibold">
                      {a.totalZyadaCost > 0 ? `Rs. ${fmt(a.totalZyadaCost)}` : 'Rs. 0'}
                    </td>
                    <td className="p-3 text-center">
                      {a.reconciled ? (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                          ✓ Reconciled
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-medium">
                          Audit Only
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {a.poNo ? (
                        <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {a.poNo}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!pastAudits.length && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                      No stock audits recorded yet. Conduct an audit above to track physical inventory variances!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Stock Reconciliation */}
      {reconciledConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-2xl border border-slate-300 space-y-3 text-xs">
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Confirm Inventory Reconciliation
            </h3>
            <p className="text-slate-600">
              Are you sure you want to adjust system inventory batches to match your entered physical counts?
            </p>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-1 text-amber-900">
              <div>• <b>{kamItems.length} Kam items</b> will have their batches reduced by <b>{totalKamUnits} units</b>.</div>
              <div>• <b>{zyadaItems.length} Zyada items</b> will have surplus batches added (<b>+{totalZyadaUnits} units</b>).</div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReconciledConfirmOpen(false)}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveAudit(true)}
                className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs"
              >
                Yes, Reconcile Batches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Purchase Order Modal for Kam items */}
      {poModalOpen && (
        <AuditPOModal
          kamItems={kamItems}
          selectedIds={selectedForPO}
          onToggleId={togglePOSelect}
          suppliers={suppliers}
          onClose={() => setPoModalOpen(false)}
          onSuccess={(po) => {
            setPoModalOpen(false)
            setFeedbackMsg(`✓ Purchase Order ${po.poNo} created for ${po.items.length} items! You can view or print it in Purchases & PO.`)
          }}
        />
      )}
    </div>
  )
}

function AuditPOModal({ kamItems = [], selectedIds = new Set(), onToggleId, suppliers = [], onClose, onSuccess }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [poNote, setPoNote] = useState('Stock audit shortage replenishment')
  const [orderQtys, setOrderQtys] = useState(() => {
    const map = {}
    kamItems.forEach((it) => {
      map[it.medicine.id] = Math.abs(it.variance)
    })
    return map
  })

  const selectedItems = kamItems.filter((it) => selectedIds.has(it.medicine.id))

  const totalCost = selectedItems.reduce((acc, it) => {
    const q = Number(orderQtys[it.medicine.id]) || Math.abs(it.variance)
    return acc + q * it.costPrice
  }, 0)

  function handleCreate() {
    if (selectedItems.length === 0) {
      alert('Please select at least one medicine for the Purchase Order.')
      return
    }

    const poItems = selectedItems.map((it) => ({
      medicineId: it.medicine.id,
      name: `${it.medicine.name} ${it.medicine.strength || ''}`,
      qty: Number(orderQtys[it.medicine.id]) || Math.abs(it.variance),
      purchasePrice: it.costPrice,
      salePrice: it.salePrice,
      note: `Audit shortage: ${Math.abs(it.variance)} units deficit`,
    }))

    const po = savePurchaseOrder({
      supplierId,
      items: poItems,
      source: 'AUDIT',
      note: poNote,
    })

    onSuccess(po)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[92vh] overflow-y-auto custom-scroll shadow-2xl border border-slate-300 space-y-4 text-xs">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              ⚡ Generate Purchase Order for Kam Medicines (Shortages)
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Review and auto-generate supplier PO for all medicines detected as deficit in the physical audit.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        {/* Supplier Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/70 rounded-xl border border-indigo-200">
          <div>
            <label className="block font-extrabold text-indigo-950 mb-1">
              Select Supplier / Distributor *
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-white border border-indigo-300 rounded px-2.5 py-1.5 font-bold text-indigo-950"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.company || 'Distributor'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-extrabold text-indigo-950 mb-1">
              Purchase Order Notes / Reference
            </label>
            <input
              type="text"
              value={poNote}
              onChange={(e) => setPoNote(e.target.value)}
              className="w-full bg-white border border-indigo-300 rounded px-2.5 py-1.5 font-medium"
            />
          </div>
        </div>

        {/* Selected Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-2.5 text-center w-10">Include</th>
                <th className="p-2.5 text-left">Medicine & Strength</th>
                <th className="p-2.5 text-center">Audit Deficit</th>
                <th className="p-2.5 text-center">Order Qty</th>
                <th className="p-2.5 text-right">Est. Cost</th>
                <th className="p-2.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kamItems.map((it) => {
                const isSelected = selectedIds.has(it.medicine.id)
                const qty = Number(orderQtys[it.medicine.id]) || Math.abs(it.variance)
                const lineTotal = qty * it.costPrice
                return (
                  <tr key={it.medicine.id} className={isSelected ? 'bg-indigo-50/30' : 'opacity-60 bg-slate-50'}>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleId(it.medicine.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">
                      {it.medicine.name} <span className="font-normal text-slate-500">{it.medicine.strength}</span>
                      <span className="block text-[10px] text-slate-400 font-normal">{it.medicine.manufacturer}</span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-rose-600">
                      -{Math.abs(it.variance)} units
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        value={qty}
                        disabled={!isSelected}
                        onChange={(e) => setOrderQtys({ ...orderQtys, [it.medicine.id]: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-center font-bold font-mono bg-white"
                      />
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600">
                      {fmt(it.costPrice)}
                    </td>
                    <td className="p-2.5 text-right font-bold font-mono text-indigo-700">
                      {fmt(lineTotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Total Summary */}
        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <span className="text-slate-500 font-semibold block">Total Selected Items:</span>
            <strong className="text-slate-900 text-sm">{selectedItems.length} of {kamItems.length} Products</strong>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-semibold block">Estimated Purchase Value:</span>
            <strong className="text-emerald-700 text-base font-mono">{fmt(totalCost)}</strong>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm inline-flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" /> Generate Official Purchase Order ({selectedItems.length} Items)
          </button>
        </div>
      </div>
    </div>
  )
}

