import { useState, useMemo } from 'react'
import {
  useDB,
  headOfficeDashboard,
  addBranch,
  updateBranch,
  deleteBranch,
  branchById,
  fmt,
  activeBranch,
  setBranch,
} from '../lib/db'
import {
  Building2,
  AlertTriangle,
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  TrendingUp,
  Package,
  CircleDollarSign,
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
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [editingBranch, setEditingBranch] = useState(null)
  const [adding, setAdding] = useState(false)

  const ho = headOfficeDashboard()
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

  const distinctRegions = useMemo(() => {
    const set = new Set()
    db.branches.forEach((b) => set.add(b.region || 'Central Region (Punjab)'))
    return Array.from(set)
  }, [db.branches])

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
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Enterprise Multi-Branch & HQ Portal
              </h1>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Regional hierarchy monitoring, autonomous inter-branch transfers, and multi-location revenue
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
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3b1734] hover:bg-[#522249] text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Branch Hub</span>
          </button>
        </div>
      </div>

      {/* ── 5 Standard KPI Cards ── */}
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

      {/* ── Overview Matrix & Toolbar ── */}
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

        {/* VIEW MODE: TABLE DIRECTLY */}
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
      </div>

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

