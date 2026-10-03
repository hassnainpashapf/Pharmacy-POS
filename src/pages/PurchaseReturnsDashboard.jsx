import { useState, useMemo } from 'react'
import {
  useDB,
  fmt,
  medicineById,
  supplierById,
  savePurchaseReturn,
  purchaseReturns,
  deletePurchaseReturn,
  todayStr,
} from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from '../components/DateFilterBar'
import {
  RotateCcw,
  Plus,
  Printer,
  Search,
  Building2,
  Trash2,
  CheckCircle2,
  FileText,
  Calendar,
  DollarSign,
  TrendingDown,
  User,
  ArrowRight,
  ShieldCheck,
  Package,
  X,
} from 'lucide-react'

export default function PurchaseReturnsDashboard() {
  const db = useDB()
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useDateFilterState('all')
  const [settlementType, setSettlementType] = useState('CREDIT_NOTE')
  const [returnNote, setReturnNote] = useState('')
  const [viewingVoucher, setViewingVoucher] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // New return items list: [{ medicineId, medicineName, batchId, batchNo, expiry, qty, purchasePrice, total, reason }]
  const [returnItems, setReturnItems] = useState([])

  const suppliers = db.suppliers || []
  const batches = db.batches || []
  const allReturns = purchaseReturns()

  // KPIs
  const stats = useMemo(() => {
    let totalReturns = allReturns.length
    let totalAmount = 0
    let creditNotes = 0
    let cashRefunds = 0
    let totalUnits = 0

    for (const r of allReturns) {
      totalAmount += Number(r.totalAmount) || 0
      if (r.settlementType === 'CREDIT_NOTE') creditNotes += Number(r.totalAmount) || 0
      else cashRefunds += Number(r.totalAmount) || 0
      for (const it of r.items || []) {
        totalUnits += Number(it.qty) || 0
      }
    }

    return {
      totalReturns,
      totalAmount,
      creditNotes,
      cashRefunds,
      totalUnits,
    }
  }, [allReturns])

  const [settlementFilter, setSettlementFilter] = useState('ALL')
  const [supplierFilter, setSupplierFilter] = useState('ALL')

  // Distinct suppliers in returns / database
  const distinctSuppliers = useMemo(() => {
    const set = new Set()
    for (const r of allReturns) {
      if (r.supplierName) set.add(r.supplierName.trim())
    }
    for (const s of suppliers) {
      if (s.name) set.add(s.name.trim())
      if (s.company) set.add(s.company.trim())
    }
    return Array.from(set).filter(Boolean).sort()
  }, [allReturns, suppliers])

  // Filtered returns list
  const filteredReturns = useMemo(() => {
    let list = allReturns.filter((r) => matchesDateFilter(r.date || r.createdAt, dateFilter))
    if (settlementFilter !== 'ALL') {
      list = list.filter((r) => r.settlementType === settlementFilter)
    }
    if (supplierFilter !== 'ALL') {
      const sf = supplierFilter.toLowerCase()
      list = list.filter(
        (r) =>
          (r.supplierName && r.supplierName.toLowerCase().includes(sf)) ||
          r.supplierId === supplierFilter
      )
    }
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (r) =>
        r.returnNo.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        (r.items || []).some((it) => it.medicineName.toLowerCase().includes(q))
    )
  }, [allReturns, dateFilter, settlementFilter, supplierFilter, searchQuery])

  // Available batches for selected supplier or general
  const eligibleBatches = useMemo(() => {
    if (!selectedSupplierId) return []
    return batches.filter(
      (b) =>
        b.qty > 0 &&
        (!b.supplierId || b.supplierId === selectedSupplierId)
    )
  }, [batches, selectedSupplierId])

  // Add a batch to return items
  const addBatchToReturn = (b) => {
    const med = medicineById(b.medicineId)
    const cost = Number(b.purchasePrice) || Number(med?.purchasePrice) || 0

    // Check if already in list
    if (returnItems.some((it) => it.batchId === b.id)) return

    setReturnItems((prev) => [
      ...prev,
      {
        medicineId: b.medicineId,
        medicineName: med?.name || 'Medicine',
        batchId: b.id,
        batchNo: b.batchNo,
        expiry: b.expiry,
        maxQty: b.qty,
        qty: 1,
        purchasePrice: cost,
        total: cost,
        reason: 'Expired / Near Expiry',
      },
    ])
  }

  // Update item in returnItems
  const updateItemQty = (batchId, qty) => {
    const val = Math.max(1, parseInt(qty, 10) || 1)
    setReturnItems((prev) =>
      prev.map((it) => {
        if (it.batchId !== batchId) return it
        const finalQty = Math.min(it.maxQty, val)
        return {
          ...it,
          qty: finalQty,
          total: finalQty * it.purchasePrice,
        }
      })
    )
  }

  const updateItemReason = (batchId, reason) => {
    setReturnItems((prev) =>
      prev.map((it) => (it.batchId === batchId ? { ...it, reason } : it))
    )
  }

  const removeItem = (batchId) => {
    setReturnItems((prev) => prev.filter((it) => it.batchId !== batchId))
  }

  // Grand total of items being returned
  const currentTotal = useMemo(() => {
    return returnItems.reduce((acc, it) => acc + (it.total || 0), 0)
  }, [returnItems])

  // Submit return
  const handleSubmitReturn = (e) => {
    e.preventDefault()
    if (!selectedSupplierId) {
      alert('Please select a supplier.')
      return
    }
    if (!returnItems.length) {
      alert('Please select at least one medicine or batch to return.')
      return
    }

    try {
      const pr = savePurchaseReturn({
        supplierId: selectedSupplierId,
        items: returnItems,
        settlementType,
        note: returnNote,
      })

      setSuccessMsg(`Purchase return ${pr.returnNo} saved successfully! Debit note has been issued.`)
      setTimeout(() => setSuccessMsg(''), 5000)
      setShowNewModal(false)
      setReturnItems([])
      setSelectedSupplierId('')
      setReturnNote('')
      setViewingVoucher(pr)
    } catch (err) {
      alert('Return error: ' + err.message)
    }
  }

  // Revert / Delete return
  const handleDeleteReturn = (id) => {
    if (confirm('Are you sure you want to delete this purchase return and restore the inventory stock?')) {
      deletePurchaseReturn(id)
    }
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#3b1734] text-white flex items-center justify-center font-black shadow-sm border border-[#280c23]">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Purchase Returns & Debit Notes
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Supplier Returns & Debit Vouchers
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
            onClick={() => {
              setSelectedSupplierId(suppliers[0]?.id || '')
              setReturnItems([])
              setShowNewModal(true)
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Return</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Returns Recorded */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Total Returns</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{stats.totalReturns}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{stats.totalUnits} units</div>
          </div>
        </div>

        {/* Total Debit Note Value */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Debit Claims</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#714B67]">{fmt(stats.totalAmount)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total claims</div>
          </div>
        </div>

        {/* Credit Note Balance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Credit Notes</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{fmt(stats.creditNotes)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Payable deduction</div>
          </div>
        </div>

        {/* Cash Refund */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Cash Refunds</span>
            <div className="w-8 h-8 rounded-lg bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#008f8b]">{fmt(stats.cashRefunds)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Direct cash</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Direct Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search return note #, supplier, or medicine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#714B67]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Supplier Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#714B67]" />
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[170px] truncate"
              aria-label="Filter returns by supplier"
            >
              <option value="ALL">🏢 All Suppliers ({distinctSuppliers.length})</option>
              {distinctSuppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Settlement Method Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto">
            {[
              { id: 'ALL', label: `All Returns (${allReturns.length})` },
              { id: 'CREDIT_NOTE', label: `Credit Note (${allReturns.filter(r => r.settlementType === 'CREDIT_NOTE').length})` },
              { id: 'CASH_REFUND', label: `Cash Refund (${allReturns.filter(r => r.settlementType === 'CASH_REFUND').length})` },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSettlementFilter(st.id)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer whitespace-nowrap ${
                  settlementFilter === st.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="pt-2 border-t border-slate-100">
          <DateFilterBar filterState={dateFilter} onChange={setDateFilter} noBorder />
        </div>
      </div>

      {/* 3. Returns List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-900">Debit Notes & Returns ({filteredReturns.length})</h2>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-2.5 px-4">Debit Note</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Supplier</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                <th className="py-3 px-3 text-center">Settlement Method</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!filteredReturns.length && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase returns recorded.
                  </td>
                </tr>
              )}
              {filteredReturns.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-[#714B67] bg-[#f5eef4] px-2 py-0.5 rounded border border-[#decddd]">
                      {r.returnNo}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-medium text-slate-600">
                    {r.date}
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{r.supplierName}</div>
                    <div className="text-[10px] text-slate-400">{r.supplierCompany}</div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      {(r.items || []).map((it, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-slate-800">{it.medicineName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({it.batchNo})</span>
                          <span className="text-slate-500">× {it.qty}</span>
                          <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600">{it.reason}</span>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm">
                    {fmt(r.totalAmount)}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.settlementType === 'CREDIT_NOTE'
                          ? 'bg-[#f5eef4] text-[#714B67] border border-[#decddd]'
                          : 'bg-teal-50 text-[#008f8b] border border-[#b7e5dc]'
                      }`}
                    >
                      {r.settlementType === 'CREDIT_NOTE' ? 'Credit Note' : 'Cash Refund'}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingVoucher(r)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-all"
                        title="Print debit note voucher"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Voucher</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteReturn(r.id)}
                        className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete return and restore stock"
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

      {/* 4. New Return Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">New Purchase Return to Supplier (Debit Note)</h3>
                  <p className="text-[11px] text-slate-500">Record supplier purchase return and issue debit note</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmitReturn} className="p-5 space-y-4 text-xs font-sans overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                {/* Select Supplier */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Distributor / Pharma Supplier</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value)
                      setReturnItems([])
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company || 'Distributor'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Settlement Type */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Settlement Method</label>
                  <select
                    value={settlementType}
                    onChange={(e) => setSettlementType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
                  >
                    <option value="CREDIT_NOTE">Deduct from Supplier Balance (Credit Note)</option>
                    <option value="CASH_REFUND">Cash Refund Received</option>
                  </select>
                </div>
              </div>

              {/* Batches Selector from this supplier */}
              {selectedSupplierId && (
                <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#714B67]" />
                      <span>Select available batches from this supplier:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Click to add to return list</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                    {!eligibleBatches.length && (
                      <div className="p-3 text-center text-slate-400 text-xs">No active batches found for this supplier.</div>
                    )}
                    {eligibleBatches.map((b) => {
                      const med = medicineById(b.medicineId)
                      const isAdded = returnItems.some((it) => it.batchId === b.id)
                      return (
                        <div
                          key={b.id}
                          className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{med?.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Batch: {b.batchNo} · Expiry: {b.expiry || 'N/A'} · Qty: {b.qty} Units
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => addBatchToReturn(b)}
                            className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all ${
                              isAdded
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-[#f5eef4] text-[#714B67] hover:bg-[#f5eef4]/80 border border-[#decddd]'
                            }`}
                          >
                            {isAdded ? '✓ Added' : '+ Add to Return'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Items in Return List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 text-xs">Selected Medicines for Return ({returnItems.length})</div>

                {!returnItems.length && (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                    Select batches from the list above to include in the return.
                  </div>
                )}

                {returnItems.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {returnItems.map((it) => (
                      <div key={it.batchId} className="p-3 flex items-center justify-between gap-3 bg-white">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 truncate">{it.medicineName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Batch: {it.batchNo} · Max: {it.maxQty} u · Cost: {fmt(it.purchasePrice)}
                          </div>
                        </div>

                        {/* Qty Input */}
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-600">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            max={it.maxQty}
                            value={it.qty}
                            onChange={(e) => updateItemQty(it.batchId, e.target.value)}
                            className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                          />
                        </div>

                        {/* Reason */}
                        <select
                          value={it.reason}
                          onChange={(e) => updateItemReason(it.batchId, e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="Expired / Near Expiry">Expired / Near Expiry</option>
                          <option value="Damaged / Broken">Damaged / Broken / Leaked</option>
                          <option value="Wrong Item Delivered">Wrong Item Delivered</option>
                          <option value="Excess / Overstock">Excess / Overstock</option>
                        </select>

                        {/* Total Cost */}
                        <div className="font-mono font-bold text-[#714B67] text-right w-20">
                          {fmt(it.total)}
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeItem(it.batchId)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Calculation Banner */}
              {returnItems.length > 0 && (
                <div className="p-4 bg-[#f5eef4]/60 border border-[#decddd] rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-[#714B67] font-bold uppercase tracking-wider">Total Debit Note Amount</div>
                    <div className="text-xs text-slate-500">{returnItems.length} batches selected for return</div>
                  </div>
                  <div className="text-2xl font-black text-[#714B67] font-mono">
                    {fmt(currentTotal)}
                  </div>
                </div>
              )}

              {/* Return Note */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Return Note / Reason (Optional)</label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Reference invoice number, reason, etc..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!returnItems.length}
                  className="px-6 py-2 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] disabled:opacity-50 text-white font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  Generate Debit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Printable Debit Note Voucher Modal */}
      {viewingVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">Official Debit Note Voucher</span>
              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Printable Voucher Paper */}
            <div className="p-6 space-y-4 font-sans text-xs bg-white">
              <div className="text-center pb-3 border-b border-slate-200">
                <h2 className="text-lg font-black text-slate-900">{db.settings.pharmacyName || 'Pharmacy POS'}</h2>
                <p className="text-[11px] text-slate-500">{db.settings.address || 'Medical Store'}</p>
                <div className="inline-block mt-2 px-3 py-1 rounded-full bg-[#f5eef4] text-[#714B67] border border-[#decddd] font-black text-xs uppercase tracking-wider">
                  PURCHASE RETURN DEBIT NOTE
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-100 pb-3">
                <div>
                  <span className="text-slate-400">Voucher No:</span>{' '}
                  <strong className="font-mono text-[#714B67]">{viewingVoucher.returnNo}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">Date:</span>{' '}
                  <strong>{viewingVoucher.date}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Supplier:</span>{' '}
                  <strong>{viewingVoucher.supplierName}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">Settlement:</span>{' '}
                  <strong>{viewingVoucher.settlementType}</strong>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-slate-200 pb-3">
                <div className="font-bold text-slate-700">Returned Items:</div>
                {(viewingVoucher.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <div>
                      <span className="font-bold text-slate-800">{it.medicineName}</span>{' '}
                      <span className="text-[10px] text-slate-400 font-mono">({it.batchNo}) × {it.qty}</span>
                    </div>
                    <span className="font-mono font-bold">{fmt(it.total)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm font-black pt-1">
                <span>Total Refund Amount:</span>
                <span className="text-[#714B67] font-mono">{fmt(viewingVoucher.totalAmount)}</span>
              </div>

              <div className="pt-6 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
                <div>
                  Pharmacist / Incharge Signature: ________________
                </div>
                <div>
                  Supplier Receiver Signature: ________________
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
