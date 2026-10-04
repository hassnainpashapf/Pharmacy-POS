import { useState, useMemo } from 'react'
import {
  useDB,
  branchById,
  fmt,
  requestTransfer,
  currentUser,
} from '../lib/db'
import { getSmartTransferRecommendations } from '../lib/forecasting'
import {
  Sparkles,
  ArrowRight,
  ArrowLeftRight,
  Building2,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Package,
  Plus,
  Printer,
  Boxes,
} from 'lucide-react'

export default function SmartTransfers() {
  const db = useDB()
  const [search, setSearch] = useState('')
  const [originFilter, setOriginFilter] = useState('ALL')
  const [destFilter, setDestFilter] = useState('ALL')
  const [recMsg, setRecMsg] = useState('')
  const [msgTone, setMsgTone] = useState('success')

  const smartRecs = useMemo(() => {
    return getSmartTransferRecommendations(db)
  }, [db])

  // Extract distinct branch options from recommendations
  const branches = db.branches || []

  // Filter recommendations
  const filteredRecs = useMemo(() => {
    return smartRecs.filter((rec) => {
      if (search) {
        const q = search.toLowerCase()
        const matchMed = rec.medicineName?.toLowerCase().includes(q)
        const matchFrom = rec.fromBranch?.name?.toLowerCase().includes(q)
        const matchTo = rec.toBranch?.name?.toLowerCase().includes(q)
        if (!matchMed && !matchFrom && !matchTo) return false
      }
      if (originFilter !== 'ALL' && rec.fromBranch?.id !== originFilter) {
        return false
      }
      if (destFilter !== 'ALL' && rec.toBranch?.id !== destFilter) {
        return false
      }
      return true
    })
  }, [smartRecs, search, originFilter, destFilter])

  // KPI calculations
  const totalUnitsToMove = useMemo(() => {
    return smartRecs.reduce((sum, r) => sum + (r.recommendedQty || 0), 0)
  }, [smartRecs])

  const surplusHubsCount = useMemo(() => {
    const s = new Set()
    smartRecs.forEach((r) => r.fromBranch?.id && s.add(r.fromBranch.id))
    return s.size
  }, [smartRecs])

  const deficitHubsCount = useMemo(() => {
    const s = new Set()
    smartRecs.forEach((r) => r.toBranch?.id && s.add(r.toBranch.id))
    return s.size
  }, [smartRecs])

  function handleAutoTransfer(rec) {
    try {
      const batch =
        db.batches.find(
          (b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty >= rec.recommendedQty
        ) ||
        db.batches.find((b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty > 0)

      if (!batch) {
        setMsgTone('error')
        setRecMsg(`Error: No batch found with sufficient stock for ${rec.medicineName} in ${rec.fromBranch.name}`)
        return
      }

      const qtyToSend = Math.min(batch.qty, rec.recommendedQty)
      const tr = requestTransfer({
        fromBranch: rec.fromBranch.id,
        toBranch: rec.toBranch.id,
        items: [{ batchId: batch.id, qty: qtyToSend }],
      })
      setMsgTone('success')
      setRecMsg(`✓ Transfer request ${tr.trNo} generated: Dispatched ${qtyToSend} units of ${rec.medicineName} from ${rec.fromBranch.name} to ${rec.toBranch.name}`)
    } catch (e) {
      setMsgTone('error')
      setRecMsg(`Error: ${e.message}`)
    }
  }

  function handleTransferAll() {
    if (!filteredRecs.length) return
    if (!window.confirm(`Auto-create ${filteredRecs.length} stock transfer requests for all listed items?`)) return

    let created = 0
    let failed = 0
    filteredRecs.forEach((rec) => {
      try {
        const batch =
          db.batches.find(
            (b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty >= rec.recommendedQty
          ) ||
          db.batches.find((b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty > 0)

        if (batch) {
          const qtyToSend = Math.min(batch.qty, rec.recommendedQty)
          requestTransfer({
            fromBranch: rec.fromBranch.id,
            toBranch: rec.toBranch.id,
            items: [{ batchId: batch.id, qty: qtyToSend }],
          })
          created++
        } else {
          failed++
        }
      } catch (err) {
        failed++
      }
    })

    setMsgTone('success')
    setRecMsg(`✓ Successfully created ${created} transfer requests.${failed > 0 ? ` (${failed} skipped due to batch conflicts)` : ''}`)
  }

  return (
    <div className="space-y-5 w-full pb-12">
      {/* ── Top Header (Merged into Page) ── */}
      <div className="flex flex-wrap justify-between items-center gap-4 px-1 py-1">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3b1734] flex items-center justify-center text-white shadow-sm shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Smart AI Inter-Branch Transfers
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Autonomous inventory rebalancing algorithm to prevent localized stockouts across regional branches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Print Rebalance Plan"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Plan</span>
          </button>
          {filteredRecs.length > 0 && (
            <button
              onClick={handleTransferAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Execute All ({filteredRecs.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">AI Rebalance Items</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f5eef4] text-[#714B67]">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-slate-900">{smartRecs.length}</div>
          <div className="text-[11px] font-medium mt-0.5 text-slate-500">Items needing rebalance</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Total Units to Shift</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-700">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-blue-700">{totalUnitsToMove.toLocaleString()} units</div>
          <div className="text-[11px] font-medium mt-0.5 text-slate-500">Across all network hubs</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Surplus Origin Hubs</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-emerald-700">{surplusHubsCount} Hubs</div>
          <div className="text-[11px] font-medium mt-0.5 text-emerald-600/70">Overstocked branches</div>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 hover:border-rose-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Deficit Hubs</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-rose-700">{deficitHubsCount} Hubs</div>
          <div className="text-[11px] font-medium mt-0.5 text-rose-600/70">Low inventory locations</div>
        </div>
      </div>

      {/* ── Status Message Alert ── */}
      {recMsg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all ${
            msgTone === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {msgTone === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{recMsg}</span>
          </div>
          <button onClick={() => setRecMsg('')} className="hover:opacity-75 cursor-pointer ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Explanation Banner ── */}
      <div className="bg-gradient-to-r from-[#3b1734] to-[#714B67] text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <h3 className="font-black text-base tracking-tight">Smart Autonomous Rebalancing</h3>
        </div>
        <p className="text-xs text-white/80 max-w-3xl leading-relaxed">
          AI continuously scans branch stock levels to identify surplus hubs (&gt;60 units) and deficit locations (&lt;15 units), preventing localized stockouts and minimizing overall supply replenishment expenses.
        </p>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search medicine item, surplus origin, or deficit hub..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none cursor-pointer"
        >
          <option value="ALL">📦 All Surplus Origins</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              Origin: {b.name}
            </option>
          ))}
        </select>

        <select
          value={destFilter}
          onChange={(e) => setDestFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none cursor-pointer"
        >
          <option value="ALL">🎯 All Deficit Destinations</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              Dest: {b.name}
            </option>
          ))}
        </select>

        {(search || originFilter !== 'ALL' || destFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearch('')
              setOriginFilter('ALL')
              setDestFilter('ALL')
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Recommendations Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Medicine Item</th>
                <th className="py-3 px-4">Surplus Origin</th>
                <th className="py-3 px-4">Deficit Destination</th>
                <th className="py-3 px-4 text-center">Transfer Qty</th>
                <th className="py-3 px-4">AI Rebalance Rationale</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecs.map((rec, i) => (
                <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{rec.medicineName}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800">{rec.fromBranch.name}</span>
                    <div className="text-[10px] text-emerald-700 font-bold">{rec.fromStock} units (Surplus)</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800">{rec.toBranch.name}</span>
                    <div className="text-[10px] text-rose-600 font-bold">{rec.toStock} units (Deficit)</div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-[#f5eef4] text-[#714B67] border border-[#decddd] px-2.5 py-1 rounded-lg font-black text-xs">
                      {rec.recommendedQty} units
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 text-[11px] max-w-xs">{rec.reason}</td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleAutoTransfer(rec)}
                      className="bg-[#3b1734] hover:bg-[#522249] text-white px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>1-Click Transfer</span>
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredRecs.length && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-bold text-slate-600">All Regional Hubs Are Balanced</div>
                    <p className="text-xs text-slate-400 mt-0.5">No immediate inter-branch stock transfers required.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
