import { useState, useMemo } from 'react'
import {
  useDB,
  fmt,
  medicineById,
  recordStockAudit,
  getStockAudits,
  todayStr,
} from '../lib/db'
import {
  ClipboardCheck,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Printer,
  Calendar,
  User,
  Package,
  Layers,
  Sparkles,
  Check,
  FileSpreadsheet,
} from 'lucide-react'

export default function StockAuditDashboard() {
  const db = useDB()
  const [auditorName, setAuditorName] = useState(db.session?.name || 'Dr. Pharmacist')
  const [auditNotes, setAuditNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterReason, setFilterReason] = useState('ALL')
  const [successMsg, setSuccessMsg] = useState('')

  // Active worksheet of items being audited right now
  // [{ medicineId, medicineName, company, systemStock, physicalStock, variance, costPrice, salePrice, reason, note }]
  const [worksheet, setWorksheet] = useState(() => {
    // Pre-populate with first 10 medicines so user immediately sees live items to count
    return (db.medicines || []).slice(0, 8).map((m) => {
      const bList = (db.batches || []).filter((b) => b.medicineId === m.id && b.qty > 0)
      const sysUnits = bList.reduce((acc, b) => acc + Number(b.qty || 0), 0)
      return {
        medicineId: m.id,
        medicineName: m.name,
        company: m.manufacturer || 'General',
        systemStock: sysUnits,
        physicalStock: sysUnits, // Initially matching
        variance: 0,
        costPrice: Number(m.purchasePrice) || 0,
        salePrice: Number(m.salePrice) || 0,
        reason: 'Matched',
        note: '',
      }
    })
  })

  // Medicines available to add into worksheet
  const availableMedicines = useMemo(() => {
    const inWorksheetIds = new Set(worksheet.map((w) => w.medicineId))
    const list = (db.medicines || []).filter((m) => !inWorksheetIds.has(m.id))
    if (!searchQuery.trim()) return list.slice(0, 15)
    const q = searchQuery.toLowerCase()
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.generic?.toLowerCase().includes(q) ||
        (m.manufacturer || '').toLowerCase().includes(q)
    )
  }, [db.medicines, worksheet, searchQuery])

  // Add medicine to worksheet
  const addMedicineToWorksheet = (m) => {
    const bList = (db.batches || []).filter((b) => b.medicineId === m.id && b.qty > 0)
    const sysUnits = bList.reduce((acc, b) => acc + Number(b.qty || 0), 0)
    setWorksheet((prev) => [
      ...prev,
      {
        medicineId: m.id,
        medicineName: m.name,
        company: m.manufacturer || 'General',
        systemStock: sysUnits,
        physicalStock: sysUnits,
        variance: 0,
        costPrice: Number(m.purchasePrice) || 0,
        salePrice: Number(m.salePrice) || 0,
        reason: 'Matched',
        note: '',
      },
    ])
    setSearchQuery('')
  }

  // Update physical count for an item
  const updatePhysicalCount = (medicineId, val) => {
    const physical = Math.max(0, parseInt(val, 10) || 0)
    setWorksheet((prev) =>
      prev.map((item) => {
        if (item.medicineId !== medicineId) return item
        const variance = physical - item.systemStock
        let defaultReason = 'Matched'
        if (variance < 0) defaultReason = 'Damage / Broken'
        else if (variance > 0) defaultReason = 'Excess / Found'
        return {
          ...item,
          physicalStock: physical,
          variance,
          reason: item.reason === 'Matched' ? defaultReason : item.reason,
        }
      })
    )
  }

  // Update reason
  const updateReason = (medicineId, reason) => {
    setWorksheet((prev) =>
      prev.map((item) => (item.medicineId === medicineId ? { ...item, reason } : item))
    )
  }

  // Remove item from worksheet
  const removeItem = (medicineId) => {
    setWorksheet((prev) => prev.filter((item) => item.medicineId !== medicineId))
  }

  // Worksheet summary calculations
  const summary = useMemo(() => {
    let matched = 0
    let kamItems = 0
    let zyadaItems = 0
    let kamUnits = 0
    let zyadaUnits = 0
    let netVarianceCost = 0

    for (const it of worksheet) {
      const v = it.variance
      const cost = it.costPrice || 0
      if (v === 0) {
        matched++
      } else if (v < 0) {
        kamItems++
        kamUnits += Math.abs(v)
        netVarianceCost -= Math.abs(v) * cost
      } else {
        zyadaItems++
        zyadaUnits += v
        netVarianceCost += v * cost
      }
    }

    return {
      total: worksheet.length,
      matched,
      kamItems,
      zyadaItems,
      kamUnits,
      zyadaUnits,
      netVarianceCost,
    }
  }, [worksheet])

  // Commit and Reconcile Stock
  const handleReconcileAndSave = () => {
    if (!worksheet.length) {
      alert('آڈٹ شیٹ خالی ہے۔ کم از کم ایک دوا شامل کریں۔')
      return
    }

    try {
      const auditResult = recordStockAudit({
        title: `Physical Audit (${todayStr()})`,
        auditor: auditorName,
        items: worksheet,
        reconcile: true, // Updates batches in db
      })

      setSuccessMsg(`سٹاک آڈٹ کامیابی سے مکمل ہو گیا! کمپیوٹر سٹاک فزیکل گنتی کے مطابق اپ ڈیٹ کر دیا گیا ہے۔`)
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      alert('Error saving audit: ' + err.message)
    }
  }

  // Past Audits List
  const pastAudits = getStockAudits()

  return (
    <div className="space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              فزیکل سٹاک آڈٹ اور پڑتال ڈیش بورڈ
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Physical Stock Count vs Computer Stock Reconciliation (Kam / Zyada)
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
            <span>پرنٹ شیٹ (Print)</span>
          </button>

          <button
            type="button"
            onClick={handleReconcileAndSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>سٹاک برابر کریں (Reconcile System)</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* Total Items Under Audit */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">زیرِ آڈٹ آئٹمز</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{summary.total}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">گنتی میں شامل ادویات</div>
          </div>
        </div>

        {/* Matched Count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">برابر سٹاک (Matched)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700">{summary.matched}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">کمپیوٹر اور دکان برابر</div>
          </div>
        </div>

        {/* Shortage (Kam Stock) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">کم مال (Shortage)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">{summary.kamItems} آئٹمز</div>
            <div className="text-[11px] text-rose-600 font-semibold mt-0.5">-{summary.kamUnits} Units غائب/خراب</div>
          </div>
        </div>

        {/* Surplus (Zyada Stock) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">زیادہ مال (Excess)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-700">{summary.zyadaItems} آئٹمز</div>
            <div className="text-[11px] text-blue-600 font-semibold mt-0.5">+{summary.zyadaUnits} Units فالتو گنتی</div>
          </div>
        </div>

        {/* Financial Variance Impact */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">مالی فرق (Net Variance)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              💰
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-black ${summary.netVarianceCost < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {summary.netVarianceCost < 0 ? `- ${fmt(Math.abs(summary.netVarianceCost))}` : `+ ${fmt(summary.netVarianceCost)}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary.netVarianceCost < 0 ? 'نقصان / کمی' : 'منافع / اضافی'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Counting & Audit Sheet */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Auditor & Search Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-bold text-slate-700">آڈیٹر کا نام:</label>
              <input
                type="text"
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Quick Search & Add Medicine */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="آڈٹ شیٹ میں شامل کرنے کے لیے دوا کا نام لکھیں..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />

            {/* Dropdown with search matches */}
            {searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {!availableMedicines.length && (
                  <div className="p-3 text-xs text-slate-400 text-center">کوئی دوا نہیں ملی</div>
                )}
                {availableMedicines.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addMedicineToWorksheet(m)}
                    className="w-full p-2.5 text-left hover:bg-amber-50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.manufacturer || 'General'}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      + شیٹ میں شامل کریں
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Worksheet Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4">دوا کا نام (Medicine)</th>
                <th className="py-3 px-3">کمپنی (Company)</th>
                <th className="py-3 px-3 text-center">کمپیوٹر سٹاک</th>
                <th className="py-3 px-4 text-center">فزیکل گنتی (Physical Count)</th>
                <th className="py-3 px-3 text-center">فرق (Variance)</th>
                <th className="py-3 px-3 text-right">نقصان / منافع (PKR)</th>
                <th className="py-3 px-3">وجہ (Reason / Action)</th>
                <th className="py-3 px-3 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!worksheet.length && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    شیٹ خالی ہے۔ ادویات شامل کرنے کے لیے اوپر سرچ کریں۔
                  </td>
                </tr>
              )}
              {worksheet.map((item) => {
                const isShortage = item.variance < 0
                const isSurplus = item.variance > 0
                const isMatch = item.variance === 0
                const varianceValue = item.variance * item.costPrice

                return (
                  <tr key={item.medicineId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                      {item.medicineName}
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-medium">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {item.company}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                      {item.systemStock} Units
                    </td>

                    {/* Physical Count Input */}
                    <td className="py-2 px-4 text-center">
                      <div className="inline-flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          value={item.physicalStock}
                          onChange={(e) => updatePhysicalCount(item.medicineId, e.target.value)}
                          className={`w-20 px-2.5 py-1.5 border rounded-xl text-center font-black text-sm transition-all focus:outline-none focus:ring-2 ${
                            isShortage
                              ? 'border-rose-400 bg-rose-50/60 text-rose-700 focus:ring-rose-500/20'
                              : isSurplus
                              ? 'border-blue-400 bg-blue-50/60 text-blue-700 focus:ring-blue-500/20'
                              : 'border-slate-300 bg-white text-slate-900 focus:ring-amber-500/20'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Variance Badge */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                          isShortage
                            ? 'bg-rose-100 text-rose-800'
                            : isSurplus
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isMatch ? '✓ 0 (برابر)' : (item.variance > 0 ? `+${item.variance} (زیادہ)` : `${item.variance} (کم)`)}
                      </span>
                    </td>

                    {/* Cost Impact */}
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      <span className={isShortage ? 'text-rose-600' : isSurplus ? 'text-blue-600' : 'text-slate-400'}>
                        {isMatch ? '—' : fmt(varianceValue)}
                      </span>
                    </td>

                    {/* Reason Selector */}
                    <td className="py-3 px-3">
                      <select
                        value={item.reason}
                        onChange={(e) => updateReason(item.medicineId, e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-medium bg-white text-slate-700"
                      >
                        <option value="Matched">برابر (No Discrepancy)</option>
                        <option value="Damage / Broken">ٹوٹ پھوٹ (Damage/Broken)</option>
                        <option value="Theft / Missing">گمشدہ یا چوری (Missing/Theft)</option>
                        <option value="Expired Disposed">ایکسپائر ضائع شدہ (Expired)</option>
                        <option value="Supplier Less Delivered">سپلائر نے کم بھیجا (Invoice Issue)</option>
                        <option value="Counting Error">پہلے گنتی کی غلطی تھی (Count Error)</option>
                        <option value="Excess / Found">اضافی مال ملا (Found in store)</option>
                      </select>
                    </td>

                    {/* Action delete */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.medicineId)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Action Footer */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            کل آئٹمز: <strong className="text-slate-800">{worksheet.length}</strong> · کم مال: <strong className="text-rose-600">{summary.kamItems}</strong> · زیادہ مال: <strong className="text-blue-600">{summary.zyadaItems}</strong>
          </div>

          <button
            type="button"
            onClick={handleReconcileAndSave}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>آڈٹ محفوظ کریں اور سٹاک برابر کریں (Reconcile Stock)</span>
          </button>
        </div>
      </div>

      {/* 4. Past Audit History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>گزشتہ آڈٹ ریکارڈز (Past Audit History)</span>
          </h2>
          <span className="text-xs text-slate-400">{pastAudits.length} آڈٹ سیشنز محفوظ ہیں</span>
        </div>

        {!pastAudits.length && (
          <p className="text-xs text-slate-400 py-6 text-center">ابھی تک کوئی آڈٹ ریکارڈ محفوظ نہیں ہوا۔</p>
        )}

        <div className="divide-y divide-slate-100">
          {pastAudits.map((a) => (
            <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <span>{a.title || 'Physical Stock Audit'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    بذریعہ: {a.auditor}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  تاریخ: {new Date(a.date).toLocaleDateString('en-PK')} · کل آئٹمز: {a.totalItemsChecked || a.items?.length || 0}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-bold text-slate-700">
                    کم مال: <span className="text-rose-600 font-bold">{a.kamItemsCount || 0}</span> · زیادہ: <span className="text-blue-600 font-bold">{a.zyadaItemsCount || 0}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    نیٹ فرق: {fmt(a.netVarianceCost || 0)}
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Reconciled
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
