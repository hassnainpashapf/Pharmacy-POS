import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  useDB,
  fmt,
  medicineById,
  supplierById,
  savePurchaseReturn,
  adjustStockStatus,
  todayStr,
} from '../lib/db'
import {
  Clock,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Tag,
  Search,
  Printer,
  Calendar,
  Building2,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Filter,
  DollarSign,
  TrendingDown,
} from 'lucide-react'

export default function ExpiryDashboard() {
  const db = useDB()
  const navigate = useNavigate()
  const [filterTab, setFilterTab] = useState('CRITICAL') // 'ALL' | 'EXPIRED' | 'CRITICAL' | 'NEAR' | 'SAFE'
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('ALL')
  const [returnModalBatch, setReturnModalBatch] = useState(null)
  const [returnQty, setReturnQty] = useState(1)
  const [returnSupplierId, setReturnSupplierId] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const medicines = db.medicines || []
  const batches = db.batches || []
  const suppliers = db.suppliers || []
  const now = new Date()

  // Process all batches with days left and status
  const analyzedBatches = useMemo(() => {
    return batches.map((b) => {
      const med = medicineById(b.medicineId)
      const qty = Number(b.qty) || 0
      const cost = Number(b.purchasePrice) || Number(med?.purchasePrice) || 0
      const sale = Number(b.salePrice) || Number(med?.salePrice) || 0
      const company = (med?.manufacturer || med?.company || 'Unassigned').trim()

      let daysLeft = 999
      let isExpired = false
      let isCritical = false // 0 - 30 days
      let isNear = false // 31 - 90 days
      let isSafe = false // > 90 days

      if (b.expiry) {
        const exp = new Date(b.expiry)
        daysLeft = Math.round((exp - now) / (1000 * 60 * 60 * 24))
        if (daysLeft < 0) {
          isExpired = true
        } else if (daysLeft <= 30) {
          isCritical = true
        } else if (daysLeft <= 90) {
          isNear = true
        } else {
          isSafe = true
        }
      }

      return {
        ...b,
        medicineName: med?.name || 'Unknown Medicine',
        generic: med?.generic || '',
        company,
        qty,
        cost,
        sale,
        totalCost: qty * cost,
        totalSale: qty * sale,
        daysLeft,
        isExpired,
        isCritical,
        isNear,
        isSafe,
      }
    })
  }, [batches, medicines])

  // Top summary KPIs
  const stats = useMemo(() => {
    let expiredBatches = 0
    let expiredCost = 0
    let expiredUnits = 0

    let criticalBatches = 0
    let criticalCost = 0
    let criticalUnits = 0

    let nearBatches = 0
    let nearCost = 0
    let nearUnits = 0

    let safeBatches = 0
    let safeCost = 0
    let safeUnits = 0

    for (const b of analyzedBatches) {
      if (b.qty <= 0) continue
      if (b.isExpired) {
        expiredBatches++
        expiredCost += b.totalCost
        expiredUnits += b.qty
      } else if (b.isCritical) {
        criticalBatches++
        criticalCost += b.totalCost
        criticalUnits += b.qty
      } else if (b.isNear) {
        nearBatches++
        nearCost += b.totalCost
        nearUnits += b.qty
      } else {
        safeBatches++
        safeCost += b.totalCost
        safeUnits += b.qty
      }
    }

    return {
      expiredBatches,
      expiredCost,
      expiredUnits,
      criticalBatches,
      criticalCost,
      criticalUnits,
      nearBatches,
      nearCost,
      nearUnits,
      safeBatches,
      safeCost,
      safeUnits,
      totalRiskCost: expiredCost + criticalCost,
    }
  }, [analyzedBatches])

  // Distinct companies in batches
  const distinctCompanies = useMemo(() => {
    const s = new Set()
    for (const b of analyzedBatches) {
      if (b.company) s.add(b.company)
    }
    return Array.from(s).sort()
  }, [analyzedBatches])

  // Filtered batch records
  const filteredBatches = useMemo(() => {
    return analyzedBatches.filter((b) => {
      // Must have qty > 0 to be actionable
      if (b.qty <= 0) return false

      // Tab filter
      if (filterTab === 'EXPIRED' && !b.isExpired) return false
      if (filterTab === 'CRITICAL' && !b.isCritical) return false
      if (filterTab === 'NEAR' && !b.isNear) return false
      if (filterTab === 'SAFE' && !b.isSafe) return false

      // Company filter
      if (companyFilter !== 'ALL' && b.company !== companyFilter) return false

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          b.medicineName.toLowerCase().includes(q) ||
          b.batchNo.toLowerCase().includes(q) ||
          b.company.toLowerCase().includes(q)
        );
      }

      return true
    }).sort((a, b) => a.daysLeft - b.daysLeft)
  }, [analyzedBatches, filterTab, companyFilter, search])

  // Handle Return to Supplier submit
  const handleReturnSubmit = (e) => {
    e.preventDefault()
    if (!returnModalBatch) return

    try {
      const supId = returnSupplierId || (suppliers[0]?.id || '')
      if (!supId) {
        alert('Please select a supplier.')
        return
      }

      savePurchaseReturn({
        supplierId: supId,
        items: [
          {
            medicineId: returnModalBatch.medicineId,
            medicineName: returnModalBatch.medicineName,
            batchId: returnModalBatch.id,
            batchNo: returnModalBatch.batchNo,
            expiry: returnModalBatch.expiry,
            qty: Number(returnQty),
            purchasePrice: returnModalBatch.cost,
            reason: returnModalBatch.isExpired ? 'Expired Stock' : 'Near Expiry Return',
            note: returnNote || 'Action from Expiry Dashboard',
          },
        ],
        settlementType: 'CREDIT_NOTE',
        note: returnNote,
      })

      setActionSuccess(`Successfully returned ${returnQty} units of batch ${returnModalBatch.batchNo} to supplier. Debit note generated.`)
      setTimeout(() => setActionSuccess(''), 5000)
      setReturnModalBatch(null)
    } catch (err) {
      alert('Return error: ' + err.message)
    }
  }

  // Handle Dispose / Damaged write-off
  const handleDispose = (batch) => {
    if (confirm(`Are you sure you want to write off all ${batch.qty} units of ${batch.medicineName} (Batch ${batch.batchNo}) as damaged/disposed?`)) {
      try {
        adjustStockStatus(batch.id, 'DAMAGED', batch.qty, 'Expired and Disposed / Waste')
        setActionSuccess(`Batch ${batch.batchNo} written off as damaged/disposed.`)
        setTimeout(() => setActionSuccess(''), 4000)
      } catch (err) {
        alert('Adjustment error: ' + err.message)
      }
    }
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#714B67] text-white flex items-center justify-center font-black shadow-md shadow-[#714B67]/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Batch & Expiry Action
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              FEFO Inventory & Returns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/purchase-returns')}
            className="px-3.5 py-1.5 rounded-xl bg-[#714B67] hover:bg-[#5c3c54] text-white text-xs font-bold shadow-md shadow-[#714B67]/20 flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Returns Hub</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Expired Batches */}
        <div
          onClick={() => setFilterTab('EXPIRED')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            filterTab === 'EXPIRED'
              ? 'bg-[#f5eef4]/60 border-[#714B67] ring-2 ring-[#714B67]/20'
              : 'bg-white border-slate-200 hover:border-[#714B67]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Expired</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">
              {stats.expiredBatches}
            </div>
            <div className="text-[11px] mt-0.5 text-slate-400 font-medium">
              Loss: {fmt(stats.expiredCost)}
            </div>
          </div>
        </div>

        {/* Critical (0-30 Days) */}
        <div
          onClick={() => setFilterTab('CRITICAL')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            filterTab === 'CRITICAL'
              ? 'bg-[#f5eef4]/60 border-[#714B67] ring-2 ring-[#714B67]/20'
              : 'bg-white border-slate-200 hover:border-[#714B67]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Critical (0–30d)</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {stats.criticalBatches}
            </div>
            <div className="text-[11px] mt-0.5 text-slate-400 font-medium">
              Value: {fmt(stats.criticalCost)}
            </div>
          </div>
        </div>

        {/* Near Expiry (31-90 Days) */}
        <div
          onClick={() => setFilterTab('NEAR')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            filterTab === 'NEAR'
              ? 'bg-[#f5eef4]/60 border-[#714B67] ring-2 ring-[#714B67]/20'
              : 'bg-white border-slate-200 hover:border-[#714B67]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Near (31–90d)</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {stats.nearBatches}
            </div>
            <div className="text-[11px] mt-0.5 text-slate-400 font-medium">
              Value: {fmt(stats.nearCost)}
            </div>
          </div>
        </div>

        {/* Safe Stock (>90 Days) */}
        <div
          onClick={() => setFilterTab('SAFE')}
          className={`border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all ${
            filterTab === 'SAFE'
              ? 'bg-[#f5eef4]/60 border-[#714B67] ring-2 ring-[#714B67]/20'
              : 'bg-white border-slate-200 hover:border-[#714B67]/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Safe (&gt;90d)</span>
            <div className="w-8 h-8 rounded-lg bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#008f8b]">
              {stats.safeBatches}
            </div>
            <div className="text-[11px] mt-0.5 text-slate-400 font-medium">
              Value: {fmt(stats.safeCost)}
            </div>
          </div>
        </div>

        {/* Total Financial Risk */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Total Risk</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-rose-600">
              {fmt(stats.totalRiskCost)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Expired + Critical
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filters & Batch Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl">
            {[
              ['CRITICAL', `0–30 Days (${stats.criticalBatches})`],
              ['EXPIRED', `Expired (${stats.expiredBatches})`],
              ['NEAR', `31–90 Days (${stats.nearBatches})`],
              ['SAFE', `Safe (${stats.safeBatches})`],
              ['ALL', `All (${analyzedBatches.filter(b => b.qty > 0).length})`],
            ].map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setFilterTab(tabKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterTab === tabKey
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Company Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">🏢 All Companies ({distinctCompanies.length})</option>
                {distinctCompanies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search medicine or batch..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
              />
            </div>
          </div>
        </div>

        {/* Batches Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-2.5 px-4">Medicine</th>
                <th className="py-2.5 px-3">Batch</th>
                <th className="py-2.5 px-3">Expiry</th>
                <th className="py-2.5 px-3 text-center">Days Left</th>
                <th className="py-2.5 px-3 text-right">Stock</th>
                <th className="py-2.5 px-3 text-right">Cost</th>
                <th className="py-2.5 px-3 text-right">Value (PKR)</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!filteredBatches.length && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No batches found matching this filter.
                  </td>
                </tr>
              )}
              {filteredBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 text-sm leading-tight">{b.medicineName}</div>
                    <div className="text-[11px] text-[#714B67] font-semibold mt-0.5">{b.company}</div>
                  </td>

                  <td className="py-3 px-3 font-mono font-bold text-slate-700">
                    {b.batchNo}
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-600 font-medium">
                    {b.expiry || 'N/A'}
                  </td>

                  {/* Days Left Badge */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-black ${
                        b.isExpired
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : b.isCritical
                          ? 'bg-orange-100 text-orange-800 border border-orange-300'
                          : b.isNear
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {b.isExpired ? '⚠️ Expired' : `${b.daysLeft} days left`}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-black text-sm text-slate-900">
                    {b.qty}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                    {fmt(b.cost)}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                    {fmt(b.totalCost)}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Return to Supplier Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setReturnModalBatch(b)
                          setReturnQty(b.qty)
                          setReturnSupplierId(b.supplierId || suppliers[0]?.id || '')
                          setReturnNote(`Expiry Return (${b.daysLeft} days remaining)`)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all"
                        title="Issue purchase return debit note to supplier"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Return</span>
                      </button>

                      {/* Dispose / Damaged write-off */}
                      <button
                        type="button"
                        onClick={() => handleDispose(b)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        title="Write off as damaged / expired"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return to Supplier Modal */}
      {returnModalBatch && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Return Batch to Supplier</h3>
                  <p className="text-[11px] text-slate-500">Create Supplier Return & Debit Note</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalBatch(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-5 space-y-4 text-xs font-sans">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{returnModalBatch.medicineName}</div>
                <div className="text-slate-500">
                  Company: <strong>{returnModalBatch.company}</strong> · Batch: <strong className="font-mono">{returnModalBatch.batchNo}</strong>
                </div>
                <div className="text-slate-500">
                  Current Stock: <strong>{returnModalBatch.qty} Units</strong> · Cost Rate: <strong className="font-mono">{fmt(returnModalBatch.cost)}</strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Supplier / Distributor</label>
                <select
                  value={returnSupplierId}
                  onChange={(e) => setReturnSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.company || 'Distributor'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Return Quantity (Units)</label>
                  <input
                    type="number"
                    min="1"
                    max={returnModalBatch.qty}
                    required
                    value={returnQty}
                    onChange={(e) => setReturnQty(Math.min(returnModalBatch.qty, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Refund Value (Debit Note)</label>
                  <div className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl font-mono font-black text-[#714B67] text-sm">
                    {fmt(returnQty * returnModalBatch.cost)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Return Reason / Note</label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Near expiry / Expired return claim..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnModalBatch(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#714B67] hover:bg-[#5c3c54] text-white font-bold shadow-md shadow-[#714B67]/20 transition-all"
                >
                  Generate Debit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
