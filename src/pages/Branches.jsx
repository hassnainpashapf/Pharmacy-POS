import { useState } from 'react'
import {
  useDB,
  headOfficeDashboard,
  addBranch,
  branchStock,
  requestTransfer,
  decideTransfer,
  transfersList,
  branchById,
  fmt,
  medicineById,
  activeBranch,
  currentUser,
} from '../lib/db'
import { getSmartTransferRecommendations } from '../lib/forecasting'
import { Modal, Input } from './Medicines'
import { Building, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Sparkles, Send } from 'lucide-react'

export default function Branches() {
  const db = useDB()
  const [tab, setTab] = useState('overview')
  const [adding, setAdding] = useState(false)
  const ho = headOfficeDashboard()
  const smartRecs = getSmartTransferRecommendations(db)
  const [recMsg, setRecMsg] = useState('')

  function handleAutoTransfer(rec) {
    try {
      const batch = db.batches.find(
        (b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty >= rec.recommendedQty
      ) || db.batches.find(
        (b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty > 0
      )

      if (!batch) {
        setRecMsg(`Error: No batch found with stock for ${rec.medicineName} in ${rec.fromBranch.name}`)
        return
      }

      const qtyToSend = Math.min(batch.qty, rec.recommendedQty)
      const tr = requestTransfer({
        fromBranch: rec.fromBranch.id,
        toBranch: rec.toBranch.id,
        items: [{ batchId: batch.id, qty: qtyToSend }],
      })
      setRecMsg(`✓ Transfer request ${tr.trNo} created: ${qtyToSend} units of ${rec.medicineName} from ${rec.fromBranch.name} to ${rec.toBranch.name}`)
    } catch (e) {
      setRecMsg(`Error: ${e.message}`)
    }
  }

  // Group branches by region
  const regionalGroups = (db.branches || []).reduce((acc, b) => {
    const region = b.region || 'Central Region (Punjab)'
    if (!acc[region]) acc[region] = []
    acc[region].push(b)
    return acc
  }, {})

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🏢 Enterprise Multi-Branch & HQ Portal</span>
            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
              Regional Grid
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Regional hierarchy monitoring, autonomous inter-branch transfers, and multi-location revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            + New Branch Hub
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-2">
        {[
          ['overview', '📊 Regional & Branch Matrix'],
          ['smart', `🧠 Smart AI Transfers (${smartRecs.length})`],
          ['transfers', '🔄 Stock Transfer Requests'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k)
              setRecMsg('')
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === k ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Executive Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat title="Total Operational Hubs" value={db.branches.length} color="bg-slate-900 text-white" />
            <Stat
              title="Network Revenue (30d)"
              value={fmt(ho.reduce((a, x) => a + x.monthSales, 0))}
              color="bg-emerald-700 text-white"
            />
            <Stat
              title="Network Net Margin"
              value={fmt(ho.reduce((a, x) => a + x.profit, 0))}
              color="bg-blue-700 text-white"
            />
            <Stat
              title="Network Stock Valuation"
              value={fmt(ho.reduce((a, x) => a + x.stockValue, 0))}
              color="bg-indigo-700 text-white"
            />
          </div>

          {/* Regional Hierarchy Breakdown */}
          <div className="space-y-4">
            {Object.entries(regionalGroups).map(([region, branches]) => {
              const regionBranchIds = new Set(branches.map((b) => b.id))
              const regionHo = ho.filter((h) => regionBranchIds.has(h.branch.id))
              const regionSales = regionHo.reduce((a, b) => a + b.monthSales, 0)
              const regionStock = regionHo.reduce((a, b) => a + b.stockValue, 0)

              return (
                <div key={region} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                  <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{region}</h3>
                        <p className="text-[11px] text-slate-500">
                          {branches.length} Location{branches.length > 1 ? 's' : ''} in cluster
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="text-slate-600">
                        Monthly Sales: <b className="text-emerald-700">{fmt(regionSales)}</b>
                      </span>
                      <span className="text-slate-600">
                        Stock Value: <b className="text-indigo-700">{fmt(regionStock)}</b>
                      </span>
                    </div>
                  </div>

                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="p-3 text-left">Branch Name</th>
                        <th className="p-3 text-center">City</th>
                        <th className="p-3 text-right">Today Sales</th>
                        <th className="p-3 text-right">30-day Sales</th>
                        <th className="p-3 text-right">Profit</th>
                        <th className="p-3 text-center">Invoices</th>
                        <th className="p-3 text-right">Stock Valuation</th>
                        <th className="p-3 text-center">Low Stock Alerts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {regionHo.map((x) => (
                        <tr key={x.branch.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-left">
                            <span className="font-bold text-slate-900">{x.branch.name}</span>
                            {activeBranch() === x.branch.id && (
                              <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                                ACTIVE WORKSPACE
                              </span>
                            )}
                            <div className="text-[10px] text-slate-400 font-normal">{x.branch.address || 'Address on file'}</div>
                          </td>
                          <td className="p-3 text-center text-slate-600">{x.branch.city || '—'}</td>
                          <td className="p-3 text-right font-semibold text-slate-800">{fmt(x.todaySales)}</td>
                          <td className="p-3 text-right font-bold text-emerald-700">{fmt(x.monthSales)}</td>
                          <td className="p-3 text-right font-medium text-slate-800">{fmt(x.profit)}</td>
                          <td className="p-3 text-center text-slate-700 font-mono">{x.invoices}</td>
                          <td className="p-3 text-right text-indigo-700 font-bold">{fmt(x.stockValue)}</td>
                          <td className="p-3 text-center">
                            {x.lowStockCount > 0 ? (
                              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold text-[10px]">
                                ⚠️ {x.lowStockCount} items
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold">✓ Optimal</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'smart' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-indigo-300" />
              <h3 className="font-extrabold text-base">🧠 Smart Inter-Branch AI Rebalancing</h3>
            </div>
            <p className="text-xs text-indigo-200">
              Scans inventory levels across regional branches to identify high-surplus locations (&gt;60 units) and low-deficit hubs (&lt;15 units), preventing localized stockouts and minimizing overall replenishment costs.
            </p>
          </div>

          {recMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {recMsg}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-slate-900 text-sm">Recommended Inter-Branch Transfers ({smartRecs.length})</h4>
              <span className="text-xs text-slate-500">Autonomous Rebalancing Engine</span>
            </div>

            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="p-3 text-left">Medicine</th>
                  <th className="p-3 text-left">Surplus Origin</th>
                  <th className="p-3 text-left">Deficit Destination</th>
                  <th className="p-3 text-center">Transfer Qty</th>
                  <th className="p-3 text-left">Rebalance Rationale</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {smartRecs.map((rec, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="p-3 text-left font-bold text-slate-900">{rec.medicineName}</td>
                    <td className="p-3 text-left">
                      <span className="font-semibold text-slate-800">{rec.fromBranch.name}</span>
                      <div className="text-[10px] text-emerald-700 font-bold">{rec.fromStock} units in stock (Surplus)</div>
                    </td>
                    <td className="p-3 text-left">
                      <span className="font-semibold text-slate-800">{rec.toBranch.name}</span>
                      <div className="text-[10px] text-rose-600 font-bold">{rec.toStock} units in stock (Deficit)</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-extrabold text-xs">
                        {rec.recommendedQty} units
                      </span>
                    </td>
                    <td className="p-3 text-left text-slate-600">{rec.reason}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleAutoTransfer(rec)}
                        className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        ⚡ 1-Click Transfer
                      </button>
                    </td>
                  </tr>
                ))}
                {!smartRecs.length && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      All regional hubs are currently balanced. No inter-branch stock transfers required.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'transfers' && <Transfers />}

      {adding && (
        <Modal title="Add New Regional Branch Hub" onClose={() => setAdding(false)}>
          <BranchForm
            onSave={(d) => {
              addBranch(d)
              setAdding(false)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

function BranchForm({ onSave }) {
  const [f, setF] = useState({ name: '', city: '', address: '', region: 'Central Region (Punjab)' })
  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Input label="Branch Hub Name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="City *" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </div>
      <div className="mt-3">
        <label className="block text-xs font-bold text-slate-700 mb-1">Regional Jurisdiction</label>
        <select
          value={f.region}
          onChange={(e) => setF({ ...f, region: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
        >
          <option value="North Region (Islamabad/KPK)">North Region (Islamabad / KPK / Northern)</option>
          <option value="Central Region (Punjab)">Central Region (Punjab / Lahore / Faisalabad)</option>
          <option value="South Region (Sindh)">South Region (Sindh / Karachi / Hyderabad)</option>
        </select>
      </div>
      <label className="block text-xs font-bold text-slate-700 mt-3">
        Physical Street Address
        <input
          value={f.address}
          onChange={(e) => setF({ ...f, address: e.target.value })}
          placeholder="e.g. Plot 14, Commercial Zone"
          className="mt-1 border border-slate-200 bg-slate-50 rounded-xl w-full px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
        />
      </label>
      <button
        onClick={() => f.name && onSave(f)}
        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm"
      >
        Save Branch Hub
      </button>
    </>
  )
}

function Transfers() {
  const db = useDB()
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const me = currentUser()
  const canApprove = me?.role === 'MANAGER' || me?.role === 'ADMIN'
  const transfers = transfersList()
  const pending = transfers.filter((t) => t.status === 'PENDING')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <p className="text-xs text-slate-500">
          Inter-branch stock transfers with two-stage reservation and manager/admin approval workflow.
        </p>
        <button
          onClick={() => setCreating(true)}
          className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          + Request Custom Transfer
        </button>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-amber-900 text-xs sm:text-sm">⏳ Pending Transfer Approvals ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((t) => (
              <div key={t.id} className="bg-white rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-amber-100 text-xs shadow-sm">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    {t.trNo} — <span className="text-slate-600">{branchById(t.fromBranch)?.name}</span> → <b className="text-indigo-700">{branchById(t.toBranch)?.name}</b>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t.items
                      .map(
                        (i) =>
                          `${medicineById(db.batches.find((b) => b.id === i.batchId)?.medicineId)?.name || 'Medicine'} ×${i.qty}`
                      )
                      .join(', ')}{' '}
                    · Requested by <span className="font-semibold text-slate-700">{t.by}</span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {canApprove ? (
                    <>
                      <button
                        onClick={() => {
                          setErr('')
                          try {
                            decideTransfer(t.id, true)
                          } catch (ex) {
                            setErr(ex.message)
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        ✓ Approve Transfer
                      </button>
                      <button
                        onClick={() => {
                          setErr('')
                          try {
                            decideTransfer(t.id, false)
                          } catch (ex) {
                            setErr(ex.message)
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        ✕ Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Requires Manager / Admin authorization</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <div className="text-rose-600 text-xs font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">{err}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Stock Transfer Audit Log ({transfers.length})</h3>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-3 text-left">Transfer No</th>
              <th className="p-3 text-center">Timestamp</th>
              <th className="p-3 text-left">From → To</th>
              <th className="p-3 text-left">Manifest Items</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Requested By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50">
                <td className="p-3 font-mono font-bold text-slate-800 text-left">{t.trNo}</td>
                <td className="p-3 text-center text-slate-500">{new Date(t.date).toLocaleString()}</td>
                <td className="p-3 text-left font-semibold text-slate-700">
                  {branchById(t.fromBranch)?.name} → {branchById(t.toBranch)?.name}
                </td>
                <td className="p-3 text-left text-slate-600">
                  {t.items
                    .map(
                      (i) =>
                        `${medicineById(db.batches.find((b) => b.id === i.batchId)?.medicineId)?.name || 'Medicine'} ×${i.qty}`
                    )
                    .join(', ')}
                </td>
                <td className="p-3 text-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                      t.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : t.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="p-3 text-center text-slate-600">{t.by}</td>
              </tr>
            ))}
            {!transfers.length && (
              <tr>
                <td colSpan="6" className="p-6 text-center text-slate-400">
                  No stock transfer logs recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && <NewTransferModal onClose={() => setCreating(false)} />}
    </div>
  )
}

function NewTransferModal({ onClose }) {
  const db = useDB()
  const [fromBranch, setFromBranch] = useState(activeBranch() === 'ALL' ? 'main' : activeBranch())
  const [toBranch, setToBranch] = useState('')
  const [mid, setMid] = useState('')
  const [items, setItems] = useState([]) // {batchId, qty}
  const [err, setErr] = useState('')

  const availableTargets = db.branches.filter((b) => b.id !== fromBranch)

  function addMed() {
    const batches = db.batches.filter((b) => b.medicineId === mid && b.branchId === fromBranch && b.qty > 0)
    if (!batches.length) return setErr('No stock available for this medicine in origin branch')
    const batch = batches[0]
    setItems((x) => [...x, { batchId: batch.id, qty: 1 }])
    setErr('')
  }

  function save() {
    try {
      requestTransfer({ fromBranch, toBranch, items })
      onClose()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <Modal title="Create Inter-Branch Stock Transfer Request" onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Origin Branch</label>
            <select
              value={fromBranch}
              onChange={(e) => {
                setFromBranch(e.target.value)
                setItems([])
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium"
            >
              {db.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Destination Branch</label>
            <select
              value={toBranch}
              onChange={(e) => setToBranch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium"
            >
              <option value="">— Select destination —</option>
              {availableTargets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <label className="block font-bold text-slate-700 mb-1">Select Medicine to Dispatch</label>
          <div className="flex gap-2">
            <select
              value={mid}
              onChange={(e) => setMid(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium"
            >
              <option value="">— Select medicine —</option>
              {db.medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.strength}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addMed}
              disabled={!mid}
              className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-4 py-2 rounded-xl font-bold text-xs disabled:opacity-40 transition-all cursor-pointer"
            >
              + Add Line
            </button>
          </div>
        </div>

        {items.map((it, idx) => {
          const b = db.batches.find((x) => x.id === it.batchId)
          return (
            <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="flex-1 font-semibold text-slate-800">
                {medicineById(b?.medicineId)?.name} — Batch {b?.batchNo} (Available: {b?.qty})
              </span>
              <input
                type="number"
                min="1"
                max={b?.qty || 1}
                value={it.qty}
                onChange={(e) =>
                  setItems((x) =>
                    x.map((r, i) => (i === idx ? { ...r, qty: Math.min(Number(e.target.value), b?.qty || 1) } : r))
                  )
                }
                className="border border-slate-200 rounded-lg w-20 px-2 py-1 text-center font-bold"
              />
              <button
                type="button"
                onClick={() => setItems((x) => x.filter((_, i) => i !== idx))}
                className="text-rose-500 hover:text-rose-700 p-1 font-bold"
              >
                ✕
              </button>
            </div>
          )
        })}

        {err && <div className="text-rose-600 text-xs font-bold">{err}</div>}

        <button
          onClick={save}
          disabled={!toBranch || !items.length}
          className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 transition-colors shadow-sm"
        >
          📤 Submit Stock Transfer Request (Stock Reserved)
        </button>
      </div>
    </Modal>
  )
}

function Stat({ title, value, color }) {
  return (
    <div className={`${color} rounded-2xl p-4 shadow-sm border border-slate-200/20`}>
      <div className="text-[11px] opacity-80 font-medium">{title}</div>
      <div className="text-xl font-extrabold mt-1 tracking-tight">{value}</div>
    </div>
  )
}
