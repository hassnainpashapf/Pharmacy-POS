import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  useDB,
  savePurchase,
  fmt,
  medicineById,
  supplierById,
  todayStr,
  purchaseOrders,
  savePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  purchaseReturns,
  savePurchaseReturn,
  deletePurchaseReturn,
} from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from '../components/DateFilterBar'
import { Modal, Input } from './Medicines'
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Printer,
  Send,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
  Phone,
  FileSpreadsheet,
  ArrowRight,
  ClipboardCheck,
  TrendingUp,
  AlertCircle,
  Package,
  RotateCcw,
  DollarSign,
  AlertTriangle,
  Receipt,
  FileText,
} from 'lucide-react'

export function PurchaseReturnsPage() {
  return <Purchases forcedTab="returns" />
}

export default function Purchases({ forcedTab }) {
  const db = useDB()
  const location = useLocation()
  const navigate = useNavigate()

  const computeTab = () => {
    if (forcedTab) return forcedTab
    if (location.pathname === '/purchase-returns') return 'returns'
    const params = new URLSearchParams(location.search)
    const t = params.get('tab')
    if (t === 'orders' || t === 'invoices' || t === 'returns') {
      return t
    }
    return 'orders'
  }

  // Tabs: 'orders' (Parches Orders) | 'invoices' (Inward Invoices & Supplier Dues) | 'returns' (Purchase Returns)
  const [tab, setTab] = useState(computeTab)
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [showNewPO, setShowNewPO] = useState(false)
  const [showNewReturn, setShowNewReturn] = useState(false)
  const [viewingPO, setViewingPO] = useState(null)
  const [receivingPO, setReceivingPO] = useState(null)
  const [viewingReturn, setViewingReturn] = useState(null)
  const [viewingGRN, setViewingGRN] = useState(null)

  // Sync tab with URL search params or path
  useEffect(() => {
    setTab(computeTab())
  }, [location.search, location.pathname, forcedTab])

  const setTabAndUrl = (newTab) => {
    setTab(newTab)
    if (newTab === 'returns') {
      navigate('/purchase-returns', { replace: true })
    } else {
      navigate(`/purchases?tab=${newTab}`, { replace: true })
    }
  }

  // Supplier-wise outstanding report
  const supReport = useMemo(() => {
    return (db.suppliers || []).map((s) => {
      const purchases = (db.purchases || []).filter((p) => p.supplierId === s.id)
      const totalPurchases = purchases.reduce((a, p) => a + (p.total || 0), 0)
      const totalPaid = purchases.reduce((a, p) => a + (p.paid || 0), 0)
      const invoices = purchases.length
      const lastDate = purchases.map((p) => p.date).sort().slice(-1)[0]
      return { ...s, totalPurchases, totalPaid, invoices, lastDate, outstanding: Math.max(0, s.balance || 0) }
    }).sort((a, b) => b.outstanding - a.outstanding)
  }, [db.suppliers, db.purchases])

  const totalOutstanding = useMemo(() => {
    return supReport.reduce((a, s) => a + s.outstanding, 0)
  }, [supReport])

  // Invoices & Purchases aggregate KPIs
  const invoiceStats = useMemo(() => {
    const list = db.purchases || []
    const totalInvoices = list.length
    const totalPurchases = list.reduce((a, p) => a + (p.total || 0), 0)
    const totalPaid = list.reduce((a, p) => a + (p.paid || 0), 0)
    const totalDue = totalOutstanding
    const totalSuppliers = (db.suppliers || []).length
    return { totalInvoices, totalPurchases, totalPaid, totalDue, totalSuppliers }
  }, [db.purchases, db.suppliers, totalOutstanding])

  // Purchase Orders Data & Filters
  const [poSearch, setPoSearch] = useState('')
  const [poStatusFilter, setPoStatusFilter] = useState('ALL') // ALL | DRAFT | SENT | RECEIVED | CANCELLED
  const [poDateFilter, setPoDateFilter] = useDateFilterState('all')

  const allPOs = purchaseOrders()

  const filteredPOs = useMemo(() => {
    return allPOs.filter((po) => {
      const matchDate = matchesDateFilter(po.createdAt || po.date, poDateFilter)
      const matchStatus = poStatusFilter === 'ALL' || po.status === poStatusFilter
      const sup = supplierById(po.supplierId)
      const q = poSearch.toLowerCase().trim()
      const matchSearch =
        !q ||
        po.poNo?.toLowerCase().includes(q) ||
        sup?.name?.toLowerCase().includes(q) ||
        sup?.company?.toLowerCase().includes(q) ||
        po.items?.some((it) => it.name?.toLowerCase().includes(q))
      return matchDate && matchStatus && matchSearch
    })
  }, [allPOs, poDateFilter, poStatusFilter, poSearch])

  // PO KPIs
  const poStats = useMemo(() => {
    const total = allPOs.length
    const draft = allPOs.filter((p) => p.status === 'DRAFT').length
    const sent = allPOs.filter((p) => p.status === 'SENT').length
    const received = allPOs.filter((p) => p.status === 'RECEIVED').length
    const totalValue = allPOs.reduce((s, p) => s + (p.totalEstimatedCost || 0), 0)
    return { total, draft, sent, received, totalValue }
  }, [allPOs])

  // Inward Purchases & GRN Filters
  const [grnSearch, setGrnSearch] = useState('')
  const [grnStatusFilter, setGrnStatusFilter] = useState('ALL') // 'ALL' | 'PAID' | 'DUE'
  const [grnDateFilter, setGrnDateFilter] = useDateFilterState('all')

  const filteredPurchases = useMemo(() => {
    return (db.purchases || []).filter((p) => {
      const matchDate = matchesDateFilter(p.date, grnDateFilter)
      const due = p.due !== undefined ? p.due : (p.total - (p.paid || 0))
      const matchStatus =
        grnStatusFilter === 'ALL' ||
        (grnStatusFilter === 'PAID' && due <= 0) ||
        (grnStatusFilter === 'DUE' && due > 0)
      const sup = supplierById(p.supplierId)
      const q = grnSearch.toLowerCase().trim()
      const matchSearch =
        !q ||
        p.grnNo?.toLowerCase().includes(q) ||
        p.invoiceNo?.toLowerCase().includes(q) ||
        sup?.name?.toLowerCase().includes(q) ||
        (p.items || []).some((it) => it.name?.toLowerCase().includes(q) || it.batchNo?.toLowerCase().includes(q))
      return matchDate && matchStatus && matchSearch
    })
  }, [db.purchases, grnDateFilter, grnStatusFilter, grnSearch])

  // Purchase Returns Data & Filters
  const [returnSearch, setReturnSearch] = useState('')
  const [returnReasonFilter, setReturnReasonFilter] = useState('ALL')
  const [returnDateFilter, setReturnDateFilter] = useDateFilterState('all')

  const allReturns = purchaseReturns()

  const filteredReturns = useMemo(() => {
    return allReturns.filter((pr) => {
      const matchDate = matchesDateFilter(pr.date || pr.createdAt, returnDateFilter)
      const sup = supplierById(pr.supplierId)
      const q = returnSearch.toLowerCase().trim()
      const matchSearch =
        !q ||
        pr.returnNo?.toLowerCase().includes(q) ||
        sup?.name?.toLowerCase().includes(q) ||
        sup?.company?.toLowerCase().includes(q) ||
        pr.items?.some((it) => it.medicineName?.toLowerCase().includes(q) || it.batchNo?.toLowerCase().includes(q))

      const matchReason =
        returnReasonFilter === 'ALL' ||
        pr.items?.some((it) => it.reason === returnReasonFilter)

      return matchDate && matchSearch && matchReason
    })
  }, [allReturns, returnDateFilter, returnSearch, returnReasonFilter])

  // Returns KPIs
  const returnStats = useMemo(() => {
    const total = allReturns.length
    const totalUnits = allReturns.reduce((acc, r) => acc + (r.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0), 0)
    const totalValue = allReturns.reduce((acc, r) => acc + (r.totalAmount || 0), 0)
    const creditNotes = allReturns.filter((r) => r.settlementType === 'CREDIT_NOTE').length
    const cashRefunds = allReturns.filter((r) => r.settlementType === 'CASH_REFUND').length
    return { total, totalUnits, totalValue, creditNotes, cashRefunds }
  }, [allReturns])

  const handleReceivePO = (po) => {
    setReceivingPO(po)
    setShowNewPurchase(true)
  }

  return (
    <div className="space-y-6 w-full pb-16 font-sans text-slate-800">
      {/* 1. Header Banner (Merged into page layout matching Company Stock Hub) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#3b1734] text-white flex items-center justify-center font-black shadow-sm border border-[#280c23] shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Purchases & Invoices
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Purchase orders, inward stock bills (GRN), and supplier returns
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
            onClick={() => navigate('/stock-audit')}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
            title="Stock audit worksheet for physical counting and auto PO generation"
          >
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
            <span>Stock Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewPO(true)}
            className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ New PO</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReceivingPO(null)
              setShowNewPurchase(true)
            }}
            className="bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ New GRN</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewReturn(true)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold shadow-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>+ New Return</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation Switcher */}
      <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-xl w-fit border border-slate-200/60">
        <button
          type="button"
          onClick={() => setTabAndUrl('orders')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            tab === 'orders'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-[#714B67]" />
          <span>Purchase Orders</span>
          <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-[#f5eef4] text-[#714B67]">
            {allPOs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabAndUrl('invoices')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            tab === 'invoices'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-emerald-600" />
          <span>Bills & GRN</span>
          <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-100 text-emerald-700">
            {(db.purchases || []).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabAndUrl('returns')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            tab === 'returns'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
          <span>Purchase Returns</span>
          <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-purple-100 text-purple-700">
            {allReturns.length}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PURCHASE ORDERS (PARCHES ORDERS)                   */}
      {/* ======================================================== */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Top KPIs Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Orders */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Total POs</span>
                <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{poStats.total}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">All created POs</div>
              </div>
            </div>

            {/* Draft */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Draft / Pending</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{poStats.draft}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Pending dispatch</div>
              </div>
            </div>

            {/* Sent to Supplier */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Sent to Vendor</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{poStats.sent}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Awaiting distributor</div>
              </div>
            </div>

            {/* Received & Stocked */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Received & Stocked</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-emerald-700">{poStats.received}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Batches in inventory</div>
              </div>
            </div>

            {/* Estimated Value */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Demand Value</span>
                <div className="w-8 h-8 rounded-lg bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-[#008f8b]">{fmt(poStats.totalValue)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Total demand cost</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search PO #, supplier name, company, or medicine..."
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#714B67]"
                />
              </div>

              {/* Date Filter Dropdown */}
              <DateFilterBar filterState={poDateFilter} onChange={setPoDateFilter} asDropdown />

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={poStatusFilter}
                  onChange={(e) => setPoStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  aria-label="Filter Purchase Orders by status"
                >
                  <option value="ALL">All POs ({allPOs.length})</option>
                  <option value="DRAFT">Draft ({poStats.draft})</option>
                  <option value="SENT">Sent ({poStats.sent})</option>
                  <option value="RECEIVED">Received ({poStats.received})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Purchase Orders List ({filteredPOs.length})
              </span>
              <span className="text-xs text-slate-500">
                Sorted by most recent order
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left">PO #</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Supplier / Distributor</th>
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-left">Items Ordered</th>
                    <th className="p-3 text-right">Est. Cost</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPOs.map((po) => {
                    const sup = supplierById(po.supplierId)
                    const totalQty = (po.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0)
                    const isAuditSource = po.source === 'AUDIT'

                    return (
                      <tr key={po.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-blue-700">
                          {po.poNo}
                        </td>
                        <td className="p-3 text-slate-600">
                          {po.date || todayStr()}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{sup?.name || 'Direct / General Supplier'}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {sup?.company && <span>{sup.company}</span>}
                            {sup?.phone && (
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <Phone className="w-3 h-3" /> {sup.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          {isAuditSource ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                              <ClipboardCheck className="w-3 h-3" /> Stock Audit (Kam Stock)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Manual Order
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">
                            {po.items?.length || 0} items ({totalQty} units)
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {po.items?.map((it) => `${it.name} (x${it.qty})`).join(', ')}
                          </div>
                        </td>
                        <td className="p-3 text-right font-black text-slate-800">
                          {fmt(po.totalEstimatedCost)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                              po.status === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : po.status === 'SENT'
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : po.status === 'CANCELLED'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {po.status || 'DRAFT'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* View / Print / WhatsApp Slip */}
                            <button
                              onClick={() => setViewingPO(po)}
                              title="View, Print slip, or send to supplier via WhatsApp"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Inward / Receive into Inventory Batches */}
                            {po.status !== 'RECEIVED' && (
                              <button
                                onClick={() => handleReceivePO(po)}
                                title="Convert PO into GRN (Receive batches into inventory)"
                                className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition flex items-center gap-1"
                              >
                                <Package className="w-3.5 h-3.5" />
                                Receive GRN
                              </button>
                            )}

                            {/* Status Quick Toggle */}
                            {po.status === 'DRAFT' && (
                              <button
                                onClick={() => updatePurchaseOrderStatus(po.id, 'SENT')}
                                title="Mark as SENT to supplier"
                                className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition"
                              >
                                Mark Sent
                              </button>
                            )}

                            {/* Delete PO */}
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete purchase order ${po.poNo}?`)) {
                                  deletePurchaseOrder(po.id)
                                }
                              }}
                              title="Delete Purchase Order"
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {!filteredPOs.length && (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <div className="font-bold text-slate-600">No Purchase Orders Found</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Create a new purchase order or auto-generate one for shortages from the Stock Audit worksheet.
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <button
                            onClick={() => setShowNewPO(true)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] rounded-lg shadow-sm cursor-pointer"
                          >
                            + Create Manual PO
                          </button>
                          <button
                            onClick={() => navigate('/stock-audit')}
                            className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg"
                          >
                            📋 Run Stock Audit & Count
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: GRN INVOICES & SUPPLIER DUES                      */}
      {/* ======================================================== */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          {/* Top KPIs Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Suppliers */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Suppliers</span>
                <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{invoiceStats.totalSuppliers}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Registered vendors</div>
              </div>
            </div>

            {/* Total Invoices */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Inward Invoices</span>
                <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{invoiceStats.totalInvoices}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">GRN stock entries</div>
              </div>
            </div>

            {/* Total Purchases */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Total Purchases</span>
                <div className="w-8 h-8 rounded-lg bg-[#f5eef4] text-[#714B67] flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{fmt(invoiceStats.totalPurchases)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Cumulative inward cost</div>
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
                <div className="text-2xl font-black text-emerald-700">{fmt(invoiceStats.totalPaid)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Cleared payments</div>
              </div>
            </div>

            {/* Outstanding Due */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Balance Due</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${invoiceStats.totalDue > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className={`text-2xl font-black ${invoiceStats.totalDue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{fmt(invoiceStats.totalDue)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Payable to suppliers</div>
              </div>
            </div>
          </div>

          {/* Supplier-wise Outstanding Balance Report */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                🏢 Supplier-wise Outstanding Balance
              </h3>
              <div className="text-xs">
                Total Payable: <b className="text-red-600 text-sm ml-1">{fmt(totalOutstanding)}</b>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-left">Supplier</th>
                    <th>Company</th>
                    <th>Phone</th>
                    <th>Invoices</th>
                    <th>Total Purchases</th>
                    <th>Total Paid</th>
                    <th>Outstanding Due</th>
                    <th>Last Purchase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supReport.map((s) => (
                    <tr key={s.id} className={`text-center ${s.outstanding > 0 ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                      <td className="p-2.5 text-left font-bold text-slate-800">{s.name}</td>
                      <td>{s.company || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td>{s.invoices}</td>
                      <td>{fmt(s.totalPurchases)}</td>
                      <td className="text-emerald-700 font-semibold">{fmt(s.totalPaid)}</td>
                      <td className={s.outstanding > 0 ? 'text-red-600 font-black' : 'text-emerald-600 font-semibold'}>
                        {fmt(s.outstanding)}
                      </td>
                      <td className="text-[11px] text-slate-500">{s.lastDate || '—'}</td>
                    </tr>
                  ))}
                  {!supReport.length && (
                    <tr>
                      <td colSpan="8" className="p-4 text-center text-slate-400">
                        No suppliers registered yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search GRN #, invoice #, supplier, or medicine..."
                  value={grnSearch}
                  onChange={(e) => setGrnSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#714B67]"
                />
              </div>

              {/* Date Filter Dropdown */}
              <DateFilterBar filterState={grnDateFilter} onChange={setGrnDateFilter} asDropdown />

              {/* Status Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={grnStatusFilter}
                  onChange={(e) => setGrnStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  aria-label="Filter Invoices by payment status"
                >
                  <option value="ALL">All Bills ({(db.purchases || []).length})</option>
                  <option value="PAID">Paid Only</option>
                  <option value="DUE">Balance Due Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Inward Purchases & GRN Invoices Ledger */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Goods Received Notes (GRN) & Invoices ({filteredPurchases.length})
              </span>
              <button
                onClick={() => {
                  setReceivingPO(null)
                  setShowNewPurchase(true)
                }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                + Add GRN / Inward Stock
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-left">Date</th>
                    <th className="p-2.5 text-left">GRN #</th>
                    <th className="p-2.5 text-left">Invoice / Challan</th>
                    <th className="p-2.5 text-left">Supplier</th>
                    <th className="p-2.5 text-center">Items</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                    <th className="p-2.5 text-right">Discount</th>
                    <th className="p-2.5 text-right">GST & Tax</th>
                    <th className="p-2.5 text-right">Net Total</th>
                    <th className="p-2.5 text-right">Paid Advance</th>
                    <th className="p-2.5 text-right">Balance Due</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...filteredPurchases].reverse().map((p) => {
                    const sup = supplierById(p.supplierId)
                    const taxes = (Number(p.gstAmount) || 0) + (Number(p.advanceTaxAmount) || 0) + (Number(p.otherTax) || 0)
                    const due = p.due !== undefined ? p.due : (p.total - (p.paid || 0))
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition text-center">
                        <td className="p-2.5 text-left text-slate-600">{p.date}</td>
                        <td className="p-2.5 text-left font-mono font-bold text-blue-700">{p.grnNo || '—'}</td>
                        <td className="p-2.5 text-left font-mono text-slate-800 font-semibold">{p.invoiceNo}</td>
                        <td className="p-2.5 text-left font-semibold text-slate-700">{sup?.name || '—'}</td>
                        <td className="p-2.5">{p.items?.length || 0}</td>
                        <td className="p-2.5 text-right text-slate-600 font-mono">{fmt(p.subtotal || p.total)}</td>
                        <td className="p-2.5 text-right text-amber-700 font-mono font-semibold">
                          {p.discountAmount ? `-${fmt(p.discountAmount)}` : '—'}
                        </td>
                        <td className="p-2.5 text-right text-purple-700 font-mono">
                          {taxes > 0 ? `+${fmt(taxes)}` : '—'}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900 font-mono">{fmt(p.total)}</td>
                        <td className="p-2.5 text-right text-emerald-700 font-bold font-mono">{fmt(p.paid || 0)}</td>
                        <td className={`p-2.5 text-right font-bold font-mono ${due > 0 ? 'text-red-600 font-black' : 'text-slate-400'}`}>
                          {fmt(due)}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => setViewingGRN(p)}
                            title="View / Print GRN Voucher"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!db.purchases.length && (
                    <tr>
                      <td colSpan="12" className="p-6 text-center text-slate-400">
                        No GRN / purchase records logged yet. Click "+ Add GRN / Inward Stock" to register your first delivery.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PURCHASE RETURNS & DEBIT NOTES                     */}
      {/* ======================================================== */}
      {tab === 'returns' && (
        <div className="space-y-4">
          {/* Top KPIs Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Vouchers */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Return Vouchers</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{returnStats.total}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Dispatched to suppliers</div>
              </div>
            </div>

            {/* Returned Units */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Returned Units</span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{returnStats.totalUnits}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Total units deducted</div>
              </div>
            </div>

            {/* Claimed Value */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Claimed Value</span>
                <div className="w-8 h-8 rounded-lg bg-[#e6f7f2] text-[#008f8b] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-[#008f8b]">{fmt(returnStats.totalValue)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Financial recovery</div>
              </div>
            </div>

            {/* Debit Notes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Debit Notes</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{returnStats.creditNotes}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Balance adjusted</div>
              </div>
            </div>

            {/* Cash Refunds */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Cash Refunds</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">{returnStats.cashRefunds}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Instant refunds</div>
              </div>
            </div>
          </div>

          {/* Search & Reason Filter Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search PR #, supplier, company, medicine, or batch..."
                  value={returnSearch}
                  onChange={(e) => setReturnSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#714B67]"
                />
              </div>

              {/* Date Filter Dropdown */}
              <DateFilterBar filterState={returnDateFilter} onChange={setReturnDateFilter} asDropdown />

              {/* Reason Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={returnReasonFilter}
                  onChange={(e) => setReturnReasonFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  aria-label="Filter Returns by reason"
                >
                  <option value="ALL">All Reasons ({allReturns.length})</option>
                  <option value="EXPIRED">⏰ Expired</option>
                  <option value="NEAR_EXPIRY">⌛ Near Expiry</option>
                  <option value="DAMAGED">💥 Damaged</option>
                  <option value="WRONG_ITEM">❌ Wrong Item</option>
                  <option value="OVER_STOCKED">📦 Excess</option>
                </select>
              </div>
            </div>
          </div>

          {/* Purchase Returns Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Purchase Returns & Debit Notes ({filteredReturns.length})
              </span>
              <button
                onClick={() => setShowNewReturn(true)}
                className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                + Create Return
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left">Return #</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Supplier / Distributor</th>
                    <th className="p-3 text-left">Returned Items</th>
                    <th className="p-3 text-left">Reasons</th>
                    <th className="p-3 text-right">Claim Amount</th>
                    <th className="p-3 text-center">Settlement Mode</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReturns.map((pr) => {
                    const sup = supplierById(pr.supplierId)
                    const totalUnits = (pr.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0), 0)

                    return (
                      <tr key={pr.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-purple-700">
                          {pr.returnNo}
                        </td>
                        <td className="p-3 text-slate-600">
                          {pr.date || todayStr()}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{sup?.name || pr.supplierName || 'General Supplier'}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {(sup?.company || pr.supplierCompany) && <span>{sup?.company || pr.supplierCompany}</span>}
                            {sup?.phone && (
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <Phone className="w-3 h-3" /> {sup.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">
                            {pr.items?.length || 0} items ({totalUnits} units)
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {pr.items?.map((it) => `${it.medicineName || 'Item'} (x${it.qty})`).join(', ')}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(new Set(pr.items?.map((it) => it.reason))).map((r) => (
                              <span
                                key={r}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r === 'EXPIRED'
                                    ? 'bg-red-100 text-red-800'
                                    : r === 'NEAR_EXPIRY'
                                    ? 'bg-amber-100 text-amber-800'
                                    : r === 'DAMAGED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : r === 'WRONG_ITEM'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {r === 'EXPIRED' ? '⏰ Expired' :
                                 r === 'NEAR_EXPIRY' ? '⌛ Near Expiry' :
                                 r === 'DAMAGED' ? '💥 Damaged' :
                                 r === 'WRONG_ITEM' ? '❌ Wrong Item' :
                                 r === 'OVER_STOCKED' ? '📦 Excess' : r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          {fmt(pr.totalAmount)}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                              pr.settlementType === 'CREDIT_NOTE'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {pr.settlementType === 'CREDIT_NOTE' ? '💳 Debit Note' : '💵 Cash Refund'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* View / Print / WhatsApp Voucher */}
                            <button
                              onClick={() => setViewingReturn(pr)}
                              title="View, Print Debit Note, or send to supplier via WhatsApp"
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Revert / Delete Return */}
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to revert return ${pr.returnNo}? This will restock the returned items back into inventory and revert the financial settlement.`)) {
                                  deletePurchaseReturn(pr.id)
                                }
                              }}
                              title="Revert Return (Restores stock & balance)"
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {!filteredReturns.length && (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        <RotateCcw className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <div className="font-bold text-slate-600">No Purchase Returns Logged</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Expiry, damage ya excess stock distributors ko wapis karne ke liye "New Purchase Return" dabayein.
                        </div>
                        <div className="mt-4">
                          <button
                            onClick={() => setShowNewReturn(true)}
                            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                          >
                            + Create Purchase Return
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: NEW GRN PURCHASE INWARD (GOODS RECEIVED NOTE)   */}
      {/* ======================================================== */}
      {showNewPurchase && (
        <PurchaseForm
          initialPO={receivingPO}
          onClose={() => {
            setShowNewPurchase(false)
            setReceivingPO(null)
          }}
          onSaved={(newGRN) => {
            setShowNewPurchase(false)
            setReceivingPO(null)
            setViewingGRN(newGRN)
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 2: VIEW / PRINT / WHATSAPP GRN VOUCHER             */}
      {/* ======================================================== */}
      {viewingGRN && (
        <GRNDetailModal
          grn={viewingGRN}
          onClose={() => setViewingGRN(null)}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CREATE NEW PURCHASE ORDER (PO / PARCHES ORDER)  */}
      {/* ======================================================== */}
      {showNewPO && (
        <NewPOModal
          onClose={() => setShowNewPO(false)}
          onCreated={(newPO) => {
            setShowNewPO(false)
            setViewingPO(newPO)
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 4: VIEW / PRINT / WHATSAPP PURCHASE ORDER SLIP     */}
      {/* ======================================================== */}
      {viewingPO && (
        <PODetailModal
          po={viewingPO}
          onClose={() => setViewingPO(null)}
          onReceive={(po) => {
            setViewingPO(null)
            handleReceivePO(po)
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 5: CREATE NEW PURCHASE RETURN                      */}
      {/* ======================================================== */}
      {showNewReturn && (
        <NewPurchaseReturnModal
          onClose={() => setShowNewReturn(false)}
          onCreated={(newReturn) => {
            setShowNewReturn(false)
            setViewingReturn(newReturn)
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 6: VIEW / PRINT / WHATSAPP DEBIT NOTE VOUCHER      */}
      {/* ======================================================== */}
      {viewingReturn && (
        <PurchaseReturnSlipModal
          pr={viewingReturn}
          onClose={() => setViewingReturn(null)}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------------
// FORM COMPONENT: GOODS RECEIVED NOTE (GRN) / PURCHASE INWARD
// With GST, Advance Tax, Other Tax, Discount (Desiccant), Batch & Expiry
// ----------------------------------------------------------------------
function PurchaseForm({ initialPO, onClose, onSaved }) {
  const db = useDB()

  // Header Details
  const [grnNo, setGrnNo] = useState(() => 'GRN-' + String((db.purchases?.length || 0) + 1).padStart(4, '0'))
  const [supplierId, setSupplierId] = useState(
    initialPO?.supplierId || db.suppliers[0]?.id || ''
  )
  const [invoiceNo, setInvoiceNo] = useState(
    initialPO ? `INV-${initialPO.poNo.replace('PO-', '')}` : ''
  )
  const [date, setDate] = useState(todayStr())

  // Line item entry states
  const [mid, setMid] = useState('')
  const [lineBatchNo, setLineBatchNo] = useState(`B-${todayStr().replace(/-/g, '').slice(2)}`)
  const [lineExpiry, setLineExpiry] = useState(new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10))
  const [lineQty, setLineQty] = useState(10)
  const [lineBonus, setLineBonus] = useState(0) // Free bonus units
  const [linePPrice, setLinePPrice] = useState(0)
  const [lineSPrice, setLineSPrice] = useState(0)

  // Initialize items from initialPO if available
  const [items, setItems] = useState(() => {
    if (initialPO?.items && initialPO.items.length > 0) {
      return initialPO.items.map((it, idx) => {
        const m = medicineById(it.medicineId)
        const pPrice = Number(it.purchasePrice) || (m ? Math.round(m.salePrice * 0.75) : 0)
        const sPrice = Number(it.salePrice) || (m ? m.salePrice : 0)
        return {
          medicineId: it.medicineId,
          medicineName: it.name || (m ? `${m.name} ${m.strength || ''}` : 'Medicine'),
          batchNo: `B-${todayStr().replace(/-/g, '').slice(2)}-${idx + 1}`,
          expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          qty: Number(it.qty) || 1,
          bonusQty: 0,
          purchasePrice: pPrice,
          salePrice: sPrice,
          lineTotal: (Number(it.qty) || 1) * pPrice,
        }
      })
    }
    return []
  })

  // When medicine selection changes, prefill prices
  useEffect(() => {
    if (mid) {
      const m = medicineById(mid)
      if (m) {
        setLinePPrice(m.purchasePrice || Math.round(m.salePrice * 0.75))
        setLineSPrice(m.salePrice || 0)
      }
    }
  }, [mid])

  // Financial Taxes & Discount States
  const [discountPct, setDiscountPct] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [gstPct, setGstPct] = useState(0)
  const [gstAmount, setGstAmount] = useState(0)
  const [advanceTaxPct, setAdvanceTaxPct] = useState(0)
  const [advanceTaxAmount, setAdvanceTaxAmount] = useState(0)
  const [otherTax, setOtherTax] = useState(0)
  const [paid, setPaid] = useState(0)
  const [note, setNote] = useState(initialPO ? `Inwarded from ${initialPO.poNo}` : '')

  // Calculate gross subtotal from items
  const subtotal = useMemo(() => {
    return items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0)
  }, [items])

  // Handle Discount % change -> updates discountAmount
  const handleDiscountPctChange = (pct) => {
    const p = Math.max(0, Number(pct) || 0)
    setDiscountPct(p)
    setDiscountAmount(Math.round((subtotal * p) / 100))
  }

  // Handle Discount Amount change -> updates discountPct
  const handleDiscountAmountChange = (amt) => {
    const a = Math.max(0, Number(amt) || 0)
    setDiscountAmount(a)
    setDiscountPct(subtotal > 0 ? parseFloat(((a / subtotal) * 100).toFixed(2)) : 0)
  }

  // Handle GST % change -> updates gstAmount
  const handleGstPctChange = (pct) => {
    const p = Math.max(0, Number(pct) || 0)
    setGstPct(p)
    const base = Math.max(0, subtotal - discountAmount)
    setGstAmount(Math.round((base * p) / 100))
  }

  // Handle Advance Tax % change -> updates advanceTaxAmount
  const handleAdvanceTaxPctChange = (pct) => {
    const p = Math.max(0, Number(pct) || 0)
    setAdvanceTaxPct(p)
    const base = Math.max(0, subtotal - discountAmount)
    setAdvanceTaxAmount(Math.round((base * p) / 100))
  }

  // Recalculate taxes when subtotal or discount changes
  useEffect(() => {
    if (discountPct > 0) {
      setDiscountAmount(Math.round((subtotal * discountPct) / 100))
    }
  }, [subtotal, discountPct])

  useEffect(() => {
    const base = Math.max(0, subtotal - discountAmount)
    if (gstPct > 0) {
      setGstAmount(Math.round((base * gstPct) / 100))
    }
    if (advanceTaxPct > 0) {
      setAdvanceTaxAmount(Math.round((base * advanceTaxPct) / 100))
    }
  }, [subtotal, discountAmount, gstPct, advanceTaxPct])

  // Net Grand Total
  const netTotal = useMemo(() => {
    return Math.max(0, subtotal - (Number(discountAmount) || 0) + (Number(gstAmount) || 0) + (Number(advanceTaxAmount) || 0) + (Number(otherTax) || 0))
  }, [subtotal, discountAmount, gstAmount, advanceTaxAmount, otherTax])

  // Remaining Due Balance
  const remainingDue = useMemo(() => {
    return netTotal - (Number(paid) || 0)
  }, [netTotal, paid])

  function addItem() {
    const m = medicineById(mid)
    if (!m) return
    const q = Number(lineQty) || 0
    if (q <= 0) {
      alert('Quantity 0 se zyada honi chahiye.')
      return
    }
    if (!lineBatchNo.trim()) {
      alert('Batch Number zaroori hai.')
      return
    }
    if (!lineExpiry) {
      alert('Expiry Date zaroori hai.')
      return
    }

    const pPrice = Number(linePPrice) || 0
    const sPrice = Number(lineSPrice) || 0

    setItems((prev) => [
      ...prev,
      {
        medicineId: m.id,
        medicineName: `${m.name} ${m.strength || ''}`,
        batchNo: lineBatchNo.trim(),
        expiry: lineExpiry,
        qty: q,
        bonusQty: Number(lineBonus) || 0,
        purchasePrice: pPrice,
        salePrice: sPrice,
        lineTotal: q * pPrice,
      },
    ])

    // Reset line fields for next item
    setMid('')
    setLineQty(10)
    setLineBonus(0)
    setLineBatchNo(`B-${todayStr().replace(/-/g, '').slice(2)}`)
  }

  function save() {
    if (!items.length) return alert('Pehlay kam az kam 1 medicine item add karein.')
    for (const it of items) {
      if (!it.batchNo) return alert('Tamam items ke Batch Number darj karein.')
      if (!it.expiry) return alert('Tamam items ki Expiry Date darj karein.')
      if (Number(it.qty) <= 0) return alert('Item ki quantity 0 se zyada honi chahiye.')
    }

    try {
      const saved = savePurchase({
        supplierId,
        grnNo,
        invoiceNo: invoiceNo || `INV-${Date.now()}`,
        date,
        items,
        subtotal,
        discountPct,
        discountAmount,
        gstPct,
        gstAmount,
        advanceTaxPct,
        advanceTaxAmount,
        otherTax,
        paid,
        note,
      })

      // If this purchase was converted from a Purchase Order, mark PO as RECEIVED
      if (initialPO?.id) {
        updatePurchaseOrderStatus(initialPO.id, 'RECEIVED')
      }

      if (onSaved) {
        onSaved(saved)
      } else {
        onClose()
      }
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <Modal title={initialPO ? `Receive Purchase Order as GRN: ${initialPO.poNo}` : 'New Goods Received Note (GRN)'} onClose={onClose}>
      <div className="space-y-3.5 text-xs max-h-[85vh] overflow-y-auto pr-1">
        {initialPO && (
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <ClipboardCheck className="w-4 h-4 text-blue-600" />
              Inwarding items from Purchase Order <b>{initialPO.poNo}</b>. Batch, Expiry aur Taxes verify kar ke save karein.
            </span>
            <span className="font-bold text-blue-700 uppercase text-[10px] bg-blue-200 px-2 py-0.5 rounded">
              PO Source: {initialPO.source}
            </span>
          </div>
        )}

        {/* Step 1: GRN Header Details */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <label className="font-bold text-slate-700 block mb-1">GRN # (Goods Received Note)</label>
            <input
              type="text"
              value={grnNo}
              onChange={(e) => setGrnNo(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-blue-700 bg-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Supplier Invoice / Challan #</label>
            <input
              type="text"
              placeholder="e.g. INV-9482"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono bg-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Invoice / Receiving Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Supplier / Distributor</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
            >
              {db.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.company ? `(${s.company})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: Add Medicine Line (Batch, Expiry, Billed Qty, Bonus, Cost, MRP) */}
        <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
          <span className="font-bold text-emerald-950 block text-xs">
            Add Medicine with Batch No & Expiry Date
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Medicine Name</label>
              <select
                value={mid}
                onChange={(e) => setMid(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
              >
                <option value="">— Select Medicine —</option>
                {db.medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.strength} ({m.dosageForm || m.form}) · MRP Rs. {m.salePrice}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Batch No</label>
              <input
                type="text"
                placeholder="e.g. B-01"
                value={lineBatchNo}
                onChange={(e) => setLineBatchNo(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-center bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Expiry Date</label>
              <input
                type="date"
                value={lineExpiry}
                onChange={(e) => setLineExpiry(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Billed Qty</label>
              <input
                type="number"
                min="1"
                value={lineQty}
                onChange={(e) => setLineQty(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs text-center font-bold bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Bonus / Free</label>
              <input
                type="number"
                min="0"
                value={lineBonus}
                onChange={(e) => setLineBonus(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs text-center font-bold bg-white text-emerald-700"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Purchase Cost (TP)</label>
              <input
                type="number"
                value={linePPrice}
                onChange={(e) => setLinePPrice(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs text-right font-mono bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Sale MRP</label>
              <input
                type="number"
                value={lineSPrice}
                onChange={(e) => setLineSPrice(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs text-right font-mono bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Line Total</label>
              <div className="py-1.5 px-2 text-center font-black text-slate-800 text-xs">
                {fmt((Number(lineQty) || 0) * (Number(linePPrice) || 0))}
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={addItem}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition text-xs flex items-center justify-center gap-1"
              >
                + Add Line
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2 text-left">Medicine</th>
                <th>Batch #</th>
                <th>Expiry</th>
                <th>Billed Qty</th>
                <th>Bonus</th>
                <th>Cost Rate (TP)</th>
                <th>Sale MRP</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => {
                const set = (k) => (e) =>
                  setItems((prev) =>
                    prev.map((r, i) => {
                      if (i !== idx) return r
                      const updated = { ...r, [k]: e.target.value }
                      if (k === 'qty' || k === 'purchasePrice') {
                        updated.lineTotal = (Number(updated.qty) || 0) * (Number(updated.purchasePrice) || 0)
                      }
                      return updated
                    })
                  )
                return (
                  <tr key={idx} className="text-center hover:bg-slate-50">
                    <td className="p-2 text-left font-bold text-slate-800">{it.medicineName}</td>
                    <td>
                      <input
                        value={it.batchNo}
                        onChange={set('batchNo')}
                        className="border rounded w-20 px-1 py-0.5 text-xs text-center font-mono"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={it.expiry}
                        onChange={set('expiry')}
                        className="border rounded px-1 py-0.5 text-xs"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={set('qty')}
                        className="border rounded w-16 px-1 py-0.5 text-xs text-center font-bold"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={it.bonusQty}
                        onChange={set('bonusQty')}
                        className="border rounded w-14 px-1 py-0.5 text-xs text-center font-bold text-emerald-700"
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={it.purchasePrice}
                        onChange={set('purchasePrice')}
                        className="border rounded w-18 px-1 py-0.5 text-xs text-right font-mono"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={it.salePrice}
                        onChange={set('salePrice')}
                        className="border rounded w-18 px-1 py-0.5 text-xs text-right font-mono"
                      />
                    </td>
                    <td className="font-bold text-slate-800 font-mono">
                      {fmt((Number(it.qty) || 0) * (Number(it.purchasePrice) || 0))}
                    </td>
                    <td>
                      <button
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 px-1 font-bold"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!items.length && (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-slate-400">
                    Koi medicine add nahi hui. Upar form se medicine, batch aur expiry darj kar ke Add Line dabayein.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Step 4: Complete Tax & Discount Engine (GST, Advance Tax, Desiccant, WHT) */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="font-bold text-slate-800 flex items-center justify-between border-b pb-1.5">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Invoice Taxes, Discount & Financials
            </span>
            <span className="text-slate-600">
              Gross Subtotal: <b className="text-slate-900 font-mono text-sm ml-1">{fmt(subtotal)}</b>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* 1. Discount (Desiccant Amount) */}
            <div className="p-2.5 bg-white border border-amber-200 rounded-lg space-y-1">
              <div className="font-bold text-amber-900 flex justify-between">
                <span>Discount</span>
                <span className="text-[10px] text-amber-700 font-mono">{discountPct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-500 block">Disc %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={discountPct}
                    onChange={(e) => handleDiscountPctChange(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">Disc Rs.</label>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => handleDiscountAmountChange(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs text-right font-bold text-amber-800"
                  />
                </div>
              </div>
            </div>

            {/* 2. GST (General Sales Tax) */}
            <div className="p-2.5 bg-white border border-purple-200 rounded-lg space-y-1">
              <div className="font-bold text-purple-900 flex justify-between items-center">
                <span>GST (Sales Tax)</span>
                <div className="flex gap-1">
                  {[0, 1, 18].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleGstPctChange(p)}
                      className={`px-1.5 py-0.2 text-[9px] rounded font-bold ${
                        gstPct === p ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-500 block">GST %</label>
                  <input
                    type="number"
                    min="0"
                    value={gstPct}
                    onChange={(e) => handleGstPctChange(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">GST Rs.</label>
                  <input
                    type="number"
                    min="0"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(Number(e.target.value) || 0)}
                    className="w-full border rounded px-1.5 py-1 text-xs text-right font-bold text-purple-800"
                  />
                </div>
              </div>
            </div>

            {/* 3. Advance TAX (Sec 236G/H Advance Tax) */}
            <div className="p-2.5 bg-white border border-blue-200 rounded-lg space-y-1">
              <div className="font-bold text-blue-900 flex justify-between items-center">
                <span>Advance TAX (236G/H)</span>
                <div className="flex gap-1">
                  {[0, 0.5, 1, 2.5].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleAdvanceTaxPctChange(p)}
                      className={`px-1 py-0.2 text-[9px] rounded font-bold ${
                        advanceTaxPct === p ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-500 block">Adv Tax %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={advanceTaxPct}
                    onChange={(e) => handleAdvanceTaxPctChange(e.target.value)}
                    className="w-full border rounded px-1.5 py-1 text-xs text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">Adv Tax Rs.</label>
                  <input
                    type="number"
                    min="0"
                    value={advanceTaxAmount}
                    onChange={(e) => setAdvanceTaxAmount(Number(e.target.value) || 0)}
                    className="w-full border rounded px-1.5 py-1 text-xs text-right font-bold text-blue-800"
                  />
                </div>
              </div>
            </div>

            {/* 4. Other Tax / WHT */}
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1">
              <div className="font-bold text-slate-800">Other Tax / WHT</div>
              <div>
                <label className="text-[10px] text-slate-500 block">Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={otherTax}
                  onChange={(e) => setOtherTax(Number(e.target.value) || 0)}
                  className="w-full border rounded px-2 py-1 text-xs text-right font-bold font-mono"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Grand Totals & Payment / Advance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 items-center">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Advance Paid / Paid Now
              </label>
              <input
                type="number"
                min="0"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1.5 text-xs text-right font-bold text-emerald-700 bg-white"
              />
            </div>

            <div className="text-center sm:text-right">
              <span className="text-slate-500 block text-[11px]">Net Payable Total</span>
              <b className="text-lg text-emerald-800 font-black font-mono">{fmt(netTotal)}</b>
            </div>

            <div className="text-center sm:text-right p-2 bg-red-50/70 border border-red-200 rounded-lg">
              <span className="text-red-700 block text-[11px] font-bold">Remaining Due / Dues Added</span>
              <b className="text-lg text-red-600 font-black font-mono">{fmt(remainingDue)}</b>
            </div>
          </div>
        </div>

        {/* Note / Remarks */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">GRN Remarks / Delivery Note / Rider</label>
          <input
            type="text"
            placeholder="e.g. Delivered by distributor rider Ali, Gate pass # 104..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
          />
        </div>

        <button
          onClick={save}
          className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          Save GRN & Update Inventory Batches
        </button>
      </div>
    </Modal>
  )
}

// ----------------------------------------------------------------------
// MODAL: VIEW / PRINT / WHATSAPP GRN VOUCHER (GOODS RECEIVED NOTE)
// ----------------------------------------------------------------------
function GRNDetailModal({ grn, onClose }) {
  const db = useDB()
  const sup = supplierById(grn.supplierId)
  const pharmacyName = db.settings?.pharmacyName || 'Pharmacy POS'
  const pharmacyPhone = db.settings?.phone || ''
  const pharmacyAddress = db.settings?.address || ''

  const totalBilledUnits = (grn.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0)
  const totalBonusUnits = (grn.items || []).reduce((s, it) => s + (Number(it.bonusQty) || 0), 0)

  const taxesTotal = (Number(grn.gstAmount) || 0) + (Number(grn.advanceTaxAmount) || 0) + (Number(grn.otherTax) || 0)
  const due = grn.due !== undefined ? grn.due : (grn.total - (grn.paid || 0))

  const handlePrint = () => {
    window.print()
  }

  const handleWhatsApp = () => {
    let msg = `*GOODS RECEIVED NOTE (GRN): ${grn.grnNo || grn.invoiceNo}*\n`
    msg += `*Pharmacy:* ${pharmacyName}\n`
    if (pharmacyPhone) msg += `*Contact:* ${pharmacyPhone}\n`
    msg += `*Date:* ${grn.date || todayStr()}\n`
    msg += `*Supplier:* ${sup?.name || 'Distributor'} ${sup?.company ? `(${sup.company})` : ''}\n`
    msg += `*Supplier Inv #:* ${grn.invoiceNo}\n\n`
    msg += `*RECEIVED ITEMS:*\n`

    ;(grn.items || []).forEach((it, idx) => {
      msg += `${idx + 1}. *${it.medicineName || 'Medicine'}*\n`
      msg += `   Batch: *${it.batchNo}* | Exp: *${it.expiry}*\n`
      msg += `   Qty: *${it.qty}* ${it.bonusQty ? `(+${it.bonusQty} Bonus)` : ''} @ Rs. ${it.purchasePrice} = *Rs. ${it.lineTotal || it.qty * it.purchasePrice}*\n`
    })

    msg += `\n*Gross Subtotal:* ${fmt(grn.subtotal || grn.total)}\n`
    if (grn.discountAmount) msg += `*Discount:* -${fmt(grn.discountAmount)}\n`
    if (grn.gstAmount) msg += `*GST (${grn.gstPct || 0}%):* +${fmt(grn.gstAmount)}\n`
    if (grn.advanceTaxAmount) msg += `*Advance Tax (${grn.advanceTaxPct || 0}%):* +${fmt(grn.advanceTaxAmount)}\n`
    if (grn.otherTax) msg += `*Other Tax:* +${fmt(grn.otherTax)}\n`
    msg += `*Net Grand Total:* *${fmt(grn.total)}*\n`
    msg += `*Paid Advance:* ${fmt(grn.paid || 0)}\n`
    msg += `*Balance Due:* *${fmt(due)}*\n`

    const cleanPhone = (sup?.phone || '').replace(/[^0-9]/g, '')
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('92') ? cleanPhone : '92' + cleanPhone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`

    window.open(url, '_blank')
  }

  return (
    <Modal title={`Goods Received Note (GRN): ${grn.grnNo || grn.invoiceNo}`} onClose={onClose}>
      <div className="space-y-4 text-xs">
        {/* Printable GRN Card */}
        <div id="grn-printable-slip" className="p-4 bg-white border border-slate-300 rounded-xl shadow-sm space-y-4">
          {/* Slip Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">{pharmacyName}</h3>
              {pharmacyAddress && <p className="text-slate-500 text-[11px]">{pharmacyAddress}</p>}
              {pharmacyPhone && <p className="text-slate-500 text-[11px]">Phone: {pharmacyPhone}</p>}
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg">
                GOODS RECEIVED NOTE (GRN)
              </span>
              <div className="font-mono font-bold text-slate-800 text-sm mt-1">{grn.grnNo || '—'}</div>
              <div className="text-slate-500 text-[11px]">Supplier Inv: <b>{grn.invoiceNo}</b></div>
              <div className="text-slate-500 text-[11px]">Date: {grn.date || todayStr()}</div>
            </div>
          </div>

          {/* Supplier Details */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Supplier / Distributor</div>
              <div className="font-black text-slate-800 text-xs mt-0.5">{sup?.name || 'General Supplier'}</div>
              <div className="text-slate-500 text-[11px]">{sup?.company || 'Pharmaceutical Distributor'}</div>
              <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" /> {sup?.phone || 'No phone'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Receiving Info</div>
              <div className="mt-0.5">
                <span className="font-bold text-slate-700">Received By: </span>
                <b className="text-slate-900">{grn.receivedBy || 'Pharmacist'}</b>
              </div>
              <div className="mt-0.5 text-slate-500">
                Payment Status: <b className={due > 0 ? 'text-red-600' : 'text-emerald-600'}>{due > 0 ? 'PARTIAL / CREDIT' : 'PAID'}</b>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Medicine Description</th>
                <th className="p-2 text-center">Batch No</th>
                <th className="p-2 text-center">Expiry</th>
                <th className="p-2 text-center">Billed Qty</th>
                <th className="p-2 text-center">Bonus</th>
                <th className="p-2 text-right">Cost Rate (TP)</th>
                <th className="p-2 text-right">Sale MRP</th>
                <th className="p-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(grn.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td className="p-2 text-slate-400">{idx + 1}</td>
                  <td className="p-2 font-bold text-slate-800">{it.medicineName || 'Medicine'}</td>
                  <td className="p-2 text-center font-mono font-bold text-slate-700">{it.batchNo}</td>
                  <td className="p-2 text-center text-slate-600">{it.expiry}</td>
                  <td className="p-2 text-center font-bold text-slate-900">{it.qty}</td>
                  <td className="p-2 text-center text-emerald-700 font-semibold">{it.bonusQty ? `+${it.bonusQty}` : '—'}</td>
                  <td className="p-2 text-right font-mono text-slate-600">{fmt(it.purchasePrice)}</td>
                  <td className="p-2 text-right font-mono text-slate-600">{fmt(it.salePrice || 0)}</td>
                  <td className="p-2 text-right font-bold text-slate-800 font-mono">
                    {fmt(it.lineTotal || it.qty * it.purchasePrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Detailed Financial & Tax Breakdown Box */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-1 text-slate-600">
              {grn.note && (
                <div className="p-2 bg-slate-50 rounded border text-[11px]">
                  <b>Remarks / Note:</b> {grn.note}
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                Total Billed Units: <b>{totalBilledUnits}</b> {totalBonusUnits > 0 ? `(+${totalBonusUnits} Bonus Free)` : ''}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Subtotal:</span>
                <span className="font-mono font-semibold">{fmt(grn.subtotal || grn.total)}</span>
              </div>
              {Number(grn.discountAmount) > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Less: Desiccant / Discount ({grn.discountPct || 0}%):</span>
                  <span className="font-mono">-{fmt(grn.discountAmount)}</span>
                </div>
              )}
              {Number(grn.gstAmount) > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>Add: GST ({grn.gstPct || 0}%):</span>
                  <span className="font-mono">+{fmt(grn.gstAmount)}</span>
                </div>
              )}
              {Number(grn.advanceTaxAmount) > 0 && (
                <div className="flex justify-between text-blue-700">
                  <span>Add: Advance TAX Sec 236G/H ({grn.advanceTaxPct || 0}%):</span>
                  <span className="font-mono">+{fmt(grn.advanceTaxAmount)}</span>
                </div>
              )}
              {Number(grn.otherTax) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Add: Other Tax / WHT:</span>
                  <span className="font-mono">+{fmt(grn.otherTax)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 border-t pt-1">
                <span>Net Grand Total:</span>
                <span className="font-mono text-emerald-800">{fmt(grn.total)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Advance / Paid Now:</span>
                <span className="font-mono">{fmt(grn.paid || 0)}</span>
              </div>
              <div className="flex justify-between text-red-600 font-black border-t pt-1">
                <span>Remaining Balance Due:</span>
                <span className="font-mono">{fmt(due)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print GRN Slip
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              Send to Supplier via WhatsApp
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ----------------------------------------------------------------------
// MODAL: CREATE MANUAL PURCHASE ORDER
// ----------------------------------------------------------------------
function NewPOModal({ onClose, onCreated }) {
  const db = useDB()
  const [supplierId, setSupplierId] = useState(db.suppliers[0]?.id || '')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([])
  const [mid, setMid] = useState('')
  const [orderQty, setOrderQty] = useState(10)

  const selectedSupplier = db.suppliers.find((s) => s.id === supplierId)

  function addItem() {
    const m = medicineById(mid)
    if (!m) return
    if (items.some((it) => it.medicineId === m.id)) {
      alert('Yeh medicine pehlay se list mein moojood hai.')
      return
    }
    const cost = m.purchasePrice || Math.round(m.salePrice * 0.75)
    setItems((prev) => [
      ...prev,
      {
        medicineId: m.id,
        name: `${m.name} ${m.strength || ''}`,
        qty: Number(orderQty) || 1,
        purchasePrice: cost,
        salePrice: m.salePrice || 0,
        note: '',
      },
    ])
    setMid('')
    setOrderQty(10)
  }

  const totalEstCost = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0)

  function handleSave() {
    if (!items.length) {
      alert('Pehlay kam az kam 1 medicine add karein.')
      return
    }
    try {
      const po = savePurchaseOrder({
        supplierId,
        items,
        note,
        source: 'MANUAL',
      })
      onCreated(po)
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <Modal title="Create New Purchase Order (Parches Order)" onClose={onClose}>
      <div className="space-y-3 text-xs">
        {/* Supplier Selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Target Supplier / Distributor</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              {db.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.company ? `(${s.company})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Supplier Phone & Company</label>
            <div className="px-3 py-1.5 bg-slate-50 border rounded-lg text-slate-600 flex items-center justify-between">
              <span>{selectedSupplier?.company || 'Direct Supplier'}</span>
              <span className="font-mono text-slate-500">{selectedSupplier?.phone || 'No phone'}</span>
            </div>
          </div>
        </div>

        {/* Add Medicine Row */}
        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
          <label className="font-bold text-blue-900 block mb-1.5">Add Medicines to Order</label>
          <div className="flex gap-2">
            <select
              value={mid}
              onChange={(e) => setMid(e.target.value)}
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="">— Select Medicine —</option>
              {db.medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.strength} ({m.dosageForm || m.form}) · Rs. {m.salePrice}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Qty"
              value={orderQty}
              onChange={(e) => setOrderQty(e.target.value)}
              className="w-20 border rounded-lg px-2 py-1.5 text-xs text-center font-bold"
            />
            <button
              onClick={addItem}
              className="px-4 py-1.5 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white font-bold rounded-lg transition-all cursor-pointer"
            >
              + Add Line
            </button>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2 text-left">Medicine</th>
                <th>Order Qty</th>
                <th>Est. Unit Cost</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={idx} className="text-center hover:bg-slate-50">
                  <td className="p-2 text-left font-bold text-slate-800">{it.name}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, qty: Number(e.target.value) || 1 } : r))
                        )
                      }
                      className="border rounded w-16 px-1 py-0.5 text-xs text-center font-bold"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={it.purchasePrice}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, purchasePrice: Number(e.target.value) || 0 } : r))
                        )
                      }
                      className="border rounded w-20 px-1 py-0.5 text-xs text-right font-mono"
                    />
                  </td>
                  <td className="font-bold text-slate-800 font-mono">
                    {fmt(it.qty * it.purchasePrice)}
                  </td>
                  <td>
                    <button
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 px-1 font-bold"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-slate-400">
                    Koi item add nahi hua. Medicine select karein aur Add Line dabayein.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Note Field */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">Order Notes / Delivery Instructions</label>
          <input
            type="text"
            placeholder="e.g. Urgent delivery needed, verify batch expiry > 1.5 years..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-xs"
          />
        </div>

        {/* Total & Action */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
          <div>
            <span className="text-slate-500">Total Items: </span>
            <b className="text-slate-800">{items.length}</b>
          </div>
          <div className="text-right">
            <span className="text-slate-500 mr-2">Estimated Order Cost:</span>
            <b className="text-base text-blue-700">{fmt(totalEstCost)}</b>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4" />
          Create & Save Purchase Order (PO)
        </button>
      </div>
    </Modal>
  )
}

// ----------------------------------------------------------------------
// MODAL: VIEW / PRINT / WHATSAPP PURCHASE ORDER SLIP
// ----------------------------------------------------------------------
function PODetailModal({ po, onClose, onReceive }) {
  const db = useDB()
  const sup = supplierById(po.supplierId)
  const pharmacyName = db.settings?.pharmacyName || 'Pharmacy POS'
  const pharmacyPhone = db.settings?.phone || ''
  const pharmacyAddress = db.settings?.address || ''

  // Total quantity and amount
  const totalQty = (po.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0)
  const totalAmount = po.totalEstimatedCost || (po.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0)

  // Format WhatsApp message
  const handleWhatsApp = () => {
    let msg = `*PURCHASE ORDER: ${po.poNo}*\n`
    msg += `*Pharmacy:* ${pharmacyName}\n`
    if (pharmacyPhone) msg += `*Contact:* ${pharmacyPhone}\n`
    msg += `*Date:* ${po.date || todayStr()}\n`
    msg += `*To:* ${sup?.name || 'Distributor'} ${sup?.company ? `(${sup.company})` : ''}\n\n`
    msg += `*ITEMS REQUIRED:*\n`

    ;(po.items || []).forEach((it, idx) => {
      msg += `${idx + 1}. *${it.name}* — Qty: *${it.qty} packs/units*`
      if (it.note) msg += ` (${it.note})`
      msg += `\n`
    })

    msg += `\n*Total Items:* ${po.items?.length || 0} (${totalQty} units)\n`
    msg += `*Estimated Cost:* ${fmt(totalAmount)}\n`
    if (po.note) msg += `*Notes:* ${po.note}\n`
    msg += `\n_Please confirm availability and dispatch earliest. Thank you!_`

    const cleanPhone = (sup?.phone || '').replace(/[^0-9]/g, '')
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('92') ? cleanPhone : '92' + cleanPhone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`

    window.open(url, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal title={`Purchase Order Voucher: ${po.poNo}`} onClose={onClose}>
      <div className="space-y-4 text-xs">
        {/* Printable Voucher Card */}
        <div id="po-printable-slip" className="p-4 bg-white border border-slate-300 rounded-xl shadow-sm space-y-4">
          {/* Slip Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">{pharmacyName}</h3>
              {pharmacyAddress && <p className="text-slate-500 text-[11px]">{pharmacyAddress}</p>}
              {pharmacyPhone && <p className="text-slate-500 text-[11px]">Phone: {pharmacyPhone}</p>}
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-black rounded-lg">
                PURCHASE ORDER
              </span>
              <div className="font-mono font-bold text-slate-800 text-sm mt-1">{po.poNo}</div>
              <div className="text-slate-500 text-[11px]">Date: {po.date || todayStr()}</div>
            </div>
          </div>

          {/* Supplier & Details Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Vendor / Supplier</div>
              <div className="font-black text-slate-800 text-xs mt-0.5">{sup?.name || 'General Supplier'}</div>
              <div className="text-slate-500 text-[11px]">{sup?.company || 'Pharmaceutical Distributor'}</div>
              <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" /> {sup?.phone || 'No phone'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Order Details</div>
              <div className="mt-0.5">
                <span className="font-bold text-slate-700">Status: </span>
                <b className="uppercase text-blue-700">{po.status || 'DRAFT'}</b>
              </div>
              <div className="mt-0.5 text-slate-500">
                Source: <span className="font-bold text-purple-700">{po.source === 'AUDIT' ? '📋 Stock Audit Shortage' : 'Manual Order'}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Medicine Description</th>
                <th className="p-2 text-center">Order Qty</th>
                <th className="p-2 text-right">Est. Unit Rate</th>
                <th className="p-2 text-right">Total Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(po.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td className="p-2 text-slate-400">{idx + 1}</td>
                  <td className="p-2">
                    <div className="font-bold text-slate-800">{it.name}</div>
                    {it.note && <div className="text-[10px] text-purple-600 font-medium">{it.note}</div>}
                  </td>
                  <td className="p-2 text-center font-bold text-slate-900">{it.qty}</td>
                  <td className="p-2 text-right text-slate-600 font-mono">{fmt(it.purchasePrice || 0)}</td>
                  <td className="p-2 text-right font-bold text-slate-800 font-mono">
                    {fmt((it.qty || 0) * (it.purchasePrice || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 font-bold bg-slate-50">
              <tr>
                <td colSpan="2" className="p-2 text-slate-700">
                  Total Items: {po.items?.length || 0}
                </td>
                <td className="p-2 text-center text-slate-900 font-black">{totalQty} units</td>
                <td className="p-2 text-right text-slate-600">Total:</td>
                <td className="p-2 text-right text-blue-700 text-sm font-black font-mono">
                  {fmt(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {po.note && (
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px]">
              <b>Instructions / Remarks:</b> {po.note}
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print PO Slip
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              Send to Supplier via WhatsApp
            </button>
          </div>

          <div className="flex items-center gap-2">
            {po.status !== 'RECEIVED' && (
              <button
                onClick={() => onReceive(po)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#3b1734] hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Package className="w-4 h-4" />
                🚚 Receive Stock as GRN
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ----------------------------------------------------------------------
// MODAL: CREATE NEW PURCHASE RETURN
// ----------------------------------------------------------------------
function NewPurchaseReturnModal({ onClose, onCreated }) {
  const db = useDB()
  const [supplierId, setSupplierId] = useState(db.suppliers[0]?.id || '')
  const [settlementType, setSettlementType] = useState('CREDIT_NOTE') // CREDIT_NOTE | CASH_REFUND
  const [note, setNote] = useState('')

  // Item line to add
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [returnQty, setReturnQty] = useState(1)
  const [returnPrice, setReturnPrice] = useState(0)
  const [returnReason, setReturnReason] = useState('EXPIRED') // EXPIRED | NEAR_EXPIRY | DAMAGED | WRONG_ITEM | OVER_STOCKED | OTHER
  const [itemNote, setItemNote] = useState('')

  // Filter batches by selected supplier or show all available batches
  const [filterBySupplierOnly, setFilterBySupplierOnly] = useState(false)
  const [batchSearch, setBatchSearch] = useState('')

  // Added items in voucher
  const [items, setItems] = useState([])

  const selectedSupplier = db.suppliers.find((s) => s.id === supplierId)

  // Available batches with stock > 0
  const availableBatches = useMemo(() => {
    return (db.batches || []).filter((b) => {
      if (b.qty <= 0) return false
      if (filterBySupplierOnly && b.supplierId && b.supplierId !== supplierId) return false
      const m = medicineById(b.medicineId)
      const q = batchSearch.toLowerCase().trim()
      if (!q) return true
      return (
        b.batchNo?.toLowerCase().includes(q) ||
        m?.name?.toLowerCase().includes(q) ||
        m?.generic?.toLowerCase().includes(q)
      )
    })
  }, [db.batches, filterBySupplierOnly, supplierId, batchSearch])

  // When selectedBatchId changes, set default return price and reset qty
  const activeBatch = useMemo(() => {
    return (db.batches || []).find((b) => b.id === selectedBatchId)
  }, [db.batches, selectedBatchId])

  const activeMedicine = useMemo(() => {
    return activeBatch ? medicineById(activeBatch.medicineId) : null
  }, [activeBatch])

  useEffect(() => {
    if (activeBatch) {
      setReturnPrice(activeBatch.purchasePrice || (activeMedicine ? Math.round(activeMedicine.salePrice * 0.75) : 0))
      setReturnQty(Math.min(1, activeBatch.qty))
    }
  }, [activeBatch, activeMedicine])

  function addItem() {
    if (!activeBatch || !activeMedicine) {
      alert('Pehlay medicine batch select karein.')
      return
    }
    const q = Number(returnQty) || 0
    if (q <= 0) {
      alert('Return quantity 0 se zyada honi chahiye.')
      return
    }
    if (q > activeBatch.qty) {
      alert(`Is batch mein sirf ${activeBatch.qty} units available hain. Aap is se zyada return nahi kar saktay.`)
      return
    }
    if (items.some((it) => it.batchId === activeBatch.id)) {
      alert('Yeh batch pehlay se return list mein add hai.')
      return
    }

    const price = Number(returnPrice) || 0
    setItems((prev) => [
      ...prev,
      {
        medicineId: activeMedicine.id,
        medicineName: `${activeMedicine.name} ${activeMedicine.strength || ''}`,
        batchId: activeBatch.id,
        batchNo: activeBatch.batchNo,
        expiry: activeBatch.expiry,
        qty: q,
        purchasePrice: price,
        total: q * price,
        reason: returnReason,
        note: itemNote,
      },
    ])

    setSelectedBatchId('')
    setItemNote('')
  }

  const grandTotal = items.reduce((s, it) => s + (Number(it.total) || 0), 0)

  function handleSubmit() {
    if (!items.length) {
      alert('Kam az kam ek item add karein.')
      return
    }

    try {
      const pr = savePurchaseReturn({
        supplierId,
        items,
        settlementType,
        note,
      })
      onCreated(pr)
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <Modal title="New Purchase Return" onClose={onClose}>
      <div className="space-y-4 text-xs">
        {/* Step 1: Supplier Selector & Balance info */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
          <div>
            <label className="font-bold text-purple-950 block mb-1">Target Supplier / Distributor</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              {db.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.company ? `(${s.company})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-bold text-purple-950 block mb-1">Current Payable Balance</label>
            <div className="px-3 py-1.5 bg-white border border-purple-200 rounded-lg flex items-center justify-between">
              <span className="text-slate-600">Our Payable Debt:</span>
              <b className={selectedSupplier?.balance > 0 ? 'text-red-600 text-sm' : 'text-emerald-600 text-sm'}>
                {fmt(selectedSupplier?.balance || 0)}
              </b>
            </div>
          </div>
        </div>

        {/* Step 2: Add Batches to Return */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-purple-600" />
              Select Medicine Batch from Inventory
            </span>
            <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filterBySupplierOnly}
                onChange={(e) => setFilterBySupplierOnly(e.target.checked)}
                className="rounded text-purple-600"
              />
              Show batches linked to this supplier only
            </label>
          </div>

          {/* Batch Selector Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
            >
              <option value="">— Select batch to return ({availableBatches.length} available) —</option>
              {availableBatches.map((b) => {
                const m = medicineById(b.medicineId)
                const isExp = new Date(b.expiry) < new Date()
                return (
                  <option key={b.id} value={b.id}>
                    {m?.name} {m?.strength} · Batch: {b.batchNo} · Exp: {b.expiry} · Stock: {b.qty} {isExp ? '⚠️ (EXPIRED)' : ''}
                  </option>
                )
              })}
            </select>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Return Qty</label>
                <input
                  type="number"
                  min="1"
                  max={activeBatch?.qty || 9999}
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className="w-full border rounded-lg px-2 py-1 text-xs text-center font-bold"
                  placeholder="Qty"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Cost Rate</label>
                <input
                  type="number"
                  value={returnPrice}
                  onChange={(e) => setReturnPrice(e.target.value)}
                  className="w-full border rounded-lg px-2 py-1 text-xs text-right font-mono"
                  placeholder="Rate"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Line Total</label>
                <div className="py-1 px-1 text-center font-black text-slate-800">
                  {fmt((Number(returnQty) || 0) * (Number(returnPrice) || 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Reason & Remarks Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Return Reason</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full border rounded-lg px-2 py-1 text-xs bg-white font-semibold"
              >
                <option value="EXPIRED">⏰ Expired Stock</option>
                <option value="NEAR_EXPIRY">⌛ Near Expiry</option>
                <option value="DAMAGED">💥 Damaged / Broken</option>
                <option value="WRONG_ITEM">❌ Wrong Item Delivered</option>
                <option value="OVER_STOCKED">📦 Slow Moving / Excess</option>
                <option value="OTHER">📝 Other Reason</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Item Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Broken packaging, distributor claim agreed..."
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1 text-xs"
                />
              </div>
              <button
                onClick={addItem}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm transition whitespace-nowrap"
              >
                + Add to Return
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: Return Items Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2 text-left">Medicine</th>
                <th>Batch #</th>
                <th>Expiry</th>
                <th>Qty</th>
                <th>Cost Rate</th>
                <th>Line Total</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={idx} className="text-center hover:bg-slate-50">
                  <td className="p-2 text-left font-bold text-slate-800">{it.medicineName}</td>
                  <td className="font-mono text-slate-600">{it.batchNo}</td>
                  <td className="text-slate-500">{it.expiry}</td>
                  <td className="font-bold text-purple-700">{it.qty}</td>
                  <td className="text-right font-mono text-slate-600">{fmt(it.purchasePrice)}</td>
                  <td className="text-right font-black text-slate-900 font-mono">{fmt(it.total)}</td>
                  <td>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                      {it.reason}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 px-1 font-bold"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-slate-400">
                    No items in return list yet. Select a batch above and click "+ Add to Return".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Step 4: Settlement Mode & General Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-xs">Financial Settlement Method:</span>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="settlement"
                value="CREDIT_NOTE"
                checked={settlementType === 'CREDIT_NOTE'}
                onChange={() => setSettlementType('CREDIT_NOTE')}
                className="mt-0.5 text-purple-600"
              />
              <div>
                <b className="text-slate-800">💳 Debit Note / Adjust in Balance</b>
                <p className="text-[11px] text-slate-500">
                  Return amount ({fmt(grandTotal)}) will be deducted from the supplier's payable balance.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="radio"
                name="settlement"
                value="CASH_REFUND"
                checked={settlementType === 'CASH_REFUND'}
                onChange={() => setSettlementType('CASH_REFUND')}
                className="mt-0.5 text-emerald-600"
              />
              <div>
                <b className="text-slate-800">💵 Cash Refund Received</b>
                <p className="text-[11px] text-slate-500">
                  Supplier or delivery rider has handed over instant cash refund.
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Return Remarks / Driver Name</label>
            <textarea
              rows="3"
              placeholder="e.g. Returned via Distributor Rider Ahmed, Gate pass # 442..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white"
            />
          </div>
        </div>

        {/* Total & Submit */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
          <div>
            <span className="text-slate-500">Total Items to Return: </span>
            <b className="text-slate-800">{items.length} items</b>
          </div>
          <div className="text-right">
            <span className="text-slate-500 mr-2">Total Return Recovery Amount:</span>
            <b className="text-base text-purple-700">{fmt(grandTotal)}</b>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5 text-xs"
        >
          <RotateCcw className="w-4 h-4" />
          Submit Purchase Return & Deduct Inventory Stock
        </button>
      </div>
    </Modal>
  )
}

// ----------------------------------------------------------------------
// MODAL: VIEW / PRINT / WHATSAPP DEBIT NOTE VOUCHER
// ----------------------------------------------------------------------
function PurchaseReturnSlipModal({ pr, onClose }) {
  const db = useDB()
  const sup = supplierById(pr.supplierId)
  const pharmacyName = db.settings?.pharmacyName || 'Pharmacy POS'
  const pharmacyPhone = db.settings?.phone || ''
  const pharmacyAddress = db.settings?.address || ''

  const totalUnits = (pr.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0), 0)

  // Format WhatsApp message
  const handleWhatsApp = () => {
    let msg = `*DEBIT NOTE / PURCHASE RETURN: ${pr.returnNo}*\n`
    msg += `*Pharmacy:* ${pharmacyName}\n`
    if (pharmacyPhone) msg += `*Contact:* ${pharmacyPhone}\n`
    msg += `*Date:* ${pr.date || todayStr()}\n`
    msg += `*Vendor/Distributor:* ${sup?.name || pr.supplierName || 'Distributor'} ${sup?.company ? `(${sup.company})` : ''}\n\n`
    msg += `*RETURNED MEDICINES:*\n`

    ;(pr.items || []).forEach((it, idx) => {
      msg += `${idx + 1}. *${it.medicineName}*\n`
      msg += `   Batch: ${it.batchNo} | Exp: ${it.expiry}\n`
      msg += `   Qty: *${it.qty} units* @ Rs. ${it.purchasePrice} = *Rs. ${it.total}*\n`
      msg += `   Reason: ${it.reason}\n`
    })

    msg += `\n*Total Items:* ${pr.items?.length || 0} (${totalUnits} units)\n`
    msg += `*Total Claim Amount:* ${fmt(pr.totalAmount)}\n`
    msg += `*Settlement Mode:* ${pr.settlementType === 'CREDIT_NOTE' ? 'Debit Note (Deduct from Payable Balance)' : 'Cash Refund'}\n`
    if (pr.note) msg += `*Remarks:* ${pr.note}\n`
    msg += `\n_Please confirm credit note acknowledgment. Thank you!_`

    const cleanPhone = (sup?.phone || '').replace(/[^0-9]/g, '')
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('92') ? cleanPhone : '92' + cleanPhone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`

    window.open(url, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal title={`Debit Note Voucher: ${pr.returnNo}`} onClose={onClose}>
      <div className="space-y-4 text-xs">
        {/* Printable Debit Note Card */}
        <div id="pr-printable-slip" className="p-4 bg-white border border-slate-300 rounded-xl shadow-sm space-y-4">
          {/* Slip Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">{pharmacyName}</h3>
              {pharmacyAddress && <p className="text-slate-500 text-[11px]">{pharmacyAddress}</p>}
              {pharmacyPhone && <p className="text-slate-500 text-[11px]">Phone: {pharmacyPhone}</p>}
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-[11px] font-black rounded-lg">
                DEBIT NOTE / PURCHASE RETURN
              </span>
              <div className="font-mono font-bold text-slate-800 text-sm mt-1">{pr.returnNo}</div>
              <div className="text-slate-500 text-[11px]">Date: {pr.date || todayStr()}</div>
            </div>
          </div>

          {/* Supplier & Details Grid */}
          <div className="grid grid-cols-2 gap-3 bg-purple-50/50 p-3 rounded-lg border border-purple-200">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Vendor / Supplier</div>
              <div className="font-black text-slate-800 text-xs mt-0.5">{sup?.name || pr.supplierName || 'General Supplier'}</div>
              <div className="text-slate-500 text-[11px]">{sup?.company || pr.supplierCompany || 'Pharmaceutical Distributor'}</div>
              <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" /> {sup?.phone || 'No phone'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Settlement Mode</div>
              <div className="mt-0.5">
                <span className="font-bold text-purple-700">
                  {pr.settlementType === 'CREDIT_NOTE' ? '💳 Debit Note (Balance Deducted)' : '💵 Cash Refund Received'}
                </span>
              </div>
              <div className="mt-0.5 text-slate-500">
                Processed By: <b className="text-slate-700">{pr.by || 'Pharmacist'}</b>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Medicine Description</th>
                <th className="p-2 text-center">Batch #</th>
                <th className="p-2 text-center">Expiry</th>
                <th className="p-2 text-center">Qty Returned</th>
                <th className="p-2 text-right">Cost Rate</th>
                <th className="p-2 text-right">Total Claim</th>
                <th className="p-2 text-center">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(pr.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td className="p-2 text-slate-400">{idx + 1}</td>
                  <td className="p-2 font-bold text-slate-800">{it.medicineName}</td>
                  <td className="p-2 text-center font-mono text-slate-600">{it.batchNo}</td>
                  <td className="p-2 text-center text-slate-500">{it.expiry}</td>
                  <td className="p-2 text-center font-bold text-purple-700">{it.qty}</td>
                  <td className="p-2 text-right text-slate-600 font-mono">{fmt(it.purchasePrice || 0)}</td>
                  <td className="p-2 text-right font-bold text-slate-800 font-mono">
                    {fmt(it.total || (it.qty * (it.purchasePrice || 0)))}
                  </td>
                  <td className="p-2 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {it.reason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 font-bold bg-slate-50">
              <tr>
                <td colSpan="4" className="p-2 text-slate-700">
                  Total Items: {pr.items?.length || 0}
                </td>
                <td className="p-2 text-center text-purple-700 font-black">{totalUnits} units</td>
                <td className="p-2 text-right text-slate-600">Grand Total:</td>
                <td className="p-2 text-right text-purple-700 text-sm font-black font-mono">
                  {fmt(pr.totalAmount)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          {pr.note && (
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px]">
              <b>Instructions / Remarks:</b> {pr.note}
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print Debit Note Slip
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              Send to Supplier via WhatsApp
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
