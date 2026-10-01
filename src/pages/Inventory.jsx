import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import {
  useDB,
  fmt,
  medicineById,
  adjustStockStatus,
  getStockStatusSummary,
  getStockAdjustments,
} from '../lib/db'
import { Search } from 'lucide-react'
import MedicineGroupFilter from '../components/MedicineGroupFilter'
import { batchMatchesStockTab, dosageFormValue, filterMedicineRecords } from '../lib/medicineGroups'

export default function Inventory() {
  const db = useDB()
  let location = { search: '' }
  try {
    location = useLocation()
  } catch {}
  const [tab, setTab] = useState('ALL')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('all')
  const [reclassModal, setReclassModal] = useState(null)
  const adjustments = getStockAdjustments()

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
      medicineFor: (batch) => medicineById(batch.medicineId),
      extraSearch: (batch) => [batch.batchNo],
    }
  )
  const { matches: filteredAdjustments, counts: adjustmentCounts } = filterMedicineRecords(adjustments, {
    query: search,
    group,
    medicineFor: (adjustment) => medicineById(adjustment.medicineId),
    extraSearch: (adjustment) => [adjustment.medicineName, adjustment.batchNo, adjustment.reason, adjustment.by],
  })
  const clearFilters = () => { setSearch(''); setGroup('all') }

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Compact row-based inventory toolbar */}
      <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{tab === 'NEAR_EXPIRY' ? 'Batch & Expiry' : 'Stock Management'}</span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-sm border border-indigo-200">
              FEFO Managed
            </span>
          </h2>
          {tab === 'NEAR_EXPIRY' && <p className="text-xs text-slate-600 mt-1">Expiring within 90 days</p>}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inventory"
            placeholder="Batch, medicine, barcode, form..."
            className="w-full bg-slate-50 border border-slate-300 rounded-sm pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
          />
        </div>
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
              {['Medicine & Strength', 'Form', 'Batch #', 'Mfg Date', 'Expiry Date', 'Status', 'Stock Units', 'Cost Price', 'Retail Price', 'Actions'].map((heading) => <th key={heading} scope="col" className={`p-3 whitespace-nowrap ${['Stock Units', 'Cost Price', 'Retail Price'].includes(heading) ? 'text-right' : ''}`}>{heading}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-200">
              {batches.map((batch) => <InventoryBatchRow key={batch.id} batch={batch} medicine={medicineById(batch.medicineId)} now={now} onReclassify={() => setReclassModal(batch)} />)}
              {!batches.length && <tr><td colSpan={10} className="p-8 text-center text-slate-500">No batches match this dosage form, stock status, and search. Try another form or status, or clear the search.</td></tr>}
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
