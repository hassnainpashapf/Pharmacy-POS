import { useState, useMemo } from 'react'
import {
  useDB,
  fmt,
  recordStockAudit,
  getStockAudits,
  todayStr,
  savePurchaseOrder,
} from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from '../components/DateFilterBar'
import {
  ClipboardCheck,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Printer,
  Download,
  Calendar,
  User,
  Package,
  Layers,
  Sparkles,
  Check,
  FileSpreadsheet,
  DollarSign,
  ShoppingBag,
  X,
  Building2,
  Eye,
} from 'lucide-react'

export default function StockAuditDashboard() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [varianceFilter, setVarianceFilter] = useState('ALL') // 'ALL' | 'KAM' | 'ZYADA' | 'MATCHED'
  const [subTab, setSubTab] = useState('worksheet') // 'worksheet' | 'history'
  const [auditTitle, setAuditTitle] = useState(`Physical Stock Audit — ${todayStr()}`)
  const [auditorName, setAuditorName] = useState(db.session?.name || 'Dr. Pharmacist')
  const [physicalCounts, setPhysicalCounts] = useState({})
  const [reasons, setReasons] = useState({})
  const [selectedForPO, setSelectedForPO] = useState(new Set())
  const [poModalOpen, setPoModalOpen] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [reconciledConfirmOpen, setReconciledConfirmOpen] = useState(false)
  const [viewingAudit, setViewingAudit] = useState(null)

  const medicines = db.medicines || []
  const batches = db.batches || []
  const suppliers = db.suppliers || []
  const pastAudits = getStockAudits()

  // Distinct companies for filtering
  const distinctCompanies = useMemo(() => {
    const set = new Set()
    for (const m of medicines) {
      if (m.manufacturer) set.add(m.manufacturer.trim())
    }
    return Array.from(set).sort()
  }, [medicines])

  // Calculate live system stock vs physical count for all medicines
  const auditData = useMemo(() => {
    return medicines.map((m) => {
      const activeBatches = batches.filter(
        (b) => b.medicineId === m.id && b.qty > 0 && b.status !== 'EXPIRED' && b.status !== 'DAMAGED'
      )
      const systemStock = activeBatches.reduce((a, b) => a + Number(b.qty || 0), 0)
      const countEntered = physicalCounts[m.id]
      const physicalStock = countEntered !== undefined && countEntered !== '' ? Number(countEntered) : systemStock
      const variance = physicalStock - systemStock
      const costPrice = m.purchasePrice != null ? m.purchasePrice : Math.round((m.salePrice || 100) * 0.75)
      const salePrice = m.salePrice || 0
      const financialImpact = variance * costPrice

      let varianceType = 'MATCHED'
      if (variance < 0) varianceType = 'KAM'
      else if (variance > 0) varianceType = 'ZYADA'

      const userReason = reasons[m.id] || (variance < 0 ? 'Damage / Broken' : variance > 0 ? 'Excess / Found' : 'Matched')

      return {
        medicine: m,
        systemStock,
        physicalStock,
        variance,
        varianceType,
        costPrice,
        salePrice,
        financialImpact,
        reason: userReason,
      }
    })
  }, [medicines, batches, physicalCounts, reasons])

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

  function handleReasonChange(medId, val) {
    setReasons((prev) => ({ ...prev, [medId]: val }))
  }

  function handleResetAll() {
    if (confirm('Reset all entered counts back to current system stock?')) {
      setPhysicalCounts({})
      setReasons({})
      setSelectedForPO(new Set())
    }
  }

  function handleOpenPOModalForKam() {
    if (kamItems.length === 0) {
      alert('No shortage (Kam) items detected in this audit!')
      return
    }
    const nextSet = new Set(kamItems.map((x) => x.medicine.id))
    setSelectedForPO(nextSet)
    setPoModalOpen(true)
  }

  function togglePOSelect(medId) {
    setSelectedForPO((prev) => {
      const next = new Set(prev)
      if (next.has(medId)) next.delete(medId)
      else next.add(medId)
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
      costPrice: d.costPrice,
      salePrice: d.salePrice,
      note: d.reason,
    }))

    const record = recordStockAudit({
      title: auditTitle,
      auditor: auditorName,
      items: itemsToSave,
      reconcile,
    })

    setReconciledConfirmOpen(false)
    setFeedbackMsg(
      `✓ Stock Audit ${record.auditNo} successfully saved! (${record.kamCount} Kam, ${record.zyadaCount} Zyada)${
        reconcile ? ' · Inventory Batches Reconciled' : ''
      }`
    )
    setTimeout(() => setFeedbackMsg(''), 6000)
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

  // Past audits date filtering
  const [auditDateFilter, setAuditDateFilter] = useDateFilterState('all')
  const filteredAudits = useMemo(() => {
    return pastAudits.filter((a) => matchesDateFilter(a.date, auditDateFilter))
  }, [pastAudits, auditDateFilter])

  return (
    <div className="space-y-4 w-full pb-16 font-sans text-slate-800">
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

      {/* Top Navigation Switcher & Action Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSubTab('worksheet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              subTab === 'worksheet'
                ? 'bg-purple-50 text-purple-900 border border-purple-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-[#3b1734]" />
            Live Audit Worksheet
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-purple-100 text-purple-800">
              {auditData.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              subTab === 'history'
                ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Past Audit History
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-slate-200 text-slate-700">
              {pastAudits.length}
            </span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleOpenPOModalForKam}
            className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Automatically create a Purchase Order for all deficit medicines"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>⚡ Generate PO ({kamItems.length} Kam)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveAudit(false)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
            title="Save this audit count record without adjusting system stock"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Save Audit
          </button>

          <button
            type="button"
            onClick={() => setReconciledConfirmOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
            title="Adjust system inventory batches to match physical count"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reconcile Stock
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" /> Print
          </button>
        </div>
      </div>

      {/* 4 Clean Uniform KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Card 1: Kam Medicines (Shortages) */}
        <div className="bg-white rounded-xl border border-rose-200 p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> Shortages (Kam)
            </span>
            <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200">
              Deficit
            </span>
          </div>
          <div className="text-2xl font-black text-rose-900 my-0.5">
            {kamItems.length} <span className="text-xs font-semibold text-rose-600">Products</span>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 flex items-center justify-between">
            <span>Missing: <b className="text-rose-700">-{totalKamUnits}</b></span>
            <span>Loss: <b className="text-rose-700">{fmt(totalKamLoss)}</b></span>
          </div>
        </div>

        {/* Card 2: Zyada Medicines (Surplus) */}
        <div className="bg-white rounded-xl border border-emerald-200 p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Surplus (Zyada)
            </span>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
              Excess
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-900 my-0.5">
            {zyadaItems.length} <span className="text-xs font-semibold text-emerald-600">Products</span>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 flex items-center justify-between">
            <span>Surplus: <b className="text-emerald-700">+{totalZyadaUnits}</b></span>
            <span>Value: <b className="text-emerald-700">{fmt(totalZyadaSurplus)}</b></span>
          </div>
        </div>

        {/* Card 3: Matched Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Matched (Accurate)
            </span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
              0 Variance
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 my-0.5">
            {matchedItems.length} <span className="text-xs font-semibold text-slate-500">Products</span>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 flex items-center justify-between">
            <span>Accuracy: <b className="text-slate-800">{medicines.length ? Math.round((matchedItems.length / medicines.length) * 100) : 100}%</b></span>
            <span>Net: <b className="text-slate-800">{fmt(netVarianceValuation)}</b></span>
          </div>
        </div>

        {/* Card 4: Restock PO */}
        <div className="bg-white rounded-xl border border-indigo-200 p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" /> Restock PO
            </span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200">
              Action
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-950 my-0.5">
            {kamItems.length} <span className="text-xs font-semibold text-indigo-700">Need Order</span>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 flex items-center justify-between">
            <span>Auto-PO Ready</span>
            <button
              type="button"
              onClick={handleOpenPOModalForKam}
              disabled={kamItems.length === 0}
              className="font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Draft PO →
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: LIVE AUDIT WORKSHEET */}
      {subTab === 'worksheet' && (
        <div className="space-y-3">
          {/* Controls Bar: Search, Filters, Variance Pills */}
          <div className="bg-white p-2.5 border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-2 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
              {/* Direct Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search medicine, generic, barcode, company..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-sm pl-9 pr-8 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Company Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 shrink-0">
                <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[170px] truncate"
                  aria-label="Filter audit by pharmaceutical company"
                >
                  <option value="all">🏢 All Companies ({distinctCompanies.length})</option>
                  {distinctCompanies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                {[
                  { id: 'ALL', label: `All (${auditData.length})` },
                  { id: 'KAM', label: `🔻 Shortages (${kamItems.length})`, color: 'text-rose-700 bg-rose-50 border-rose-200' },
                  { id: 'ZYADA', label: `🔺 Excess (${zyadaItems.length})`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { id: 'MATCHED', label: `✓ Matched (${matchedItems.length})`, color: 'text-slate-700 bg-slate-50 border-slate-200' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setVarianceFilter(f.id)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      varianceFilter === f.id
                        ? f.color || 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAll}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 transition shrink-0 self-end md:self-auto cursor-pointer"
              title="Reset all entered counts back to current system stock"
            >
              Reset Counts
            </button>
          </div>

          {/* Worksheet Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
            <table className="w-full min-w-[1100px] text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3 w-10 text-center">PO</th>
                  <th className="p-3">Medicine & Strength</th>
                  <th className="p-3">Company</th>
                  <th className="p-3 text-right">System Stock</th>
                  <th className="p-3 text-center">Physical Count</th>
                  <th className="p-3 text-center">Variance (Discrepancy)</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-right">Financial Impact</th>
                  <th className="p-3">Audit Reason / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.map((r) => {
                  const m = r.medicine
                  const isKam = r.varianceType === 'KAM'
                  const isZyada = r.varianceType === 'ZYADA'
                  const isSelectedForPO = selectedForPO.has(m.id)

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isKam ? 'bg-rose-50/20' : isZyada ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* PO Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelectedForPO}
                          onChange={() => togglePOSelect(m.id)}
                          className="w-4 h-4 rounded text-[#3b1734] focus:ring-[#3b1734] cursor-pointer"
                          title="Select for Purchase Order drafting"
                        />
                      </td>

                      {/* Medicine Info */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{m.name} {m.strength}</div>
                        <div className="text-[10px] text-slate-400">
                          {m.generic || '—'} · Barcode: {m.barcode || '—'}
                        </div>
                      </td>

                      {/* Company */}
                      <td className="p-3 text-slate-600 font-medium">
                        {m.manufacturer || 'Unassigned'}
                      </td>

                      {/* System Stock */}
                      <td className="p-3 text-right font-mono font-bold text-slate-700 text-sm">
                        {r.systemStock}
                      </td>

                      {/* Physical Count with quick adjusters */}
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustCount(m.id, r.physicalStock, -1)}
                            className="w-7 h-7 rounded border border-slate-300 bg-white hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center cursor-pointer transition active:scale-95"
                            title="Decrement count by 1"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={physicalCounts[m.id] !== undefined ? physicalCounts[m.id] : r.systemStock}
                            onChange={(e) => handleCountChange(m.id, e.target.value)}
                            className={`w-16 text-center py-1 font-mono font-black text-sm border rounded ${
                              isKam
                                ? 'border-rose-400 bg-rose-50 text-rose-800'
                                : isZyada
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                                : 'border-slate-300 bg-white text-slate-900'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => adjustCount(m.id, r.physicalStock, 1)}
                            className="w-7 h-7 rounded border border-slate-300 bg-white hover:bg-slate-100 font-black text-slate-700 flex items-center justify-center cursor-pointer transition active:scale-95"
                            title="Increment count by 1"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Variance */}
                      <td className="p-3 text-center">
                        {r.variance === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600">
                            ✓ Matched
                          </span>
                        ) : isKam ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                            🔻 {r.variance} (Kam)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            🔺 +{r.variance} (Zyada)
                          </span>
                        )}
                      </td>

                      {/* Cost Price */}
                      <td className="p-3 text-right font-mono text-slate-600">
                        {fmt(r.costPrice)}
                      </td>

                      {/* Financial Impact */}
                      <td className="p-3 text-right font-mono font-bold">
                        {r.variance === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : isKam ? (
                          <span className="text-rose-600">- {fmt(Math.abs(r.financialImpact))}</span>
                        ) : (
                          <span className="text-emerald-700">+ {fmt(r.financialImpact)}</span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="p-3">
                        <select
                          value={r.reason}
                          onChange={(e) => handleReasonChange(m.id, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none"
                        >
                          <option value="Matched">Matched</option>
                          <option value="Damage / Broken">Damage / Broken</option>
                          <option value="Theft / Shrinkage">Theft / Shrinkage</option>
                          <option value="Expired">Expired</option>
                          <option value="Mislabeled">Mislabeled</option>
                          <option value="Excess / Found">Excess / Found</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
                {!displayRows.length && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                      No medicines match the selected filter and search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PAST AUDIT HISTORY */}
      {subTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3b1734]" />
              <span>Past Audit History Sessions</span>
            </h2>
            <span className="text-xs text-slate-400">{filteredAudits.length} recorded sessions</span>
          </div>

          <DateFilterBar filterState={auditDateFilter} onChange={setAuditDateFilter} />

          {!filteredAudits.length && (
            <p className="text-xs text-slate-400 py-8 text-center">
              No past stock audit sessions found. Perform and save an audit from the Live Worksheet tab!
            </p>
          )}

          <div className="divide-y divide-slate-100">
            {filteredAudits.map((a) => (
              <div key={a.id || a.auditNo} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="font-mono text-indigo-700">{a.auditNo}</span>
                    <span>·</span>
                    <span>{a.title || 'Physical Stock Audit'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      Auditor: {a.auditor || 'Pharmacist'}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Date: {new Date(a.date).toLocaleDateString('en-PK')} · Total Items Audited: {a.totalItemsChecked || a.items?.length || 0}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-slate-700">
                      Shortage: <span className="text-rose-600 font-bold">{a.kamCount || a.kamItemsCount || 0}</span> · Excess: <span className="text-emerald-700 font-bold">{a.zyadaCount || a.zyadaItemsCount || 0}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Net: {fmt(a.netVarianceCost || 0)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingAudit(a)}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Inventory Reconciliation */}
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
                className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveAudit(true)}
                className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer"
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
            setTimeout(() => setFeedbackMsg(''), 6000)
          }}
        />
      )}

      {/* View Past Audit Details Modal */}
      {viewingAudit && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scroll shadow-2xl border border-slate-300 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  {viewingAudit.auditNo} — {viewingAudit.title || 'Stock Audit Report'}
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Auditor: <b>{viewingAudit.auditor || 'Pharmacist'}</b> · Date: {new Date(viewingAudit.date).toLocaleDateString('en-PK')}
                </p>
              </div>
              <button onClick={() => setViewingAudit(null)} className="p-1 rounded text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg text-center font-bold">
              <div>
                <span className="block text-[10px] text-slate-400 font-normal">Shortage (Kam)</span>
                <span className="text-rose-600 font-black">{viewingAudit.kamCount || 0} items</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-normal">Excess (Zyada)</span>
                <span className="text-emerald-700 font-black">{viewingAudit.zyadaCount || 0} items</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-normal">Reconciliation</span>
                <span className="text-indigo-700 font-black">{viewingAudit.reconciled ? 'Reconciled' : 'Record Only'}</span>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Medicine</th>
                    <th className="p-2.5 text-right">System</th>
                    <th className="p-2.5 text-right">Physical</th>
                    <th className="p-2.5 text-center">Variance</th>
                    <th className="p-2.5">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewingAudit.items || []).map((it, idx) => (
                    <tr key={idx} className={it.variance < 0 ? 'bg-rose-50/20' : it.variance > 0 ? 'bg-emerald-50/20' : ''}>
                      <td className="p-2.5 font-bold text-slate-900">{it.medicineName}</td>
                      <td className="p-2.5 text-right font-mono">{it.systemStock}</td>
                      <td className="p-2.5 text-right font-mono font-bold">{it.physicalStock}</td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        {it.variance === 0 ? (
                          <span className="text-slate-500">0</span>
                        ) : it.variance < 0 ? (
                          <span className="text-rose-600">{it.variance}</span>
                        ) : (
                          <span className="text-emerald-700">+{it.variance}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px]">{it.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                type="button"
                onClick={() => setViewingAudit(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
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
              PO Notes / Instructions
            </label>
            <input
              type="text"
              value={poNote}
              onChange={(e) => setPoNote(e.target.value)}
              className="w-full bg-white border border-indigo-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
            />
          </div>
        </div>

        {/* Selected Items Table */}
        <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">Medicine</th>
                <th className="p-2.5 text-center">Shortage Units</th>
                <th className="p-2.5 text-center">Order Qty</th>
                <th className="p-2.5 text-right">Cost Price</th>
                <th className="p-2.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kamItems.map((it) => {
                const isSelected = selectedIds.has(it.medicine.id)
                const qVal = orderQtys[it.medicine.id] || Math.abs(it.variance)
                const lineTotal = Number(qVal) * it.costPrice

                return (
                  <tr key={it.medicine.id} className={isSelected ? 'bg-indigo-50/30' : 'opacity-40'}>
                    <td className="p-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleId(it.medicine.id)}
                          className="w-4 h-4 rounded text-[#3b1734]"
                        />
                        <span className="font-bold text-slate-900">{it.medicine.name}</span>
                      </label>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                      -{Math.abs(it.variance)}
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        disabled={!isSelected}
                        value={qVal}
                        onChange={(e) => {
                          const v = Math.max(1, parseInt(e.target.value, 10) || 1)
                          setOrderQtys((prev) => ({ ...prev, [it.medicine.id]: v }))
                        }}
                        className="w-16 px-1.5 py-0.5 text-center border border-slate-300 rounded font-bold font-mono"
                      />
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600">{fmt(it.costPrice)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      {fmt(lineTotal)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* PO Footer Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200 gap-3">
          <div>
            <span className="text-xs text-slate-600 font-semibold">
              Selected <b>{selectedItems.length} of {kamItems.length}</b> deficit products
            </span>
            <div className="text-base font-black text-slate-900 font-mono mt-0.5">
              Est. Total Demand: <span className="text-[#3b1734]">{fmt(totalCost)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="px-5 py-2 rounded-lg bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white font-bold shadow-sm transition-all cursor-pointer"
            >
              ✓ Create Purchase Order
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
