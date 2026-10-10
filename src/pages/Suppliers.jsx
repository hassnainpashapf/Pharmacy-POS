import { useState, useMemo } from 'react'
import {
  useDB,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  paySupplier,
  fmt,
} from '../lib/db'
import {
  Truck,
  Building2,
  Plus,
  Search,
  Printer,
  Phone,
  Mail,
  MapPin,
  Receipt,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Filter,
  DollarSign,
  Edit3,
  Trash2,
  X,
  CreditCard,
  MessageCircle,
} from 'lucide-react'

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

function getInitials(name = '') {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

export function Suppliers() {
  const db = useDB()
  const suppliers = db.suppliers || []
  const purchases = db.purchases || []

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'DUE' | 'CLEARED'
  const [companyFilter, setCompanyFilter] = useState('ALL')

  // Modals state
  const [modalSupplier, setModalSupplier] = useState(null) // null (closed) | {} (new) | supplierObj (edit)
  const [payFor, setPayFor] = useState(null) // supplierObj for payment

  // Distinct company list
  const distinctCompanies = useMemo(() => {
    const set = new Set()
    for (const s of suppliers) {
      if (s.company?.trim()) set.add(s.company.trim())
    }
    return Array.from(set).sort()
  }, [suppliers])

  // Enhanced supplier reports with invoice aggregations
  const enrichedSuppliers = useMemo(() => {
    return suppliers.map((s) => {
      const suPurchases = purchases.filter((p) => p.supplierId === s.id)
      const totalPurchases = suPurchases.reduce((acc, p) => acc + (p.total || 0), 0)
      const totalPaid = suPurchases.reduce((acc, p) => acc + (p.paid || 0), 0)
      const invoiceCount = suPurchases.length
      const lastPurchaseDate = suPurchases.map((p) => p.date).sort().slice(-1)[0] || '—'
      const currentBalance = Math.max(0, s.balance || 0)

      return {
        ...s,
        totalPurchases,
        totalPaid,
        invoiceCount,
        lastPurchaseDate,
        outstanding: currentBalance,
      }
    })
  }, [suppliers, purchases])

  // Overall KPI statistics
  const stats = useMemo(() => {
    let totalPurchases = 0
    let totalPaid = 0
    let totalPayable = 0
    let withBalanceCount = 0

    for (const s of enrichedSuppliers) {
      totalPurchases += s.totalPurchases
      totalPaid += s.totalPaid
      totalPayable += s.outstanding
      if (s.outstanding > 0) withBalanceCount++
    }

    return {
      totalSuppliers: suppliers.length,
      totalInvoices: purchases.length,
      totalPurchases,
      totalPaid,
      totalPayable,
      withBalanceCount,
      clearedCount: suppliers.length - withBalanceCount,
    }
  }, [enrichedSuppliers, suppliers, purchases])

  // Filtered suppliers based on search, status, and company
  const filteredSuppliers = useMemo(() => {
    return enrichedSuppliers.filter((s) => {
      const q = search.toLowerCase().trim()
      const matchSearch =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.company?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q)

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'DUE' && s.outstanding > 0) ||
        (statusFilter === 'CLEARED' && s.outstanding <= 0)

      const matchCompany =
        companyFilter === 'ALL' ||
        (s.company || '').trim().toLowerCase() === companyFilter.trim().toLowerCase()

      return matchSearch && matchStatus && matchCompany
    })
  }, [enrichedSuppliers, search, statusFilter, companyFilter])

  const handleDelete = (id, name) => {
    if (confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      deleteSupplier(id)
    }
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner (Merged into page layout matching Company Stock Hub) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-o-blue text-white flex items-center justify-center font-black shadow-sm border border-o-blue-d shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Suppliers & Distributors
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Vendor directories, pharmaceutical distributors, and payable credit ledgers
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={() => setModalSupplier({})}
            className="bg-o-blue hover:bg-o-blue-d active:bg-o-blue-d border border-o-blue-d text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Supplier</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPIs Cards (Clean & Uniform matching Company Stock Hub) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Suppliers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Suppliers</span>
            <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{stats.totalSuppliers}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active vendor accounts</div>
          </div>
        </div>

        {/* Total Inward Invoices */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Inward Bills</span>
            <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{stats.totalInvoices}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">GRN purchase entries</div>
          </div>
        </div>

        {/* Total Purchases */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Total Procured</span>
            <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{fmt(stats.totalPurchases)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Cumulative billing</div>
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Paid to Vendors</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700">{fmt(stats.totalPaid)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Cleared payments</div>
          </div>
        </div>

        {/* Outstanding Payable Due */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Payable Due</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.totalPayable > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${stats.totalPayable > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{fmt(stats.totalPayable)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{stats.withBalanceCount} vendors with dues</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Direct Search Bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier name, company, phone, email, or address..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-o-blue"
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

          {/* Company Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[170px] truncate"
              aria-label="Filter by pharmaceutical manufacturer"
            >
              <option value="ALL">🏢 All Companies ({distinctCompanies.length})</option>
              {distinctCompanies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Balance Status Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              aria-label="Filter suppliers by payment balance"
            >
              <option value="ALL">All Accounts ({suppliers.length})</option>
              <option value="DUE">Pending Dues Only ({stats.withBalanceCount})</option>
              <option value="CLEARED">Nil / Cleared Only ({stats.clearedCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Suppliers Directory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-o-link" />
            Suppliers & Distributors Directory ({filteredSuppliers.length})
          </span>
          <div className="text-xs text-slate-600 font-semibold">
            Total Payable: <b className="text-red-600 text-sm ml-1 font-mono">{fmt(stats.totalPayable)}</b>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 text-left">Supplier & Company</th>
                <th className="p-3 text-left">Contact Info</th>
                <th className="p-3 text-center">Purchase Bills</th>
                <th className="p-3 text-right">Total Purchases</th>
                <th className="p-3 text-right">Total Paid</th>
                <th className="p-3 text-center">Payable Balance</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((s) => {
                const badgeColor = getCompanyBadgeColor(s.company)
                const initials = getInitials(s.name)

                return (
                  <tr key={s.id} className={`hover:bg-slate-50 transition ${s.outstanding > 0 ? 'bg-red-50/20' : ''}`}>
                    {/* Supplier Name & Company */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-o-tint text-o-link border border-o-line flex items-center justify-center font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{s.name}</div>
                          {s.company ? (
                            <span className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                              {s.company}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">General Vendor</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact Phone & Address */}
                    <td className="p-3">
                      {s.phone ? (
                        <div className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{s.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No phone</span>
                      )}
                      {s.address && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-xs">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{s.address}</span>
                        </div>
                      )}
                    </td>

                    {/* Invoices Count */}
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {s.invoiceCount} bills
                      </span>
                    </td>

                    {/* Total Purchases */}
                    <td className="p-3 text-right font-mono font-bold text-slate-800">
                      {fmt(s.totalPurchases)}
                    </td>

                    {/* Total Paid */}
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      {fmt(s.totalPaid)}
                    </td>

                    {/* Balance Status */}
                    <td className="p-3 text-center">
                      {s.outstanding > 0 ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-300 font-mono">
                          Due: {fmt(s.outstanding)}
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Cleared
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPayFor(s)}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          title="Record payment to this supplier"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalSupplier(s)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Edit supplier profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete supplier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!filteredSuppliers.length && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <div className="font-bold text-slate-600">No Suppliers Found</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Register pharmaceutical distributors or search with different keywords.
                    </div>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setModalSupplier({})}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-o-blue hover:bg-o-blue-d rounded-lg shadow-sm cursor-pointer"
                      >
                        + Register New Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modals */}
      {modalSupplier && (
        <SupplierFormModal
          supplier={modalSupplier}
          distinctCompanies={distinctCompanies}
          onClose={() => setModalSupplier(null)}
          onSave={(data) => {
            if (modalSupplier.id) {
              updateSupplier(modalSupplier.id, data)
            } else {
              addSupplier(data)
            }
            setModalSupplier(null)
          }}
        />
      )}

      {payFor && (
        <SupplierPayModal
          supplier={payFor}
          onClose={() => setPayFor(null)}
          onConfirm={(amt) => {
            paySupplier(payFor.id, amt)
            setPayFor(null)
          }}
        />
      )}
    </div>
  )
}

function SupplierFormModal({ supplier, distinctCompanies, onSave, onClose }) {
  const isEdit = Boolean(supplier.id)
  const [name, setName] = useState(supplier.name || '')
  const [company, setCompany] = useState(supplier.company || '')
  const [phone, setPhone] = useState(supplier.phone || '')
  const [email, setEmail] = useState(supplier.email || '')
  const [address, setAddress] = useState(supplier.address || '')
  const [balance, setBalance] = useState(supplier.balance !== undefined ? String(supplier.balance) : '0')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Please enter supplier name.')
      return
    }

    onSave({
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      balance: Number(balance) || 0,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-2xl border border-slate-200 space-y-4 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-o-tint text-o-link flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isEdit ? 'Edit Supplier Profile' : 'Register New Supplier'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Enter vendor contact and distributor details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supplier / Contact Person Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tariq Traders, Shahzeb Khan..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-o-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pharma Manufacturer / Company Name
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. GSK Pakistan, Getz Pharma, Abbott..."
              list="company-options"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-o-blue focus:outline-none"
            />
            <datalist id="company-options">
              {distinctCompanies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone / WhatsApp Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-o-blue focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supplier@pharma.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-o-blue focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Address / City
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Circular Road, Lahore"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-o-blue focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Opening Balance (Payable Due)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-o-blue focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-xl bg-o-blue hover:bg-o-blue-d active:bg-o-blue-d border border-o-blue-d text-white font-bold shadow-sm transition-all cursor-pointer"
            >
              {isEdit ? 'Save Changes' : 'Register Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SupplierPayModal({ supplier, onConfirm, onClose }) {
  const currentDue = Math.max(0, supplier.balance || 0)
  const [amount, setAmount] = useState(String(currentDue))
  const [payMethod, setPayMethod] = useState('CASH')

  const handlePay = (e) => {
    e.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) {
      alert('Please enter a valid payment amount.')
      return
    }

    onConfirm(num)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl border border-slate-200 space-y-4 text-xs font-sans">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Record Supplier Payment
              </h3>
              <p className="text-[11px] text-slate-400">
                Settling dues for {supplier.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Due Summary Card */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
          <div>
            <div className="text-[11px] text-slate-500 font-semibold">Current Payable Due</div>
            <div className="text-lg font-black text-rose-600 font-mono mt-0.5">
              {fmt(currentDue)}
            </div>
          </div>
          {currentDue > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(currentDue))}
              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
            >
              Pay Full Due
            </button>
          )}
        </div>

        <form onSubmit={handlePay} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Amount (Rs.) *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-o-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Mode
            </label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-o-blue focus:outline-none"
            >
              <option value="CASH">💵 Cash Drawer</option>
              <option value="BANK">🏛️ Bank Transfer / Online</option>
              <option value="CHEQUE">📜 Bank Cheque</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold shadow-sm transition-all cursor-pointer"
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Suppliers
