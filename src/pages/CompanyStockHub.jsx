import { useState, useMemo } from 'react'
import {
  useDB,
  fmt,
  medicineById,
  addMedicine,
  addBatch,
  todayStr,
} from '../lib/db'
import {
  Building2,
  Package,
  Layers,
  Search,
  Plus,
  Printer,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Filter,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react'

export default function CompanyStockHub() {
  const db = useDB()
  const [selectedCompany, setSelectedCompany] = useState('ALL')
  const [search, setSearch] = useState('')
  const [showAddMedModal, setShowAddMedModal] = useState(false)
  const [showStockInModal, setShowStockInModal] = useState(false)

  // New Medicine form state
  const [medName, setMedName] = useState('')
  const [medGeneric, setMedGeneric] = useState('')
  const [medStrength, setMedStrength] = useState('')
  const [medForm, setMedForm] = useState('Tablet')
  const [medPackSize, setMedPackSize] = useState('30 Tablets')
  const [medCompany, setMedCompany] = useState('')
  const [medPurchasePrice, setMedPurchasePrice] = useState('')
  const [medSalePrice, setMedSalePrice] = useState('')
  const [medBatchNo, setMedBatchNo] = useState('')
  const [medExpiry, setMedExpiry] = useState('')
  const [medInitialQty, setMedInitialQty] = useState('')

  const medicines = db.medicines || []
  const batches = db.batches || []
  const suppliers = db.suppliers || []

  // Compute stats per company
  const companyStats = useMemo(() => {
    const map = {}
    const now = new Date()

    // 1. Gather all unique companies from medicines & suppliers
    for (const m of medicines) {
      const comp = (m.manufacturer || m.company || 'Unassigned').trim()
      if (!map[comp]) {
        map[comp] = {
          name: comp,
          medicineIds: new Set(),
          medicines: [],
          totalUnits: 0,
          totalCost: 0,
          totalSaleValue: 0,
          nearExpiryCount: 0,
          expiredCount: 0,
          batches: [],
        }
      }
      map[comp].medicineIds.add(m.id)
      map[comp].medicines.push(m)
    }

    // 2. Aggregate batch numbers and valuations
    for (const b of batches) {
      const m = medicineById(b.medicineId)
      const comp = (m?.manufacturer || m?.company || 'Unassigned').trim()
      if (!map[comp]) {
        map[comp] = {
          name: comp,
          medicineIds: new Set(),
          medicines: [],
          totalUnits: 0,
          totalCost: 0,
          totalSaleValue: 0,
          nearExpiryCount: 0,
          expiredCount: 0,
          batches: [],
        }
      }
      const qty = Number(b.qty) || 0
      const cost = Number(b.purchasePrice) || Number(m?.purchasePrice) || 0
      const sale = Number(b.salePrice) || Number(m?.salePrice) || 0

      map[comp].totalUnits += qty
      map[comp].totalCost += qty * cost
      map[comp].totalSaleValue += qty * sale
      map[comp].batches.push(b)

      // Expiry checks
      if (b.expiry) {
        const expDate = new Date(b.expiry)
        const days = Math.round((expDate - now) / (1000 * 60 * 60 * 24))
        if (days < 0 && qty > 0) map[comp].expiredCount += qty
        else if (days <= 90 && qty > 0) map[comp].nearExpiryCount += qty
      }
    }

    const list = Object.values(map).sort((a, b) => b.totalCost - a.totalCost)
    return list
  }, [medicines, batches])

  // Overall totals
  const overall = useMemo(() => {
    let units = 0
    let cost = 0
    let sale = 0
    let expired = 0
    let nearExpiry = 0

    for (const c of companyStats) {
      units += c.totalUnits
      cost += c.totalCost
      sale += c.totalSaleValue
      expired += c.expiredCount
      nearExpiry += c.nearExpiryCount
    }

    return {
      totalCompanies: companyStats.length,
      totalMedicines: medicines.length,
      totalUnits: units,
      totalCost: cost,
      totalSale: sale,
      potentialProfit: sale - cost,
      marginPct: cost > 0 ? (((sale - cost) / sale) * 100).toFixed(1) : '0.0',
      expiredUnits: expired,
      nearExpiryUnits: nearExpiry,
      topCompany: companyStats[0]?.name || 'N/A',
      topCompanyCost: companyStats[0]?.totalCost || 0,
    }
  }, [companyStats, medicines])

  // Active company data
  const activeCompanyData = useMemo(() => {
    if (selectedCompany === 'ALL') return null
    return companyStats.find((c) => c.name === selectedCompany) || null
  }, [companyStats, selectedCompany])

  // Medicines for active company or all
  const displayedMedicines = useMemo(() => {
    let list = []
    if (activeCompanyData) {
      list = activeCompanyData.medicines
    } else {
      list = medicines
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.generic?.toLowerCase().includes(q) ||
          (m.manufacturer || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [activeCompanyData, medicines, search])

  // Handle Add Medicine under current or chosen company
  const handleAddMedicineSubmit = (e) => {
    e.preventDefault()
    if (!medName.trim()) return

    const companyToUse = (medCompany || (selectedCompany !== 'ALL' ? selectedCompany : 'GSK Pakistan')).trim()
    const pPrice = Number(medPurchasePrice) || 0
    const sPrice = Number(medSalePrice) || Math.round(pPrice * 1.25)

    const newMed = addMedicine({
      name: medName.trim(),
      generic: medGeneric.trim(),
      strength: medStrength.trim(),
      form: medForm,
      packSize: medPackSize.trim() || 'Standard',
      manufacturer: companyToUse,
      brand: medName.trim(),
      purchasePrice: pPrice,
      salePrice: sPrice,
      wholesalePrice: Math.round(sPrice * 0.9),
      minStock: 10,
      maxStock: 200,
    })

    if (medInitialQty && Number(medInitialQty) > 0) {
      addBatch({
        medicineId: newMed.id,
        batchNo: medBatchNo.trim() || 'B-' + Math.floor(1000 + Math.random() * 9000),
        expiry: medExpiry || '2027-12-31',
        qty: Number(medInitialQty),
        purchasePrice: pPrice,
        salePrice: sPrice,
      })
    }

    // Reset & close
    setMedName('')
    setMedGeneric('')
    setMedStrength('')
    setMedPurchasePrice('')
    setMedSalePrice('')
    setMedBatchNo('')
    setMedExpiry('')
    setMedInitialQty('')
    setShowAddMedModal(false)
  }

  const printCompanyReport = () => {
    window.print()
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#3b1734] text-white flex items-center justify-center font-black shadow-sm border border-[#280c23]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Company Stock Hub
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Stock & Valuation by Manufacturer
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={printCompanyReport}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMedCompany(selectedCompany !== 'ALL' ? selectedCompany : 'GSK Pakistan')
              setShowAddMedModal(true)
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Medicine</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Companies */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Manufacturers</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{overall.totalCompanies}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active brands</div>
          </div>
        </div>

        {/* Total Stock Units */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Stock Units</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{overall.totalUnits.toLocaleString('en-PK')}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{overall.totalMedicines} items</div>
          </div>
        </div>

        {/* Total Cost Value */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Purchase Value</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{fmt(overall.totalCost)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total cost</div>
          </div>
        </div>

        {/* Retail Value & Margin */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Retail Value</span>
            <div className="w-8 h-8 rounded-lg bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#008f8b]">{fmt(overall.totalSale)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Margin: {overall.marginPct}%</div>
          </div>
        </div>

        {/* Top Company */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Top Brand</span>
            <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-black text-slate-900 truncate" title={overall.topCompany}>
              {overall.topCompany}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{fmt(overall.topCompanyCost)}</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Manufacturer Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Direct Search Bar */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company or medicine name, generic chemical..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-xs focus:ring-1 focus:ring-[#714B67] focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Manufacturer Dropdown Menu */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[240px] truncate"
                aria-label="Filter by manufacturer"
              >
                <option value="ALL">🏢 All Manufacturers ({companyStats.length})</option>
                {companyStats.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.totalUnits} Units · {fmt(c.totalCost)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Active Company Detail View & Medicines Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Detail View Header */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              {selectedCompany === 'ALL' ? 'All Products' : selectedCompany}
            </h2>
            <span className="text-xs text-slate-400">({displayedMedicines.length} items)</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedCompany !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedCompany('ALL')}
                className="text-xs font-bold text-[#714B67] hover:text-[#5c3c54] px-2.5 py-1 rounded-lg border border-[#decddd] bg-[#f5eef4]/50 transition-colors"
              >
                ← View All
              </button>
            )}
          </div>
        </div>

        {/* Medicines List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-2.5 px-4">Medicine</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Dosage / Pack</th>
                <th className="py-2.5 px-3 text-right">Cost</th>
                <th className="py-2.5 px-3 text-right">Retail</th>
                <th className="py-2.5 px-3 text-right">Stock</th>
                <th className="py-2.5 px-3 text-right">Total (PKR)</th>
                <th className="py-2.5 px-4 text-center">Batch / Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!displayedMedicines.length && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No medicines found. Click "+ Add Medicine" above to add items.
                  </td>
                </tr>
              )}
              {displayedMedicines.map((m) => {
                const medBatches = batches.filter((b) => b.medicineId === m.id && b.qty > 0)
                const totalUnits = medBatches.reduce((acc, b) => acc + Number(b.qty || 0), 0)
                const cost = Number(m.purchasePrice) || 0
                const sale = Number(m.salePrice) || 0
                const totalValue = totalUnits * cost

                // Nearest expiry
                let nearestExpiry = null
                let isNearExpiry = false
                let isExpired = false
                const now = new Date()

                for (const b of medBatches) {
                  if (b.expiry) {
                    const exp = new Date(b.expiry)
                    const diffDays = Math.round((exp - now) / (1000 * 60 * 60 * 24))
                    if (!nearestExpiry || exp < nearestExpiry.date) {
                      nearestExpiry = { date: exp, days: diffDays, str: b.expiry, batchNo: b.batchNo }
                    }
                    if (diffDays < 0) isExpired = true
                    else if (diffDays <= 90) isNearExpiry = true
                  }
                }

                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm leading-tight">{m.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{m.generic || 'Generic N/A'}</div>
                    </td>

                    <td className="py-3 px-3 font-semibold text-[#714B67]">
                      <span className="px-2 py-0.5 rounded bg-[#f5eef4] border border-[#decddd]">
                        {m.manufacturer || 'Unassigned'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      <div>{m.form || 'Tablet'} · {m.strength || ''}</div>
                      <div className="text-[10px] text-slate-400">{m.packSize || 'Pack'}</div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                      {fmt(cost)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      {fmt(sale)}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-sm">
                      <span className={totalUnits <= 10 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                        {totalUnits}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                      {fmt(totalValue)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {nearestExpiry ? (
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isExpired
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isNearExpiry
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isExpired ? '⚠️ Expired' : isNearExpiry ? '⏳ ' + nearestExpiry.days + ' days left' : '✓ ' + nearestExpiry.str}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                            Batch: {nearestExpiry.batchNo}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">No active batch</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Add Medicine Modal */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#f5eef4] text-[#714B67] flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Medicine</h3>
                  <p className="text-[11px] text-slate-500">Register new medicine & batch under pharma company</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMedModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMedicineSubmit} className="p-5 space-y-4 text-xs font-sans">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pharmaceutical Company</label>
                <input
                  type="text"
                  required
                  value={medCompany}
                  onChange={(e) => setMedCompany(e.target.value)}
                  placeholder="e.g. GSK Pakistan, Abbott, Getz Pharma..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-[#714B67] bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brand Name / Medicine Name</label>
                  <input
                    type="text"
                    required
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="e.g. Panadol Extra"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Generic Formula</label>
                  <input
                    type="text"
                    value={medGeneric}
                    onChange={(e) => setMedGeneric(e.target.value)}
                    placeholder="e.g. Paracetamol + Caffeine"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:border-[#714B67]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Strength (e.g. 500mg)</label>
                  <input
                    type="text"
                    value={medStrength}
                    onChange={(e) => setMedStrength(e.target.value)}
                    placeholder="500mg, 10ml..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={medForm}
                    onChange={(e) => setMedForm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Injection">Injection</option>
                    <option value="Drops">Drops</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="Cream">Cream</option>
                    <option value="Ointment">Ointment</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pack Size (Units)</label>
                  <input
                    type="text"
                    value={medPackSize}
                    onChange={(e) => setMedPackSize(e.target.value)}
                    placeholder="20 Tablets"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cost Price (PKR)</label>
                  <input
                    type="number"
                    required
                    value={medPurchasePrice}
                    onChange={(e) => setMedPurchasePrice(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Retail Price (PKR)</label>
                  <input
                    type="number"
                    required
                    value={medSalePrice}
                    onChange={(e) => setMedSalePrice(e.target.value)}
                    placeholder="e.g. 195"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-[#008f8b]"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-[#714B67]" />
                  <span>Initial Batch & Stock (Optional)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Batch Number</label>
                    <input
                      type="text"
                      value={medBatchNo}
                      onChange={(e) => setMedBatchNo(e.target.value)}
                      placeholder="B-4091"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Expiry Date</label>
                    <input
                      type="date"
                      value={medExpiry}
                      onChange={(e) => setMedExpiry(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Quantity (Units)</label>
                    <input
                      type="number"
                      value={medInitialQty}
                      onChange={(e) => setMedInitialQty(e.target.value)}
                      placeholder="50"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white font-bold shadow-sm transition-all cursor-pointer"
                >
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
