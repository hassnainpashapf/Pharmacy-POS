import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  useDB,
  headOfficeDashboard,
  addBranch,
  updateBranch,
  deleteBranch,
  branchStock,
  requestTransfer,
  decideTransfer,
  transfersList,
  branchById,
  fmt,
  medicineById,
  activeBranch,
  setBranch,
  currentUser,
} from '../lib/db'
import { getSmartTransferRecommendations } from '../lib/forecasting'
import { UsersPanel } from './Users'
import {
  Building2,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Send,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  MapPin,
  TrendingUp,
  Package,
  CircleDollarSign,
  Receipt,
  LayoutGrid,
  Table as TableIcon,
  Check,
  Building,
  Phone,
  Layers,
  UserCog,
} from 'lucide-react'

/* ---------- Standard KPI Card Component ---------- */

function KpiCard({ label, value, sub, icon: Icon, tone = 'default' }) {
  const tones = {
    default: { icon: 'bg-[#f5eef4] text-[#714B67]', val: 'text-slate-900', sub: 'text-slate-500' },
    blue: { icon: 'bg-blue-50 text-blue-700', val: 'text-blue-700', sub: 'text-blue-600/70' },
    green: { icon: 'bg-emerald-50 text-emerald-700', val: 'text-emerald-700', sub: 'text-emerald-600/70' },
    purple: { icon: 'bg-purple-50 text-purple-700', val: 'text-purple-700', sub: 'text-purple-600/70' },
    amber: { icon: 'bg-amber-50 text-amber-700', val: 'text-amber-700', sub: 'text-amber-600/70' },
    red: { icon: 'bg-rose-50 text-rose-700', val: 'text-rose-700', sub: 'text-rose-600/70' },
  }
  const t = tones[tone] || tones.default

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${t.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-2xl font-black mt-2 tracking-tight ${t.val}`}>{value}</div>
      <div className={`text-[11px] font-medium mt-0.5 ${t.sub}`}>{sub}</div>
    </div>
  )
}

/* ---------- Main Component ---------- */

export default function Branches() {
  const db = useDB()
  const location = useLocation()
  const navigate = useNavigate()
  const queryTab = new URLSearchParams(location.search).get('tab')
  const [tab, setTab] = useState(queryTab && ['overview', 'users', 'smart', 'transfers'].includes(queryTab) ? queryTab : 'overview')
  const [staffAdding, setStaffAdding] = useState(false)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [editingBranch, setEditingBranch] = useState(null)
  const [adding, setAdding] = useState(false)
  const [recMsg, setRecMsg] = useState('')

  useEffect(() => {
    const qTab = new URLSearchParams(location.search).get('tab')
    if (qTab && ['overview', 'users', 'smart', 'transfers'].includes(qTab)) {
      setTab(qTab)
    } else if (!qTab) {
      setTab('overview')
    }
  }, [location.search])

  function handleTabChange(t) {
    setTab(t)
    setRecMsg('')
    if (t === 'overview') {
      navigate('/branches', { replace: true })
    } else {
      navigate(`/branches?tab=${t}`, { replace: true })
    }
  }

  const ho = headOfficeDashboard()
  const smartRecs = getSmartTransferRecommendations(db)
  const transfers = transfersList()
  const currentActive = activeBranch()

  // Network Totals
  const networkSales = ho.reduce((a, x) => a + (x.monthSales || 0), 0)
  const networkProfit = ho.reduce((a, x) => a + (x.profit || 0), 0)
  const networkStock = ho.reduce((a, x) => a + (x.stockValue || 0), 0)
  const totalLowStock = ho.reduce((a, x) => a + (x.lowStockCount || 0), 0)

  // Filtered branches
  const filteredHo = useMemo(() => {
    return ho.filter((item) => {
      const b = item.branch
      if (regionFilter !== 'ALL' && (b.region || 'Central Region (Punjab)') !== regionFilter) {
        return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = b.name && b.name.toLowerCase().includes(q)
        const matchCity = b.city && b.city.toLowerCase().includes(q)
        const matchAddr = b.address && b.address.toLowerCase().includes(q)
        const matchRegion = b.region && b.region.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchAddr && !matchRegion) return false
      }
      return true
    })
  }, [ho, search, regionFilter])

  // Regional Groups
  const regionalGroups = useMemo(() => {
    return filteredHo.reduce((acc, item) => {
      const region = item.branch.region || 'Central Region (Punjab)'
      if (!acc[region]) acc[region] = []
      acc[region].push(item)
      return acc
    }, {})
  }, [filteredHo])

  const distinctRegions = useMemo(() => {
    const set = new Set()
    db.branches.forEach((b) => set.add(b.region || 'Central Region (Punjab)'))
    return Array.from(set)
  }, [db.branches])

  function handleAutoTransfer(rec) {
    try {
      const batch =
        db.batches.find(
          (b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty >= rec.recommendedQty
        ) ||
        db.batches.find((b) => b.medicineId === rec.medicineId && b.branchId === rec.fromBranch.id && b.qty > 0)

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

  function handleDelete(branch) {
    if (branch.id === 'main') {
      alert('The Main Headquarters Hub cannot be deleted.')
      return
    }
    if (confirm(`Are you sure you want to remove ${branch.name}?`)) {
      deleteBranch(branch.id)
    }
  }

  const isFiltered = search || regionFilter !== 'ALL'

  return (
    <div className="space-y-5 w-full pb-12">
      {/* ── Top Header (Merged into Page) ── */}
      <div className="flex flex-wrap justify-between items-center gap-4 px-1 py-1">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#3b1734] flex items-center justify-center text-white shadow-sm shrink-0">
            {tab === 'users' ? <UserCog className="w-6 h-6 text-white" /> : <Building2 className="w-6 h-6 text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {tab === 'users' ? 'User Roles & Staff' : 'Enterprise Multi-Branch & HQ Portal'}
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f5eef4] text-[#714B67] border border-[#decddd]">
                {tab === 'users' ? `${db.users?.length || 0} Staff Accounts` : `${db.branches?.length || 0} Hubs Active`}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {tab === 'users'
                ? 'Manage employees, roles, branch access & passwords across all operational hubs'
                : 'Regional hierarchy monitoring, autonomous inter-branch transfers, and multi-location revenue'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentActive !== 'ALL' && (
            <button
              onClick={() => setBranch('ALL')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Head Office (All Hubs)</span>
            </button>
          )}
          {tab === 'users' ? (
            <button
              onClick={() => setStaffAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Staff</span>
            </button>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Branch Hub</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 5 Standard KPI Cards (Only on Overview) ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <KpiCard
            label="Total Hubs"
            value={`${db.branches?.length || 0} Hubs`}
            sub="Operational branches"
            icon={Building2}
            tone="default"
          />
          <KpiCard
            label="Network Revenue"
            value={fmt(networkSales)}
            sub="Last 30-day sales"
            icon={TrendingUp}
            tone="green"
          />
          <KpiCard
            label="Network Margin"
            value={fmt(networkProfit)}
            sub="Consolidated net profit"
            icon={CircleDollarSign}
            tone="blue"
          />
          <KpiCard
            label="Stock Valuation"
            value={fmt(networkStock)}
            sub="Total inventory at cost"
            icon={Package}
            tone="purple"
          />
          <div className="col-span-2 md:col-span-1">
            <KpiCard
              label="Low Stock Alerts"
              value={`${totalLowStock} items`}
              sub={totalLowStock > 0 ? 'Replenishment needed' : 'All hubs optimal'}
              icon={AlertTriangle}
              tone={totalLowStock > 0 ? 'amber' : 'green'}
            />
          </div>
        </div>
      )}

      {/* ── Tab Switcher Options ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl">
          {[
            { id: 'overview', label: 'Regional & Branch Matrix', icon: Building2, count: db.branches.length },
            { id: 'users', label: 'User Roles & Staff', icon: UserCog, count: db.users?.length || 0 },
            { id: 'smart', label: 'Smart AI Transfers', icon: Sparkles, count: smartRecs.length },
            { id: 'transfers', label: 'Stock Transfer Requests', icon: ArrowLeftRight, count: transfers.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <t.icon className={`w-3.5 h-3.5 ${tab === t.id ? 'text-[#714B67]' : 'text-slate-400'}`} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    tab === t.id ? 'bg-[#f5eef4] text-[#714B67]' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-[#714B67] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-[#714B67] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Matrix Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        )}
      </div>

      {/* ── TAB 1: OVERVIEW MATRIX & CARDS ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search branch name, city, address or region..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67] transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#714B67] focus:outline-none cursor-pointer"
            >
              <option value="ALL">🌐 All Regions ({distinctRegions.length})</option>
              {distinctRegions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {isFiltered && (
              <button
                onClick={() => {
                  setSearch('')
                  setRegionFilter('ALL')
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* VIEW MODE: CARDS */}
          {viewMode === 'cards' && (
            <div className="space-y-6">
              {Object.entries(regionalGroups).map(([region, branchItems]) => (
                <div key={region} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-[#714B67]" />
                      <h3 className="text-sm font-black text-slate-900">{region}</h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {branchItems.length} {branchItems.length === 1 ? 'Hub' : 'Hubs'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      Total Sales: <strong className="text-emerald-700 font-mono">{fmt(branchItems.reduce((a, b) => a + b.monthSales, 0))}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branchItems.map((item) => {
                      const b = item.branch
                      const isActive = currentActive === b.id

                      return (
                        <div
                          key={b.id}
                          className={`bg-white rounded-2xl border transition-all shadow-sm hover:shadow-md p-4 flex flex-col justify-between space-y-3 ${
                            isActive ? 'border-emerald-300 ring-2 ring-emerald-500/20' : 'border-slate-100'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#f5eef4] text-[#714B67]'
                                }`}
                              >
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-black text-sm text-slate-900 tracking-tight leading-snug">
                                  {b.name}
                                </h4>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{b.city || 'City not set'}</span>
                                  {b.phone && (
                                    <>
                                      <span>•</span>
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{b.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={() => setBranch(b.id)}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-[#3b1734] hover:text-white text-slate-700 transition cursor-pointer shrink-0"
                              >
                                Switch Hub
                              </button>
                            )}
                          </div>

                          {/* Address note */}
                          <p className="text-[11px] text-slate-500 line-clamp-1 bg-slate-50 px-2.5 py-1 rounded-lg">
                            {b.address || 'Standard retail branch location'}
                          </p>

                          {/* Mini metrics grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Today Sales</span>
                              <strong className="font-mono text-slate-800 text-xs">{fmt(item.todaySales)}</strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">30d Revenue</span>
                              <strong className="font-mono text-emerald-700 text-xs">{fmt(item.monthSales)}</strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Valuation</span>
                              <strong className="font-mono text-indigo-700 text-xs">{fmt(item.stockValue)}</strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Status</span>
                              {item.lowStockCount > 0 ? (
                                <span className="text-[11px] font-bold text-rose-600">⚠️ {item.lowStockCount} Low</span>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-600">✓ Optimal</span>
                              )}
                            </div>
                          </div>

                          {/* Card Actions Footer */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setEditingBranch(b)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#714B67] hover:bg-[#f5eef4] transition cursor-pointer"
                                title="Edit Branch Information"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {b.id !== 'main' && (
                                <button
                                  onClick={() => handleDelete(b)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove Branch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setTab('transfers')
                              }}
                              className="text-[11px] font-bold text-[#714B67] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>Stock Transfer</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {!filteredHo.length && (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm font-bold text-slate-700">No Branch Hubs Found</div>
                  <p className="text-xs text-slate-400 mt-0.5">Try searching with a different term or clear your filters.</p>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE: TABLE */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Branch Hub</th>
                      <th className="py-3 px-4">Region & City</th>
                      <th className="py-3 px-4 text-right">Today Sales</th>
                      <th className="py-3 px-4 text-right">30-day Sales</th>
                      <th className="py-3 px-4 text-right">Net Profit</th>
                      <th className="py-3 px-4 text-right">Stock Valuation</th>
                      <th className="py-3 px-4 text-center">Alerts</th>
                      <th className="py-3 px-4 text-center">Workspace</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHo.map((item) => {
                      const b = item.branch
                      const isActive = currentActive === b.id

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isActive ? 'bg-emerald-600 text-white' : 'bg-[#f5eef4] text-[#714B67]'
                                }`}
                              >
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900">{b.name}</span>
                                <div className="text-[11px] text-slate-400">{b.address || 'Main street'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-700">{b.city || '—'}</span>
                            <div className="text-[10px] text-slate-400 font-medium">{b.region || 'Central'}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800">
                            {fmt(item.todaySales)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                            {fmt(item.monthSales)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            {fmt(item.profit)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700">
                            {fmt(item.stockValue)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.lowStockCount > 0 ? (
                              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                ⚠️ {item.lowStockCount} Low
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px]">✓ Optimal</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={() => setBranch(b.id)}
                                className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-[#3b1734] hover:text-white text-slate-700 transition cursor-pointer"
                              >
                                Switch
                              </button>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingBranch(b)}
                                className="p-1 rounded-lg text-slate-500 hover:text-[#714B67] hover:bg-[#f5eef4] transition cursor-pointer"
                                title="Edit Branch"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {b.id !== 'main' && (
                                <button
                                  onClick={() => handleDelete(b)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Delete Branch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing <strong className="text-slate-800">{filteredHo.length}</strong> of{' '}
                  <strong className="text-slate-800">{ho.length}</strong> total operational branches
                </span>
                <span>
                  Active Hub: <strong className="text-[#714B67] font-bold">{branchById(currentActive)?.name || 'Head Office (Consolidated)'}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: USER ROLES & STAFF ── */}
      {tab === 'users' && (
        <UsersPanel hideHeader={true} addingProp={staffAdding} setAddingProp={setStaffAdding} />
      )}

      {/* ── TAB: SMART AI TRANSFERS ── */}
      {tab === 'smart' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#3b1734] to-[#714B67] text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h3 className="font-black text-base tracking-tight">Smart Inter-Branch AI Rebalancing</h3>
            </div>
            <p className="text-xs text-white/80 max-w-3xl leading-relaxed">
              Scans inventory levels across all regional branches to identify high-surplus locations (&gt;60 units) and low-deficit hubs (&lt;15 units), preventing localized stockouts and minimizing overall replenishment costs.
            </p>
          </div>

          {recMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
              <span>{recMsg}</span>
              <button onClick={() => setRecMsg('')} className="text-emerald-700 hover:text-emerald-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h4 className="font-black text-slate-900 text-sm">Recommended Inter-Branch Transfers</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Autonomous inventory rebalancing suggestions</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f5eef4] text-[#714B67] border border-[#decddd]">
                {smartRecs.length} Recommendations
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Medicine Item</th>
                    <th className="py-3 px-4">Surplus Origin</th>
                    <th className="py-3 px-4">Deficit Destination</th>
                    <th className="py-3 px-4 text-center">Transfer Qty</th>
                    <th className="py-3 px-4">Rebalance Rationale</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {smartRecs.map((rec, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{rec.medicineName}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{rec.fromBranch.name}</span>
                        <div className="text-[10px] text-emerald-700 font-bold">{rec.fromStock} units in stock (Surplus)</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{rec.toBranch.name}</span>
                        <div className="text-[10px] text-rose-600 font-bold">{rec.toStock} units in stock (Deficit)</div>
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
                  {!smartRecs.length && (
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
      )}

      {/* ── TAB 3: STOCK TRANSFERS ── */}
      {tab === 'transfers' && <TransfersView />}

      {/* ── Add / Edit Branch Hub Modal ── */}
      {(adding || editingBranch) && (
        <BranchModal
          branch={editingBranch}
          onClose={() => {
            setAdding(false)
            setEditingBranch(null)
          }}
        />
      )}
    </div>
  )
}

/* ---------- Branch Modal (Add & Edit) ---------- */

function BranchModal({ branch, onClose }) {
  const [name, setName] = useState(branch?.name || '')
  const [city, setCity] = useState(branch?.city || '')
  const [address, setAddress] = useState(branch?.address || '')
  const [region, setRegion] = useState(branch?.region || 'Central Region (Punjab)')
  const [phone, setPhone] = useState(branch?.phone || '')
  const [err, setErr] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Branch Name is required.')
    if (!city.trim()) return setErr('City is required.')

    if (branch) {
      updateBranch(branch.id, {
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        region,
        phone: phone.trim(),
      })
    } else {
      addBranch({
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        region,
        phone: phone.trim(),
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="p-4 bg-gradient-to-r from-[#3b1734] to-[#714B67] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <h3 className="font-bold text-sm">{branch ? 'Edit Branch Hub' : 'Add New Regional Branch Hub'}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Branch Hub Name <span className="text-rose-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Faisalabad Main Hub"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Faisalabad"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#714B67] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#714B67] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Regional Jurisdiction</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#714B67] focus:outline-none cursor-pointer"
            >
              <option value="North Region (Islamabad/KPK)">North Region (Islamabad / Rawalpindi / KPK)</option>
              <option value="Central Region (Punjab)">Central Region (Punjab / Lahore / Faisalabad / Multan)</option>
              <option value="South Region (Sindh)">South Region (Sindh / Karachi / Hyderabad)</option>
              <option value="Balochistan Region">Balochistan Region (Quetta / Hub)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Physical Street Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="e.g. Shop 12, Commercial Market, Jail Road"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#714B67] focus:outline-none"
            />
          </div>

          {err && <p className="text-[11px] font-semibold text-rose-600">{err}</p>}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white font-bold shadow-sm transition cursor-pointer"
            >
              {branch ? 'Save Changes' : 'Create Branch Hub'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ---------- Transfers Tab View ---------- */

function TransfersView() {
  const db = useDB()
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const me = currentUser()
  const canApprove = me?.role === 'MANAGER' || me?.role === 'ADMIN'
  const transfers = transfersList()
  const pending = transfers.filter((t) => t.status === 'PENDING')

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">Inter-Branch Stock Transfers</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Two-stage reservation and manager/admin approval workflow across regional hubs.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Request Custom Transfer</span>
        </button>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center gap-1.5">
              <span>⏳ Pending Transfer Approvals</span>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full font-black">
                {pending.length}
              </span>
            </h3>
            <span className="text-[11px] text-amber-800 font-medium">Requires Manager or Admin confirmation</span>
          </div>
          <div className="space-y-2">
            {pending.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-amber-100 text-xs shadow-xs"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[11px]">{t.trNo}</span>
                    <span className="text-slate-600 font-semibold">{branchById(t.fromBranch)?.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <b className="text-[#714B67]">{branchById(t.toBranch)?.name}</b>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        ✓ Approve
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
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        ✕ Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Authorization required</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <div className="text-rose-600 text-xs font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">{err}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-900 text-sm">Stock Transfer Audit Log</h3>
          <span className="text-xs text-slate-500">{transfers.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Transfer No</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Origin → Destination</th>
                <th className="py-3 px-4">Manifest Items</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Requested By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{t.trNo}</td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">{new Date(t.date).toLocaleString()}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span>{branchById(t.fromBranch)?.name}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-[#714B67]">{branchById(t.toBranch)?.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {t.items
                      .map(
                        (i) =>
                          `${medicineById(db.batches.find((b) => b.id === i.batchId)?.medicineId)?.name || 'Medicine'} ×${i.qty}`
                      )
                      .join(', ')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : t.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-600 font-medium">{t.by}</td>
                </tr>
              ))}
              {!transfers.length && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <ArrowLeftRight className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-bold text-slate-600">No Transfer Logs Found</div>
                    <p className="text-xs text-slate-400 mt-0.5">Stock transfer requests will appear here.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <NewTransferModal onClose={() => setCreating(false)} />}
    </div>
  )
}

/* ---------- New Transfer Request Modal ---------- */

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
    if (!batches.length) return setErr('No stock available for this medicine in origin branch.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="p-4 bg-gradient-to-r from-[#3b1734] to-[#714B67] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            <h3 className="font-bold text-sm">Create Inter-Branch Stock Transfer</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Origin Branch</label>
              <select
                value={fromBranch}
                onChange={(e) => {
                  setFromBranch(e.target.value)
                  setItems([])
                }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#714B67] focus:outline-none"
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
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#714B67] focus:outline-none"
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
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 font-medium focus:ring-2 focus:ring-[#714B67] focus:outline-none"
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
                className="bg-[#3b1734] hover:bg-[#522249] text-white px-4 py-2 rounded-xl font-bold text-xs disabled:opacity-40 transition-all cursor-pointer"
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
                  className="text-rose-500 hover:text-rose-700 p-1 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )
          })}

          {err && <div className="text-rose-600 text-xs font-bold">{err}</div>}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!toBranch || !items.length}
              className="px-5 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white font-bold text-xs disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
            >
              Submit Transfer Request
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
