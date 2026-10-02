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
} from 'lucide-react'

export default function PurchaseReturnsDashboard() {
  const db = useDB()
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
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

  // Filtered returns list
  const filteredReturns = useMemo(() => {
    if (!searchQuery.trim()) return allReturns
    const q = searchQuery.toLowerCase()
    return allReturns.filter(
      (r) =>
        r.returnNo.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        (r.items || []).some((it) => it.medicineName.toLowerCase().includes(q))
    )
  }, [allReturns, searchQuery])

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
      alert('براہ کرم سپلائر منتخب کریں۔')
      return
    }
    if (!returnItems.length) {
      alert('واپسی کے لیے کم از کم ایک دوا یا بیچ منتخب کریں۔')
      return
    }

    try {
      const pr = savePurchaseReturn({
        supplierId: selectedSupplierId,
        items: returnItems,
        settlementType,
        note: returnNote,
      })

      setSuccessMsg(`خریداری واپسی ${pr.returnNo} کامیابی سے محفوظ ہو گئی! ڈیبٹ نوٹ جاری کر دیا گیا ہے۔`)
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
    if (confirm('کیا آپ واقعی یہ خریداری واپسی ختم کر کے سٹاک واپس شامل کرنا چاہتے ہیں؟')) {
      deletePurchaseReturn(id)
    }
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shadow-md shadow-rose-600/20">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              خریداری واپسی و ڈیبٹ نوٹ ڈیش بورڈ
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Purchase Returns to Pharma Suppliers & Debit Note Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>پرنٹ لیجر (Print)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedSupplierId(suppliers[0]?.id || '')
              setReturnItems([])
              setShowNewModal(true)
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>نئی خریداری واپسی درج کریں (New Return)</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Returns Recorded */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">کل واپسیاں (Returns)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{stats.totalReturns} رسیدیں</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{stats.totalUnits} Units واپس کیے گئے</div>
          </div>
        </div>

        {/* Total Debit Note Value */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">کل ڈیبٹ رقم (Total Claim)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              💰
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">{fmt(stats.totalAmount)}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">سپلائرز سے وصول طلب / کٹوتی</div>
          </div>
        </div>

        {/* Credit Note Balance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">کھاتے سے کٹوتی (Credit Note)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-700">{fmt(stats.creditNotes)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">بل بقایا سے منہا ہو گئی</div>
          </div>
        </div>

        {/* Cash Refund */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">نقد ریفنڈ (Cash Refund)</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              💵
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-teal-700">{fmt(stats.cashRefunds)}</div>
            <div className="text-[11px] text-teal-600 font-medium mt-0.5">کاؤنٹر کیش وصولی</div>
          </div>
        </div>
      </div>

      {/* 3. Returns List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">محفوظ شدہ ڈیبٹ نوٹ اور واپسیاں</h2>
            <p className="text-xs text-slate-500">سپلائر کو واپس کیے گئے تمام بیجز کی مکمل تاریخ</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="واپسی نمبر یا سپلائر تلاش کریں..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4">ڈیبٹ نوٹ # (Return No)</th>
                <th className="py-3 px-3">تاریخ</th>
                <th className="py-3 px-3">سپلائر / ڈسٹری بیوٹر</th>
                <th className="py-3 px-3">واپس کردہ ادویات (Items)</th>
                <th className="py-3 px-3 text-right">کل ریفنڈ رقم (PKR)</th>
                <th className="py-3 px-3 text-center">سیٹلمنٹ کا طریقہ</th>
                <th className="py-3 px-4 text-center">ایکشن (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!filteredReturns.length && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    کوئی خریداری واپسی ریکارڈ نہیں ملی۔
                  </td>
                </tr>
              )}
              {filteredReturns.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
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

                  <td className="py-3 px-3 text-right font-mono font-black text-rose-700 text-sm">
                    {fmt(r.totalAmount)}
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.settlementType === 'CREDIT_NOTE'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}
                    >
                      {r.settlementType === 'CREDIT_NOTE' ? 'کھاتے سے کٹوتی (Credit Note)' : 'نقد وصولی (Cash)'}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingVoucher(r)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-all"
                        title="ڈیبٹ نوٹ واؤچر پرنٹ کریں"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>واؤچر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteReturn(r.id)}
                        className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="واپسی ختم کریں اور سٹاک بحال کریں"
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
            <div className="p-5 border-b border-slate-100 bg-rose-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">سپلائر کو نئی خریداری واپسی (ڈیبٹ نوٹ)</h3>
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
                  <label className="block font-bold text-slate-700 mb-1">ڈسٹری بیوٹر / فارما سپلائر</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value)
                      setReturnItems([])
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="">-- سپلائر منتخب کریں --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company || 'Distributor'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Settlement Type */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">واپسی کا مالیاتی طریقہ (Settlement)</label>
                  <select
                    value={settlementType}
                    onChange={(e) => setSettlementType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
                  >
                    <option value="CREDIT_NOTE">سپلائر کھاتے سے کٹوتی (Credit Note / Deduction)</option>
                    <option value="CASH_REFUND">نقد کیش ریفنڈ وصولی (Instant Cash Refund)</option>
                  </select>
                </div>
              </div>

              {/* Batches Selector from this supplier */}
              {selectedSupplierId && (
                <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-rose-600" />
                      <span>سپلائر کے دستیاب بیجز میں سے منتخب کریں:</span>
                    </span>
                    <span className="text-[10px] text-slate-400">کلک کر کے لسٹ میں شامل کریں</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                    {!eligibleBatches.length && (
                      <div className="p-3 text-center text-slate-400 text-xs">اس سپلائر کے بیجز نہیں ملے۔</div>
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
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            }`}
                          >
                            {isAdded ? '✓ شامل ہے' : '+ واپسی میں شامل کریں'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Items in Return List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 text-xs">واپسی کے لیے منتخب ادویات ({returnItems.length})</div>

                {!returnItems.length && (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                    اوپر سے دوا کا بیچ منتخب کر کے شامل کریں۔
                  </div>
                )}

                {returnItems.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {returnItems.map((it) => (
                      <div key={it.batchId} className="p-3 flex items-center justify-between gap-3 bg-white">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 truncate">{it.medicineName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            بیچ: {it.batchNo} · زیادہ سے زیادہ: {it.maxQty} u · قیمت: {fmt(it.purchasePrice)}
                          </div>
                        </div>

                        {/* Qty Input */}
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-600">تعداد:</label>
                          <input
                            type="number"
                            min="1"
                            max={it.maxQty}
                            value={it.qty}
                            onChange={(e) => updateItemQty(it.batchId, e.target.value)}
                            className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-rose-700"
                          />
                        </div>

                        {/* Reason */}
                        <select
                          value={it.reason}
                          onChange={(e) => updateItemReason(it.batchId, e.target.value)}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="Expired / Near Expiry">ایکسپائر / قریبی میعاد</option>
                          <option value="Damaged / Broken">ٹوٹ پھوٹ یا لیکج</option>
                          <option value="Wrong Item Delivered">غلط آئٹم آ گیا تھا</option>
                          <option value="Excess / Overstock">اضافی مال / اوور سٹاک</option>
                        </select>

                        {/* Total Cost */}
                        <div className="font-mono font-bold text-rose-700 text-right w-20">
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
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-rose-700 font-bold uppercase tracking-wider">کل کٹوتی رقم (Total Debit Note)</div>
                    <div className="text-xs text-slate-500">{returnItems.length} بیجز واپسی کے لیے منتخب</div>
                  </div>
                  <div className="text-2xl font-black text-rose-700 font-mono">
                    {fmt(currentTotal)}
                  </div>
                </div>
              )}

              {/* Return Note */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">نوٹ / وجہ (Optional Note)</label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="سپلائر کو واپسی کا حوالہ یا بل نمبر..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100"
                >
                  منسوخ کریں
                </button>
                <button
                  type="submit"
                  disabled={!returnItems.length}
                  className="px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold shadow-md shadow-rose-600/20 active:scale-95 transition-all"
                >
                  ڈیبٹ نوٹ جاری کریں (Generate Debit Note)
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
              <span className="font-bold text-slate-800 text-xs">آفیشل ڈیبٹ نوٹ واؤچر (Debit Note Voucher)</span>
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
                <div className="inline-block mt-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-xs uppercase tracking-wider">
                  PURCHASE RETURN DEBIT NOTE
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-100 pb-3">
                <div>
                  <span className="text-slate-400">واؤچر نمبر:</span>{' '}
                  <strong className="font-mono text-rose-700">{viewingVoucher.returnNo}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">تاریخ:</span>{' '}
                  <strong>{viewingVoucher.date}</strong>
                </div>
                <div>
                  <span className="text-slate-400">سپلائر:</span>{' '}
                  <strong>{viewingVoucher.supplierName}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">طریقہ:</span>{' '}
                  <strong>{viewingVoucher.settlementType}</strong>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-slate-200 pb-3">
                <div className="font-bold text-slate-700">واپس کردہ اشیاء (Items):</div>
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
                <span>کل ریفنڈ رقم:</span>
                <span className="text-rose-700 font-mono">{fmt(viewingVoucher.totalAmount)}</span>
              </div>

              <div className="pt-6 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
                <div>
                  دستخط انچارج / فارماسسٹ: ________________
                </div>
                <div>
                  سپلائر وصول کنندہ: ________________
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingVoucher(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs"
              >
                بند کریں
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>پرنٹ کریں</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
