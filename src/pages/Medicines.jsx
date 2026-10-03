import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router'
import {
  useDB,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  addBatch,
  stockOf,
  fmt,
  fefoBatches,
} from '../lib/db'
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Building2,
  CheckCircle2,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  Package,
  FileSpreadsheet,
  Check,
  X,
} from 'lucide-react'
import MedicineGroupFilter from '../components/MedicineGroupFilter'
import {
  DOSAGE_FORM_OPTIONS,
  dosageFormValue,
  filterMedicineRecords,
  medicineFormFields,
  POPULAR_PHARMA_COMPANIES,
  getDistinctCompanies,
} from '../lib/medicineGroups'

function getCompanyBadgeColor(name = '') {
  const n = (name || '').toLowerCase()
  if (n.includes('gsk') || n.includes('glaxo')) return 'bg-amber-100 text-amber-900 border-amber-300'
  if (n.includes('abbott')) return 'bg-blue-100 text-blue-900 border-blue-300'
  if (n.includes('getz')) return 'bg-emerald-100 text-emerald-900 border-emerald-300'
  if (n.includes('sanofi')) return 'bg-purple-100 text-purple-900 border-purple-300'
  if (n.includes('searle')) return 'bg-rose-100 text-rose-900 border-rose-300'
  if (n.includes('martin')) return 'bg-orange-100 text-orange-900 border-orange-300'
  if (n.includes('agp')) return 'bg-cyan-100 text-cyan-900 border-cyan-300'
  if (n.includes('hilton')) return 'bg-teal-100 text-teal-900 border-teal-300'
  if (n.includes('feroz')) return 'bg-indigo-100 text-indigo-900 border-indigo-300'
  if (n.includes('sami')) return 'bg-sky-100 text-sky-900 border-sky-300'
  if (n.includes('pfizer')) return 'bg-blue-100 text-blue-800 border-blue-300'
  if (n.includes('highnoon')) return 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300'
  return 'bg-slate-100 text-slate-800 border-slate-300'
}

function getCompanyInitials(name = '') {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase()
  return (parts[0][0] + (parts[1][0] || '')).toUpperCase()
}

export default function Medicines() {
  const db = useDB()
  let search = ''
  try { search = useLocation().search } catch { search = '' }
  const urlParams = new URLSearchParams(search)
  const controlledMode = urlParams.get('filter') === 'controlled'
  const requestedView = urlParams.get('view')

  const requestedSearch = urlParams.get('search') || urlParams.get('q') || ''

  // View modes: 'companies' (Company-Wise Directory) or 'table' (Flat Product Catalogue)
  const [viewMode, setViewMode] = useState(requestedView === 'table' ? 'table' : (requestedView === 'companies' || !controlledMode ? 'companies' : 'table'))
  const [q, setQ] = useState(requestedSearch)
  const [group, setGroup] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [batchFor, setBatchFor] = useState(null)
  const [companyAddOpen, setCompanyAddOpen] = useState(false)

  // Company-Wise Directory States
  const [compSearch, setCompSearch] = useState(requestedSearch)
  const [compFilterStatus, setCompFilterStatus] = useState('ALL') // 'ALL', 'WITH_STOCK', 'LOW_STOCK', 'ZERO_STOCK'
  const [compSort, setCompSort] = useState('NAME') // 'NAME', 'PRODUCTS', 'STOCK', 'VALUE'
  const [customCompanies, setCustomCompanies] = useState([])
  const [newCompanyModalOpen, setNewCompanyModalOpen] = useState(false)
  const [expandedCompanies, setExpandedCompanies] = useState(() => {
    // Default top companies expanded
    return { 'GSK Pakistan': true, 'Abbott Laboratories': true, 'Getz Pharma': true }
  })

  // Synchronize on URL query change
  useEffect(() => {
    if (requestedView) {
      setViewMode(requestedView)
    }
    const qParam = urlParams.get('search') || urlParams.get('q')
    if (qParam !== null && qParam !== undefined && qParam !== '') {
      setCompSearch(qParam)
      setQ(qParam)
      if (qParam.toLowerCase().includes('gsk')) {
        setExpandedCompanies((prev) => ({ ...prev, 'GSK Pakistan': true }))
      }
    }
  }, [search])

  const distinctCompanies = useMemo(() => getDistinctCompanies(db.medicines || [], customCompanies), [db.medicines, customCompanies])

  // Count medicines per company for quick stats
  const activeCompanyCount = useMemo(() => {
    const map = {}
    for (const m of (db.medicines || [])) {
      const c = (m.manufacturer || 'Unassigned').trim()
      map[c] = (map[c] || 0) + 1
    }
    return map
  }, [db.medicines])

  // Overall catalog KPI stats
  const overallStats = useMemo(() => {
    let totalStockUnits = 0
    let totalCostVal = 0
    let totalRetailVal = 0
    let lowStockCount = 0

    for (const m of (db.medicines || [])) {
      const st = stockOf(m.id)
      totalStockUnits += st
      totalCostVal += (m.purchasePrice || 0) * st
      totalRetailVal += (m.salePrice || 0) * st
      if (st <= (m.minStock || 10)) {
        lowStockCount++
      }
    }

    return {
      totalMedicines: (db.medicines || []).length,
      totalCompanies: distinctCompanies.length,
      totalStockUnits,
      totalCostVal,
      totalRetailVal,
      lowStockCount,
      estimatedProfit: totalRetailVal - totalCostVal,
    }
  }, [db.medicines, distinctCompanies])

  // Company-wise aggregate data
  const companyData = useMemo(() => {
    return distinctCompanies.map((comp) => {
      const isUnassigned = comp === 'Unassigned'
      const meds = (db.medicines || []).filter((m) => {
        const mComp = (m.manufacturer || 'Unassigned').trim().toLowerCase()
        return mComp === comp.toLowerCase()
      })

      let units = 0
      let costVal = 0
      let retailVal = 0
      let lowStockMeds = 0
      let totalBatches = 0

      for (const m of meds) {
        const st = stockOf(m.id)
        units += st
        costVal += (m.purchasePrice || 0) * st
        retailVal += (m.salePrice || 0) * st
        totalBatches += (db.batches || []).filter((b) => b.medicineId === m.id).length
        if (st <= (m.minStock || 10)) {
          lowStockMeds++
        }
      }

      return {
        name: comp,
        isUnassigned,
        medicines: meds,
        productCount: meds.length,
        stockUnits: units,
        costVal,
        retailVal,
        profitVal: retailVal - costVal,
        profitMargin: retailVal > 0 ? Math.round(((retailVal - costVal) / retailVal) * 100) : 0,
        lowStockCount: lowStockMeds,
        totalBatches,
      }
    })
  }, [distinctCompanies, db.medicines, db.batches])

  // Filtered & sorted companies
  const filteredCompanyData = useMemo(() => {
    let result = companyData

    if (compSearch.trim()) {
      const term = compSearch.trim().toLowerCase()
      result = result.filter((c) => {
        if (c.name.toLowerCase().includes(term)) return true
        return c.medicines.some((m) =>
          (m.name || '').toLowerCase().includes(term) ||
          (m.generic || '').toLowerCase().includes(term) ||
          (m.brand || '').toLowerCase().includes(term) ||
          (m.barcode || '').toLowerCase().includes(term) ||
          (m.form || '').toLowerCase().includes(term)
        )
      })
    }

    if (compFilterStatus === 'WITH_STOCK') {
      result = result.filter((c) => c.stockUnits > 0)
    } else if (compFilterStatus === 'LOW_STOCK') {
      result = result.filter((c) => c.lowStockCount > 0)
    } else if (compFilterStatus === 'ZERO_STOCK') {
      result = result.filter((c) => c.stockUnits === 0 && c.productCount > 0)
    }

    if (compSort === 'NAME') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    } else if (compSort === 'PRODUCTS') {
      result = [...result].sort((a, b) => b.productCount - a.productCount)
    } else if (compSort === 'STOCK') {
      result = [...result].sort((a, b) => b.stockUnits - a.stockUnits)
    } else if (compSort === 'VALUE') {
      result = [...result].sort((a, b) => b.retailVal - a.retailVal)
    }

    return result
  }, [companyData, compSearch, compFilterStatus, compSort])

  const toggleCompany = (compName) => {
    setExpandedCompanies((prev) => ({ ...prev, [compName]: !prev[compName] }))
  }

  const expandAll = () => {
    const next = {}
    distinctCompanies.forEach((c) => { next[c] = true })
    setExpandedCompanies(next)
  }

  const collapseAll = () => {
    setExpandedCompanies({})
  }

  const handleRegisterCompany = (name) => {
    if (!name.trim()) return
    const clean = name.trim()
    if (!customCompanies.includes(clean)) {
      setCustomCompanies((prev) => [...prev, clean])
    }
    setNewCompanyModalOpen(false)
    setExpandedCompanies((prev) => ({ ...prev, [clean]: true }))
    setEditing({ manufacturer: clean })
  }

  const controlled = medicine => medicine.controlled === true || /clonazepam|alprazolam|diazepam|lorazepam|morphine|fentanyl|codeine|tramadol|buprenorphine|methadone/i.test(`${medicine.name} ${medicine.generic}`)
  const source = controlledMode ? db.medicines.filter(controlled) : db.medicines
  const { matches: list, counts } = filterMedicineRecords(source, { query: q, group, company: companyFilter })

  return (
    <div className="space-y-4 w-full pb-8">
      {/* Top Bar with View Mode Switcher and Actions */}
      <div className="pb-3 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <span>{controlledMode ? 'Controlled Substances' : 'Company-Wise Medicine Management'}</span>
            </h2>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-sm border border-indigo-200">
              {distinctCompanies.length} Companies · {db.medicines.length} Products
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize, filter, add, and monitor medicines by pharmaceutical manufacturer
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-sm border border-slate-300">
            <button
              type="button"
              onClick={() => setViewMode('companies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all ${
                viewMode === 'companies'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>🏢 Companies Directory</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>📋 All Medicines List</span>
            </button>
          </div>

          {/* Add Actions */}
          <button
            onClick={() => setCompanyAddOpen(true)}
            className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Add medicines grouped by pharma manufacturer"
          >
            <Building2 className="w-3.5 h-3.5" /> + Add by Company
          </button>

          <button
            onClick={() => setEditing({})}
            className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Quickly add a single medicine product"
          >
            <Plus className="w-3.5 h-3.5" /> + Quick Add Product
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">Pharma Companies</span>
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900">{overallStats.totalCompanies}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Active manufacturers</p>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">Total Products</span>
            <Package className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900">{overallStats.totalMedicines}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Master items registered</p>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">Inventory Stock</span>
            <Layers className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900">{overallStats.totalStockUnits.toLocaleString()} <span className="text-[11px] font-normal text-slate-500">units</span></div>
          <p className="text-[10px] text-slate-400 mt-0.5">On-hand across all batches</p>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">Stock Worth (Retail)</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900 font-mono">Rs. {Math.round(overallStats.totalRetailVal).toLocaleString()}</div>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Margin: Rs. {Math.round(overallStats.estimatedProfit).toLocaleString()}</p>
        </div>

        <div className={`p-2.5 rounded-sm border shadow-xs ${overallStats.lowStockCount > 0 ? 'bg-rose-50/60 border-rose-200 text-rose-900' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">Low Stock Alert</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${overallStats.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-base font-extrabold ${overallStats.lowStockCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {overallStats.lowStockCount} <span className="text-[11px] font-normal text-slate-500">items</span>
          </div>
          <p className="text-[10px] mt-0.5 opacity-80">Reorder threshold reached</p>
        </div>
      </div>

      {/* VIEW 1: COMPANY-WISE MANAGEMENT DIRECTORY */}
      {viewMode === 'companies' && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="bg-white p-2.5 border border-slate-200 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
              {/* Search company or inner medicine */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={compSearch}
                  onChange={(e) => setCompSearch(e.target.value)}
                  placeholder="Search company, brand or medicine name (e.g. GSK, Abbott, Panadol)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-sm pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
                {compSearch && (
                  <button
                    onClick={() => setCompSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {compSearch && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-sm text-xs font-bold shrink-0">
                  <span>Filter: {compSearch}</span>
                  <button
                    onClick={() => setCompSearch('')}
                    className="p-0.5 hover:bg-indigo-100 rounded text-indigo-600 cursor-pointer"
                    title="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Status Filter */}
              <select
                value={compFilterStatus}
                onChange={(e) => setCompFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">🏢 All Companies ({companyData.length})</option>
                <option value="WITH_STOCK">📦 With In-Stock Units</option>
                <option value="LOW_STOCK">⚠️ Low Stock Alerts</option>
                <option value="ZERO_STOCK">⭕ Zero Stock Items</option>
              </select>

              {/* Sort By */}
              <select
                value={compSort}
                onChange={(e) => setCompSort(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="NAME">Sort: Company Name (A-Z)</option>
                <option value="PRODUCTS">Sort: Most Products</option>
                <option value="STOCK">Sort: Highest Stock Units</option>
                <option value="VALUE">Sort: Highest Stock Value (Rs.)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={expandAll}
                className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-sm transition-colors"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-sm transition-colors"
              >
                Collapse All
              </button>
              <button
                type="button"
                onClick={() => setNewCompanyModalOpen(true)}
                className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New Company
              </button>
            </div>
          </div>

          {/* Company Cards List */}
          <div className="space-y-3">
            {filteredCompanyData.map((c) => {
              const isExpanded = Boolean(expandedCompanies[c.name] || compSearch.trim())
              const badgeColor = getCompanyBadgeColor(c.name)
              const initials = getCompanyInitials(c.name)

              return (
                <div
                  key={c.name}
                  className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden transition-all"
                >
                  {/* Company Card Header */}
                  <div
                    className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-slate-50/90 border-slate-200' : 'bg-white hover:bg-slate-50/60 border-transparent'
                    }`}
                    onClick={() => toggleCompany(c.name)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Initials Avatar */}
                      <span
                        className={`w-9 h-9 rounded-sm border font-extrabold text-xs flex items-center justify-center shrink-0 tracking-wider shadow-2xs ${badgeColor}`}
                      >
                        {initials}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                            {c.name}
                          </h3>
                          {c.lowStockCount > 0 && (
                            <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> {c.lowStockCount} Low Stock
                            </span>
                          )}
                        </div>

                        {/* Badges / Metrics */}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">
                            <b>{c.productCount}</b> Products
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-slate-700">
                            <b>{c.stockUnits}</b> Units on hand
                          </span>
                          <span>·</span>
                          <span className="font-mono text-slate-700">
                            Retail: <b>Rs. {Math.round(c.retailVal).toLocaleString()}</b>
                          </span>
                          <span>·</span>
                          <span className="text-emerald-700 font-semibold font-mono">
                            Cost: Rs. {Math.round(c.costVal).toLocaleString()} ({c.profitMargin}% margin)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons inside header */}
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setEditing({ manufacturer: c.name })}
                        className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-sm text-xs font-bold transition-colors inline-flex items-center gap-1"
                        title={`Add a new medicine for ${c.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Medicine
                      </button>

                      <button
                        type="button"
                        onClick={() => setCompanyAddOpen(c.name)}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-sm text-xs font-bold transition-colors inline-flex items-center gap-1"
                        title={`Bulk add multiple products for ${c.name}`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Multi-Add
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCompany(c.name)}
                        className="p-1 rounded-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Company Expanded Products Table */}
                  {isExpanded && (
                    <div>
                      {c.medicines.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50/50">
                          <p className="text-xs text-slate-500 font-medium">
                            No medicines registered yet under <b>{c.name}</b>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setEditing({ manufacturer: c.name })}
                            className="mt-2.5 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add First Medicine for {c.name}
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1100px] text-xs text-left">
                            <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold">
                              <tr>
                                <th className="p-2.5 pl-3">Medicine & Strength</th>
                                <th className="p-2.5">Generic Chemical / Brand</th>
                                <th className="p-2.5">Form</th>
                                <th className="p-2.5">Pack Size</th>
                                <th className="p-2.5">Barcode</th>
                                <th className="p-2.5 text-right">In Stock</th>
                                <th className="p-2.5 text-right">Batches</th>
                                <th className="p-2.5 text-right">Purchase Price</th>
                                <th className="p-2.5 text-right">Retail Price</th>
                                <th className="p-2.5 text-right">Wholesale</th>
                                <th className="p-2.5 text-right">Margin</th>
                                <th className="p-2.5 pr-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {c.medicines.map((m) => {
                                const st = stockOf(m.id)
                                const isLow = st <= (m.minStock || 10)
                                const batchesCount = (db.batches || []).filter((b) => b.medicineId === m.id).length
                                const marginPct = m.salePrice > 0 ? Math.round(((m.salePrice - (m.purchasePrice || 0)) / m.salePrice) * 100) : 0

                                return (
                                  <tr key={m.id} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="p-2.5 pl-3 font-bold text-slate-900">
                                      {m.name}{' '}
                                      <span className="font-normal text-slate-500">{m.strength}</span>
                                    </td>
                                    <td className="p-2.5">
                                      <span className="text-slate-700">{m.generic || '—'}</span>
                                      <p className="text-[10px] text-slate-400">Brand: {m.brand || m.name}</p>
                                    </td>
                                    <td className="p-2.5">
                                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                                        {dosageFormValue(m) || 'Tablet'}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-600">{m.packSize || '—'}</td>
                                    <td className="p-2.5 font-mono text-[11px] text-slate-600">{m.barcode || '—'}</td>
                                    <td className={`p-2.5 text-right font-bold tabular-nums ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                                      {st}
                                      {isLow && <span className="block text-[9px] text-rose-500 font-bold whitespace-nowrap">LOW STOCK</span>}
                                    </td>
                                    <td className="p-2.5 text-right tabular-nums text-slate-600">{batchesCount}</td>
                                    <td className="p-2.5 text-right font-mono text-slate-600 tabular-nums">
                                      {m.purchasePrice == null ? '—' : fmt(m.purchasePrice)}
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                                      {fmt(m.salePrice)}
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-emerald-700 tabular-nums">
                                      {m.wholesalePrice == null ? '—' : fmt(m.wholesalePrice)}
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-slate-600 tabular-nums">
                                      {marginPct}%
                                    </td>
                                    <td className="p-2.5 pr-3 text-center">
                                      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setBatchFor(m)}
                                          className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-1 rounded text-[11px] font-bold transition-colors"
                                          title={`Stock in batch for ${m.name}`}
                                        >
                                          <Plus className="w-3 h-3" /> Batch
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditing(m)}
                                          className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded text-[11px] font-semibold transition-colors"
                                          title={`Edit ${m.name}`}
                                        >
                                          <Edit3 className="w-3 h-3" /> Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => confirm(`Permanently delete ${m.name}?`) && deleteMedicine(m.id)}
                                          className="inline-flex items-center gap-1 text-rose-600 hover:bg-rose-50 border border-rose-100 px-2 py-1 rounded text-[11px] font-semibold transition-colors"
                                          title={`Delete ${m.name}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>

                          {/* Company Footer Summary Bar */}
                          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-3">
                            <span>
                              <b>{c.name}</b>: {c.medicines.length} products listed
                            </span>
                            <div className="flex items-center gap-3 font-mono font-semibold">
                              <span>Total Stock: <b>{c.stockUnits} units</b></span>
                              <span>Total Cost: <b>Rs. {Math.round(c.costVal).toLocaleString()}</b></span>
                              <span>Total Retail: <b>Rs. {Math.round(c.retailVal).toLocaleString()}</b></span>
                              <span className="text-emerald-700">Gross Margin: <b>Rs. {Math.round(c.profitVal).toLocaleString()} ({c.profitMargin}%)</b></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {!filteredCompanyData.length && (
              <div className="bg-white p-8 text-center rounded-sm border border-slate-200 text-slate-500">
                No pharmaceutical companies match your search and filter criteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: FLAT MASTER CATALOGUE TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="space-y-3">
          {/* Flat Catalogue Filters */}
          <div className="bg-white p-2.5 border border-slate-200 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
              {/* Company Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-sm px-2.5 py-1.5 shrink-0">
                <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[170px] truncate"
                  aria-label="Filter medicines by pharmaceutical company"
                >
                  <option value="all">🏢 All Companies ({distinctCompanies.length})</option>
                  {distinctCompanies.map((c) => (
                    <option key={c} value={c}>
                      {c} {activeCompanyCount[c] ? `(${activeCompanyCount[c]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search medicines"
                  placeholder="Name, generic, barcode, form..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-sm pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Company Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scroll">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" /> Top Companies:
            </span>
            <button
              type="button"
              onClick={() => setCompanyFilter('all')}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-bold transition-colors shrink-0 ${
                companyFilter === 'all'
                  ? 'bg-[#e9f5f2] text-[#006d69] border border-[#a2ded5] shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              All ({source.length})
            </button>
            {distinctCompanies.slice(0, 10).map((comp) => {
              const count = activeCompanyCount[comp] || 0
              const isSelected = companyFilter === comp
              return (
                <button
                  key={comp}
                  type="button"
                  onClick={() => setCompanyFilter(isSelected ? 'all' : comp)}
                  className={`px-2.5 py-1 rounded-sm text-[11px] font-semibold transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-[#e9f5f2] text-[#006d69] border border-[#a2ded5] font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {comp} {count > 0 && <span className={`text-[10px] font-mono ml-0.5 ${isSelected ? 'text-[#006d69]/80 font-bold' : 'opacity-75'}`}>({count})</span>}
                </button>
              )
            })}
          </div>

          <MedicineGroupFilter value={group} onChange={setGroup} counts={counts} />

          {/* Flat Master Table */}
          <section aria-label="Medicine catalogue" className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-slate-500" role="status">
                Showing <b className="text-slate-800">{list.length}</b> of {source.length} {controlledMode ? 'controlled medicines' : 'products'}
                {companyFilter !== 'all' && (
                  <span className="ml-1 text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    🏢 {companyFilter}
                  </span>
                )}
              </p>
              {(q || group !== 'all' || companyFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setGroup('all'); setCompanyFilter('all') }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <section className="bg-white border border-slate-200 overflow-x-auto" aria-label="Medicine list" tabIndex={0}>
              <table className="w-full min-w-[1250px] text-xs text-left">
                <caption className="sr-only">Medicine catalogue records</caption>
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Medicine & Strength', 'Generic / Brand', 'Form', 'Company / Manufacturer', 'Pack', 'Barcode', 'Stock', 'Batches', 'Purchase', 'Retail', 'Wholesale', 'Actions'].map((heading) => (
                      <th key={heading} scope="col" className={`p-3 whitespace-nowrap ${['Stock', 'Batches', 'Purchase', 'Retail', 'Wholesale'].includes(heading) ? 'text-right' : ''}`}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {list.map((m) => {
                    const st = stockOf(m.id)
                    const isLow = st <= (m.minStock || 10)
                    const batchesCount = (db.batches || []).filter((b) => b.medicineId === m.id).length
                    return (
                      <tr key={m.id} aria-label={`${m.name} ${m.strength || ''}`.trim()} className="hover:bg-slate-50 transition-colors">
                        <th scope="row" className="p-3 min-w-48 text-slate-900">{m.name}{' '}<span className="font-medium text-slate-500">{m.strength}</span></th>
                        <td className="p-3 min-w-40">{m.generic || '—'}<p className="mt-1 text-[10px] text-slate-500">Brand: {m.brand || m.name}</p></td>
                        <td className="p-3">{dosageFormValue(m) || 'Not specified'}</td>
                        <td className="p-3">
                          {m.manufacturer ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCompanyFilter(m.manufacturer)
                              }}
                              className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold text-left"
                              title={`Filter products by ${m.manufacturer}`}
                            >
                              {m.manufacturer}
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3">{m.packSize || '—'}</td>
                        <td className="p-3 font-mono">{m.barcode || '—'}</td>
                        <td className={`p-3 text-right font-bold tabular-nums ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                          {st}
                          {isLow && <span className="block text-[9px] whitespace-nowrap text-rose-500 font-bold">LOW STOCK</span>}
                        </td>
                        <td className="p-3 text-right tabular-nums">{batchesCount}</td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">{m.purchasePrice == null ? '—' : fmt(m.purchasePrice)}</td>
                        <td className="p-3 text-right font-semibold tabular-nums whitespace-nowrap">{fmt(m.salePrice)}</td>
                        <td className="p-3 text-right tabular-nums whitespace-nowrap">{m.wholesalePrice == null ? '—' : fmt(m.wholesalePrice)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <button
                              onClick={() => setBatchFor(m)}
                              className="inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-sm text-xs font-bold transition-colors"
                              title="Stock In New Batch"
                              aria-label={`Add batch for ${m.name}`}
                            >
                              <Plus className="w-3.5 h-3.5" /> Batch
                            </button>
                            <button
                              onClick={() => setEditing(m)}
                              className="inline-flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors"
                              title="Edit Medicine"
                              aria-label={`Edit ${m.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => confirm(`Permanently delete ${m.name}?`) && deleteMedicine(m.id)}
                              className="inline-flex items-center justify-center gap-1.5 text-rose-600 hover:bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-sm text-xs font-semibold transition-colors"
                              title="Delete Medicine"
                              aria-label={`Delete ${m.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!list.length && (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-sm text-slate-500 font-medium">
                        {controlledMode
                          ? 'No controlled medicines found.'
                          : db.medicines.length
                          ? 'No medicines match this dosage form, company, and search.'
                          : 'No medicines yet. Add a medicine to start your catalogue.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </section>
        </div>
      )}

      {/* Modals */}
      {editing && (
        <MedicineForm
          med={editing}
          distinctCompanies={distinctCompanies}
          onClose={() => setEditing(null)}
        />
      )}
      {batchFor && <BatchForm medicine={batchFor} onClose={() => setBatchFor(null)} />}
      {companyAddOpen && (
        <CompanyAddMedicineModal
          onClose={() => setCompanyAddOpen(false)}
          initialCompany={typeof companyAddOpen === 'string' ? companyAddOpen : ''}
        />
      )}
      {newCompanyModalOpen && (
        <RegisterCompanyModal
          onSave={handleRegisterCompany}
          onClose={() => setNewCompanyModalOpen(false)}
        />
      )}
    </div>
  )
}

function RegisterCompanyModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  return (
    <Modal title="🏢 Register Pharmaceutical Manufacturer" onClose={onClose}>
      <div className="space-y-3 text-xs">
        <p className="text-slate-600">
          Enter the official pharmaceutical company / manufacturer name to organize your medicines and batches under it.
        </p>
        <div>
          <label className="block font-bold text-slate-700 mb-1">Company Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. National Pharmaceuticals, Bio-Labs, Horizon..."
            className="w-full bg-white border border-slate-300 rounded-sm px-3 py-2 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-300 rounded-sm text-slate-700 font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return alert('Please enter a company name')
              onSave(name.trim())
            }}
            className="px-4 py-1.5 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white rounded-lg font-bold shadow-sm cursor-pointer"
          >
            Register & Add Product
          </button>
        </div>
      </div>
    </Modal>
  )
}

function MedicineForm({ med, distinctCompanies = [], onClose }) {
  const [f, setF] = useState({
    name: med.name || '',
    generic: med.generic || '',
    brand: med.brand || med.name || '',
    strength: med.strength || '',
    ...medicineFormFields(med),
    manufacturer: med.manufacturer || '',
    packSize: med.packSize || '20 Tablets',
    barcode: med.barcode || '',
    minStock: med.minStock ?? 10,
    maxStock: med.maxStock ?? 100,
    purchasePrice: med.purchasePrice ?? Math.round((med.salePrice || 100) * 0.75),
    salePrice: med.salePrice ?? 0,
    wholesalePrice: med.wholesalePrice ?? Math.round((med.salePrice || 100) * 0.85),
  })

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal title={med.id ? `Edit Medicine — ${med.name}` : 'Create Medicine Master Item'} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Medicine Name *" value={f.name} onChange={set('name')} placeholder="e.g. Panadol" />
          <Input label="Brand Name" value={f.brand} onChange={set('brand')} placeholder="e.g. Panadol ActiFast" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Generic Chemical Formula *" value={f.generic} onChange={set('generic')} placeholder="e.g. Paracetamol" />
          <Input label="Strength" value={f.strength} onChange={set('strength')} placeholder="e.g. 500mg, 10mg/5ml" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="medicine-dosage-form" className="block font-bold text-slate-700 mb-1">Dosage Form</label>
            <select
              id="medicine-dosage-form"
              value={dosageFormValue(f)}
              onChange={(e) => setF({ ...f, dosageForm: e.target.value, form: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
            >
              {!dosageFormValue(f) && <option value="">Not specified</option>}
              {dosageFormValue(f) && !DOSAGE_FORM_OPTIONS.includes(dosageFormValue(f)) && <option value={dosageFormValue(f)}>{dosageFormValue(f)} (existing)</option>}
              {DOSAGE_FORM_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Manufacturer / Company</label>
            <input
              type="text"
              list="form-pharma-list"
              value={f.manufacturer}
              onChange={set('manufacturer')}
              placeholder="e.g. GSK Pakistan, Abbott"
              className="w-full bg-white border border-slate-300 rounded-sm px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
            />
            <datalist id="form-pharma-list">
              {distinctCompanies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1 mt-1">
              {['GSK Pakistan', 'Abbott Laboratories', 'Getz Pharma', 'Sanofi Aventis', 'The Searle Company', 'Hilton Pharma'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF({ ...f, manufacturer: c })}
                  className="text-[9px] px-1 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200"
                >
                  {c.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <Input label="Pack Size" value={f.packSize} onChange={set('packSize')} placeholder="e.g. 20 Tablets" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Barcode" value={f.barcode} onChange={set('barcode')} placeholder="e.g. 1000001" />
          <Input label="Min Stock (Reorder)" type="number" value={f.minStock} onChange={set('minStock')} />
          <Input label="Max Stock" type="number" value={f.maxStock} onChange={set('maxStock')} />
        </div>

        <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Purchase Price (Rs.)</label>
            <input
              type="number"
              value={f.purchasePrice}
              onChange={set('purchasePrice')}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Retail Price / MSRP (Rs.) *</label>
            <input
              type="number"
              value={f.salePrice}
              onChange={set('salePrice')}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Wholesale Price (Rs.)</label>
            <input
              type="number"
              value={f.wholesalePrice}
              onChange={set('wholesalePrice')}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-emerald-700"
            />
          </div>
        </div>

        <button
          onClick={() => {
            if (!f.name.trim()) return alert('Medicine Name is required')
            med.id ? updateMedicine(med.id, f) : addMedicine(f)
            onClose()
          }}
          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm"
        >
          Save Medicine Master
        </button>
      </div>
    </Modal>
  )
}

function BatchForm({ medicine, onClose }) {
  const db = useDB()
  const existing = fefoBatches(medicine.id)
  const [f, setF] = useState({
    batchNo: '',
    mfgDate: new Date().toISOString().slice(0, 10),
    expiry: '',
    qty: 50,
    purchasePrice: medicine.purchasePrice || Math.round(medicine.salePrice * 0.75),
    salePrice: medicine.salePrice,
    supplierId: db.suppliers[0]?.id || '',
    status: 'ACTIVE',
  })

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal title={`Stock In Batches — ${medicine.name} ${medicine.strength}`} onClose={onClose}>
      <div className="space-y-4 text-xs">
        {existing.length > 0 && (
          <div>
            <h4 className="font-bold text-slate-700 mb-1.5">Existing Active Batches (FEFO Order):</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-2 text-left">Batch #</th>
                    <th className="p-2 text-center">Expiry</th>
                    <th className="p-2 text-center">Stock</th>
                    <th className="p-2 text-right">Cost</th>
                    <th className="p-2 text-right">Retail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {existing.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-slate-800">{b.batchNo}</td>
                      <td className="p-2 text-center text-slate-600">{b.expiry}</td>
                      <td className="p-2 text-center font-bold text-slate-900">{b.qty}</td>
                      <td className="p-2 text-right text-slate-600">{fmt(b.purchasePrice)}</td>
                      <td className="p-2 text-right font-bold text-slate-800">{fmt(b.salePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-900">+ Stock In New Batch (FEFO Inward)</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Batch Number *" value={f.batchNo} onChange={set('batchNo')} placeholder="e.g. BT-9901" />
            <div>
              <label className="block font-bold text-slate-700 mb-1">Distributor / Supplier</label>
              <select
                value={f.supplierId}
                onChange={set('supplierId')}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                {db.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.company})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Manufacturing Date" type="date" value={f.mfgDate} onChange={set('mfgDate')} />
            <Input label="Expiry Date *" type="date" value={f.expiry} onChange={set('expiry')} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Inward Quantity *" type="number" value={f.qty} onChange={set('qty')} />
            <Input label="Purchase Price" type="number" value={f.purchasePrice} onChange={set('purchasePrice')} />
            <Input label="Sale Price (MSRP)" type="number" value={f.salePrice} onChange={set('salePrice')} />
          </div>
        </div>

        <button
          onClick={() => {
            if (!f.batchNo.trim() || !f.expiry) return alert('Batch Number and Expiry Date are required')
            addBatch({ ...f, medicineId: medicine.id })
            onClose()
          }}
          className="w-full bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
        >
          Confirm Inward Batch Stock
        </button>
      </div>
    </Modal>
  )
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-sm p-5 w-full max-w-xl max-h-[92vh] overflow-y-auto custom-scroll shadow-2xl border border-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
          <h3 className="font-bold text-base text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-sm text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <div>
      <label className="block font-bold text-slate-700 mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-white border border-slate-300 rounded-sm px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
      />
    </div>
  )
}

export function CompanyAddMedicineModal({ onClose, initialCompany = '' }) {
  const db = useDB()
  const distinctCompanies = useMemo(() => getDistinctCompanies(db.medicines || []), [db.medicines])
  const [company, setCompany] = useState(() => {
    if (initialCompany && distinctCompanies.includes(initialCompany)) return initialCompany
    if (initialCompany) return initialCompany
    return distinctCompanies[0] || 'GSK Pakistan'
  })
  const [customCompany, setCustomCompany] = useState(() => {
    return initialCompany && !distinctCompanies.includes(initialCompany) ? initialCompany : ''
  })
  const [isCustom, setIsCustom] = useState(() => {
    return Boolean(initialCompany && !distinctCompanies.includes(initialCompany))
  })
  const [addedList, setAddedList] = useState([])

  const activeCompanyName = isCustom ? customCompany.trim() : company.trim()

  // Medicine Master Form State
  const [f, setF] = useState({
    name: '',
    generic: '',
    brand: '',
    strength: '',
    dosageForm: 'Tablet',
    form: 'Tablet',
    packSize: '20 Tablets',
    barcode: '',
    minStock: 10,
    maxStock: 100,
    purchasePrice: 75,
    salePrice: 100,
    wholesalePrice: 85,
  })

  // Optional Initial Batch Form State
  const [stockInBatch, setStockInBatch] = useState(true)
  const [b, setB] = useState({
    batchNo: '',
    expiry: '',
    qty: 50,
  })

  const setMed = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }))
  const setBatch = (k) => (e) => setB((prev) => ({ ...prev, [k]: e.target.value }))

  const existingCompanyMeds = useMemo(() => {
    if (!activeCompanyName) return []
    return (db.medicines || []).filter(
      (m) => (m.manufacturer || '').toLowerCase().trim() === activeCompanyName.toLowerCase()
    )
  }, [db.medicines, activeCompanyName])

  function handleSave(andAddAnother = false) {
    if (!activeCompanyName) {
      alert('Please select or enter a Pharma Company name.')
      return
    }
    if (!f.name.trim()) {
      alert('Medicine Name is required.')
      return
    }

    const newMed = addMedicine({
      ...f,
      manufacturer: activeCompanyName,
      brand: f.brand || f.name,
      purchasePrice: Number(f.purchasePrice) || 0,
      salePrice: Number(f.salePrice) || 0,
      wholesalePrice: Number(f.wholesalePrice) || 0,
      minStock: Number(f.minStock) || 10,
      maxStock: Number(f.maxStock) || 100,
    })

    let batchAdded = null
    if (stockInBatch && b.batchNo.trim() && b.expiry) {
      batchAdded = addBatch({
        medicineId: newMed.id,
        batchNo: b.batchNo.trim(),
        mfgDate: new Date().toISOString().slice(0, 10),
        expiry: b.expiry,
        qty: Number(b.qty) || 0,
        purchasePrice: Number(f.purchasePrice) || 0,
        salePrice: Number(f.salePrice) || 0,
        supplierId: db.suppliers[0]?.id || '',
        status: 'ACTIVE',
      })
    }

    setAddedList((prev) => [
      {
        id: newMed.id,
        name: `${newMed.name} ${newMed.strength || ''}`,
        qty: batchAdded ? batchAdded.qty : 0,
        batchNo: batchAdded ? batchAdded.batchNo : null,
      },
      ...prev,
    ])

    if (andAddAnother) {
      setF({
        name: '',
        generic: '',
        brand: '',
        strength: '',
        dosageForm: f.dosageForm,
        form: f.form,
        packSize: f.packSize,
        barcode: '',
        minStock: 10,
        maxStock: 100,
        purchasePrice: 75,
        salePrice: 100,
        wholesalePrice: 85,
      })
      setB({
        batchNo: '',
        expiry: '',
        qty: 50,
      })
    } else {
      onClose()
    }
  }

  return (
    <Modal title="Add Medicines by Company" onClose={onClose}>
      <div className="space-y-4 text-xs">
        {/* Step 1: Select / Switch Company */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <span className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-700" /> 1. Select Pharmaceutical Company
              </span>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                All medicines added in this session will automatically be tagged to this company.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCustom(!isCustom)}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline self-start sm:self-auto cursor-pointer"
            >
              {isCustom ? '← Select from list' : '+ Type new company name'}
            </button>
          </div>

          {isCustom ? (
            <input
              type="text"
              value={customCompany}
              onChange={(e) => setCustomCompany(e.target.value)}
              placeholder="Enter company name... (e.g. Platinum Pharma, Horizon, Bio-Labs)"
              className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
            >
              {distinctCompanies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Quick Click Pills */}
          {!isCustom && (
            <div className="flex flex-wrap gap-1 pt-1">
              {['GSK Pakistan', 'Abbott Laboratories', 'Getz Pharma', 'Sanofi Aventis', 'The Searle Company', 'Hilton Pharma', 'Sami Pharmaceuticals', 'Ferozsons Laboratories'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCompany(p)}
                  className={`text-[10px] px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                    company === p
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'bg-white/80 hover:bg-white text-indigo-900 border border-indigo-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-medium text-indigo-800 pt-1 border-t border-indigo-200/60">
            <span>Selected Company: <strong className="font-extrabold text-indigo-950">{activeCompanyName || 'None'}</strong></span>
            <span>{existingCompanyMeds.length} medicines already registered</span>
          </div>
        </div>

        {/* Step 2: Medicine Master Details */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <span className="font-extrabold text-slate-900 text-xs block">
            2. Product Details & Pricing
          </span>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Medicine Name *" value={f.name} onChange={setMed('name')} placeholder="e.g. Panadol, Augmentin, Risek" />
            <Input label="Brand Name" value={f.brand} onChange={setMed('brand')} placeholder="e.g. Panadol Extra, Risek Insta" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Generic Formula / Salt *" value={f.generic} onChange={setMed('generic')} placeholder="e.g. Paracetamol, Omeprazole" />
            <Input label="Strength" value={f.strength} onChange={setMed('strength')} placeholder="e.g. 500mg, 20mg, 10mg/5ml" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dosage Form</label>
              <select
                value={f.dosageForm}
                onChange={(e) => setF((prev) => ({ ...prev, dosageForm: e.target.value, form: e.target.value }))}
                className="w-full bg-white border border-slate-300 rounded-sm px-2.5 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
              >
                {DOSAGE_FORM_OPTIONS.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>
            <Input label="Pack Size" value={f.packSize} onChange={setMed('packSize')} placeholder="e.g. 20 Tablets, 14 Capsules" />
            <Input label="Barcode" value={f.barcode} onChange={setMed('barcode')} placeholder="8964000..." />
          </div>

          <div className="grid grid-cols-3 gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Cost Price (Rs.)</label>
              <input
                type="number"
                value={f.purchasePrice}
                onChange={setMed('purchasePrice')}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Retail Price (Rs.) *</label>
              <input
                type="number"
                value={f.salePrice}
                onChange={setMed('salePrice')}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Wholesale Price (Rs.)</label>
              <input
                type="number"
                value={f.wholesalePrice}
                onChange={setMed('wholesalePrice')}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold text-emerald-700"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Optional Inward Batch to Inventory */}
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stockInBatch}
                onChange={(e) => setStockInBatch(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span className="font-extrabold text-emerald-950 text-xs">
                3. Initial Batch Stock In (Optional)
              </span>
            </label>
            <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
              Auto-Stock
            </span>
          </div>

          {stockInBatch && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              <Input label="Batch Number *" value={b.batchNo} onChange={setBatch('batchNo')} placeholder="e.g. BT-8891" />
              <Input label="Expiry Date *" type="date" value={b.expiry} onChange={setBatch('expiry')} />
              <Input label="Stock Quantity (Units) *" type="number" value={b.qty} onChange={setBatch('qty')} />
            </div>
          )}
        </div>

        {/* Recently Added in this session */}
        {addedList.length > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 block">
              ✓ Added in this session for {activeCompanyName} ({addedList.length}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {addedList.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {item.name}
                  {item.qty > 0 && (
                    <span className="text-indigo-600 font-mono text-[10px] font-bold">
                      ({item.qty} units · {item.batchNo})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="flex-1 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white py-2.5 rounded-xl font-bold transition-all shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Save & Add Next
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-colors shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" /> Save & Close
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
