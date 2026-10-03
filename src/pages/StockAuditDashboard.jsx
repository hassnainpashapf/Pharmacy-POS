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
      alert('The audit sheet is empty. Please add at least one medicine.')
      return
    }

    try {
      const auditResult = recordStockAudit({
        title: `Physical Audit (${todayStr()})`,
        auditor: auditorName,
        items: worksheet,
        reconcile: true, // Updates batches in db
      })

      setSuccessMsg(`Stock audit completed successfully! Computer stock has been reconciled with physical count.`)
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
          <div className="w-10 h-10 rounded-xl bg-[#714B67] text-white flex items-center justify-center font-black shadow-md shadow-[#714B67]/20">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Stock Audit Dashboard
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Physical Stock Count & Reconciliation
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
            onClick={handleReconcileAndSave}
            className="px-3.5 py-1.5 rounded-xl bg-[#714B67] hover:bg-[#5c3c54] text-white text-xs font-bold shadow-md shadow-[#714B67]/20 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Reconcile Stock</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Items Under Audit */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Items Audited</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{summary.total}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">In worksheet</div>
          </div>
        </div>

        {/* Matched Count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Matched Stock</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700">{summary.matched}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Zero variance</div>
          </div>
        </div>

        {/* Shortage */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Shortage</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">{summary.kamItems} items</div>
            <div className="text-[11px] text-rose-600 font-semibold mt-0.5">-{summary.kamUnits} units</div>
          </div>
        </div>

        {/* Surplus */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Excess</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-700">{summary.zyadaItems} items</div>
            <div className="text-[11px] text-blue-600 font-semibold mt-0.5">+{summary.zyadaUnits} units</div>
          </div>
        </div>

        {/* Financial Variance Impact */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">Net Variance</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              💰
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-black ${summary.netVarianceCost < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {summary.netVarianceCost < 0 ? `- ${fmt(Math.abs(summary.netVarianceCost))}` : `+ ${fmt(summary.netVarianceCost)}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary.netVarianceCost < 0 ? 'Deficit impact' : 'Surplus impact'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Counting & Audit Sheet */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Auditor & Search Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-bold text-slate-700">Auditor:</label>
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
              placeholder="Search medicine to add..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
            />

            {/* Dropdown with search matches */}
            {searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {!availableMedicines.length && (
                  <div className="p-3 text-xs text-slate-400 text-center">No medicine found</div>
                )}
                {availableMedicines.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addMedicineToWorksheet(m)}
                    className="w-full p-2.5 text-left hover:bg-[#f5eef4]/50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.manufacturer || 'General'}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f5eef4] text-[#714B67] border border-[#decddd]">
                      + Add to Sheet
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
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-3">Company</th>
                <th className="py-3 px-3 text-center">System Stock</th>
                <th className="py-3 px-4 text-center">Physical Count</th>
                <th className="py-3 px-3 text-center">Variance</th>
                <th className="py-3 px-3 text-right">Impact (PKR)</th>
                <th className="py-3 px-3">Reason / Action</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!worksheet.length && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Worksheet is empty. Search medicines above to add items.
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
                        {isMatch ? '✓ 0' : (item.variance > 0 ? `+${item.variance}` : `${item.variance}`)}
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
                        <option value="Matched">Matched</option>
                        <option value="Damage / Broken">Damaged</option>
                        <option value="Theft / Missing">Missing / Theft</option>
                        <option value="Expired Disposed">Expired</option>
                        <option value="Supplier Less Delivered">Short Delivery</option>
                        <option value="Counting Error">Count Error</option>
                        <option value="Excess / Found">Excess Found</option>
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
            Total Items: <strong className="text-slate-800">{worksheet.length}</strong> · Shortage: <strong className="text-rose-600">{summary.kamItems}</strong> · Excess: <strong className="text-blue-600">{summary.zyadaItems}</strong>
          </div>

          <button
            type="button"
            onClick={handleReconcileAndSave}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#714B67] hover:bg-[#5c3c54] text-white font-bold text-xs shadow-md shadow-[#714B67]/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Audit & Reconcile Stock</span>
          </button>
        </div>
      </div>

      {/* 4. Past Audit History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#714B67]" />
            <span>Past Audit History</span>
          </h2>
          <span className="text-xs text-slate-400">{pastAudits.length} audit sessions recorded</span>
        </div>

        {!pastAudits.length && (
          <p className="text-xs text-slate-400 py-6 text-center">No past audit sessions found.</p>
        )}

        <div className="divide-y divide-slate-100">
          {pastAudits.map((a) => (
            <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <span>{a.title || 'Physical Stock Audit'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    Auditor: {a.auditor}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Date: {new Date(a.date).toLocaleDateString('en-PK')} · Total Items: {a.totalItemsChecked || a.items?.length || 0}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-bold text-slate-700">
                    Shortage: <span className="text-rose-600 font-bold">{a.kamItemsCount || 0}</span> · Excess: <span className="text-blue-600 font-bold">{a.zyadaItemsCount || 0}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Net Variance: {fmt(a.netVarianceCost || 0)}
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
