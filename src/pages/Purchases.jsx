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
} from 'lucide-react'

export default function Purchases() {
  const db = useDB()
  const location = useLocation()
  const navigate = useNavigate()

  // Tabs: 'orders' (Parches Orders) | 'invoices' (Inward Invoices & Supplier Dues) | 'returns' (Purchase Returns)
  const [tab, setTab] = useState('orders')
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [showNewPO, setShowNewPO] = useState(false)
  const [showNewReturn, setShowNewReturn] = useState(false)
  const [viewingPO, setViewingPO] = useState(null)
  const [receivingPO, setReceivingPO] = useState(null)
  const [viewingReturn, setViewingReturn] = useState(null)

  // Sync tab with URL search params if present
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const t = params.get('tab')
    if (t === 'orders' || t === 'invoices' || t === 'returns') {
      setTab(t)
    }
  }, [location.search])

  const setTabAndUrl = (newTab) => {
    setTab(newTab)
    navigate(`/purchases?tab=${newTab}`, { replace: true })
  }

  // Supplier-wise outstanding report
  const supReport = useMemo(() => {
    return (db.suppliers || []).map((s) => {
      const purchases = (db.purchases || []).filter((p) => p.supplierId === s.id)
      const totalPurchases = purchases.reduce((a, p) => a + p.total, 0)
      const totalPaid = purchases.reduce((a, p) => a + p.paid, 0)
      const invoices = purchases.length
      const lastDate = purchases.map((p) => p.date).sort().slice(-1)[0]
      return { ...s, totalPurchases, totalPaid, invoices, lastDate, outstanding: Math.max(0, s.balance || 0) }
    }).sort((a, b) => b.outstanding - a.outstanding)
  }, [db.suppliers, db.purchases])

  const totalOutstanding = useMemo(() => {
    return supReport.reduce((a, s) => a + s.outstanding, 0)
  }, [supReport])

  // Purchase Orders Data & Filters
  const [poSearch, setPoSearch] = useState('')
  const [poStatusFilter, setPoStatusFilter] = useState('ALL') // ALL | DRAFT | SENT | RECEIVED | CANCELLED

  const allPOs = purchaseOrders()

  const filteredPOs = useMemo(() => {
    return allPOs.filter((po) => {
      const matchStatus = poStatusFilter === 'ALL' || po.status === poStatusFilter
      const sup = supplierById(po.supplierId)
      const q = poSearch.toLowerCase().trim()
      const matchSearch =
        !q ||
        po.poNo?.toLowerCase().includes(q) ||
        sup?.name?.toLowerCase().includes(q) ||
        sup?.company?.toLowerCase().includes(q) ||
        po.items?.some((it) => it.name?.toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
  }, [allPOs, poStatusFilter, poSearch])

  // PO KPIs
  const poStats = useMemo(() => {
    const total = allPOs.length
    const draft = allPOs.filter((p) => p.status === 'DRAFT').length
    const sent = allPOs.filter((p) => p.status === 'SENT').length
    const received = allPOs.filter((p) => p.status === 'RECEIVED').length
    const totalValue = allPOs.reduce((s, p) => s + (p.totalEstimatedCost || 0), 0)
    return { total, draft, sent, received, totalValue }
  }, [allPOs])

  // Purchase Returns Data & Filters
  const [returnSearch, setReturnSearch] = useState('')
  const [returnReasonFilter, setReturnReasonFilter] = useState('ALL')

  const allReturns = purchaseReturns()

  const filteredReturns = useMemo(() => {
    return allReturns.filter((pr) => {
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

      return matchSearch && matchReason
    })
  }, [allReturns, returnSearch, returnReasonFilter])

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
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-600" />
            Purchases, Orders & Returns (خریداری، آرڈرز اور واپسی)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Suppliers ke Purchase Orders manage karein, stock audit shortage reorder karein, invoices verify karein aur expiry/damage stock wapis karein.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/inventory?tab=audit')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
            title="Stock audit worksheet jahan se kam medicines ka auto-PO banta hai"
          >
            <ClipboardCheck className="w-4 h-4" />
            📋 Stock Audit (Kam/Zyada)
          </button>
          <button
            onClick={() => setShowNewPO(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            + New Purchase Order (PO)
          </button>
          <button
            onClick={() => setShowNewReturn(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition"
          >
            <RotateCcw className="w-4 h-4" />
            + New Purchase Return
          </button>
          <button
            onClick={() => {
              setReceivingPO(null)
              setShowNewPurchase(true)
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            + New Purchase (Stock In)
          </button>
        </div>
      </div>

      {/* Tab Navigation Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setTabAndUrl('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition whitespace-nowrap ${
            tab === 'orders'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          📋 Purchase Orders (Parches Orders)
          <span className="ml-1 px-2 py-0.5 text-xs font-extrabold rounded-full bg-blue-100 text-blue-700">
            {allPOs.length}
          </span>
        </button>

        <button
          onClick={() => setTabAndUrl('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition whitespace-nowrap ${
            tab === 'invoices'
              ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          🚚 Inward Invoices & Supplier Dues
          <span className="ml-1 px-2 py-0.5 text-xs font-extrabold rounded-full bg-emerald-100 text-emerald-700">
            {(db.purchases || []).length}
          </span>
        </button>

        <button
          onClick={() => setTabAndUrl('returns')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition whitespace-nowrap ${
            tab === 'returns'
              ? 'border-purple-600 text-purple-600 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          🔄 Purchase Returns (خریداری واپسی)
          <span className="ml-1 px-2 py-0.5 text-xs font-extrabold rounded-full bg-purple-100 text-purple-700">
            {allReturns.length}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PURCHASE ORDERS (PARCHES ORDERS)                   */}
      {/* ======================================================== */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Orders</div>
              <div className="text-2xl font-black text-slate-800 mt-1">{poStats.total}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">All created POs</div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm">
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Draft / Unsent</div>
              <div className="text-2xl font-black text-amber-900 mt-1">{poStats.draft}</div>
              <div className="text-[11px] text-amber-600 mt-0.5">Pending delivery/dispatch</div>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm">
              <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Sent to Supplier</div>
              <div className="text-2xl font-black text-blue-900 mt-1">{poStats.sent}</div>
              <div className="text-[11px] text-blue-600 mt-0.5">Awaiting distributor stock</div>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Received & Stocked</div>
              <div className="text-2xl font-black text-emerald-900 mt-1">{poStats.received}</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">Batches added to inventory</div>
            </div>

            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Estimated Value</div>
              <div className="text-xl font-black text-indigo-900 mt-1">{fmt(poStats.totalValue)}</div>
              <div className="text-[11px] text-indigo-600 mt-0.5">Total demand cost</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search PO #, supplier name, company, or medicine..."
                value={poSearch}
                onChange={(e) => setPoSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {['ALL', 'DRAFT', 'SENT', 'RECEIVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setPoStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                    poStatusFilter === st
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st === 'ALL' ? 'All POs' : st}
                </button>
              ))}
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
                                title="Convert PO into Purchase Invoice (Receive batches into inventory)"
                                className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition flex items-center gap-1"
                              >
                                <Package className="w-3.5 h-3.5" />
                                Receive
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
                          Naya purchase order banayein ya Stock Audit (Kam/Zyada) se shortage medicines ka auto-order create karein.
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <button
                            onClick={() => setShowNewPO(true)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                          >
                            + Create Manual PO
                          </button>
                          <button
                            onClick={() => navigate('/inventory?tab=audit')}
                            className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg"
                          >
                            📋 Run Stock Audit (Kam/Zyada)
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
      {/* TAB 2: INWARD INVOICES & SUPPLIER DUES                    */}
      {/* ======================================================== */}
      {tab === 'invoices' && (
        <div className="space-y-4">
          {/* Supplier-wise Outstanding Balance Report */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                🏢 Supplier-wise Outstanding Balance (سپلائر کے بقایاجات)
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

          {/* Inward Purchases Invoices Ledger */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Purchase Invoices Log ({(db.purchases || []).length})
              </span>
              <button
                onClick={() => {
                  setReceivingPO(null)
                  setShowNewPurchase(true)
                }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                + Add Inward Stock
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-left">Date</th>
                    <th className="p-2.5 text-left">Invoice #</th>
                    <th className="p-2.5 text-left">Supplier</th>
                    <th className="p-2.5 text-center">Items</th>
                    <th className="p-2.5 text-right">Total Invoice</th>
                    <th className="p-2.5 text-right">Amount Paid</th>
                    <th className="p-2.5 text-right">Remaining Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...db.purchases].reverse().map((p) => {
                    const sup = supplierById(p.supplierId)
                    const due = p.total - (p.paid || 0)
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition text-center">
                        <td className="p-2.5 text-left text-slate-600">{p.date}</td>
                        <td className="p-2.5 text-left font-mono font-bold text-slate-800">{p.invoiceNo}</td>
                        <td className="p-2.5 text-left font-semibold text-slate-700">{sup?.name || '—'}</td>
                        <td className="p-2.5">{p.items?.length || 0}</td>
                        <td className="p-2.5 text-right font-bold text-slate-800">{fmt(p.total)}</td>
                        <td className="p-2.5 text-right text-emerald-700 font-bold">{fmt(p.paid)}</td>
                        <td className={`p-2.5 text-right font-bold ${due > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {fmt(due)}
                        </td>
                      </tr>
                    )
                  })}
                  {!db.purchases.length && (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-slate-400">
                        No purchase records logged yet
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
      {/* TAB 3: PURCHASE RETURNS (خریداری واپسی / سپلائر ریٹرنز)    */}
      {/* ======================================================== */}
      {tab === 'returns' && (
        <div className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Return Vouchers</div>
              <div className="text-2xl font-black text-purple-700 mt-1">{returnStats.total}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Dispatched to suppliers</div>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 shadow-sm">
              <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wide">Returned Units</div>
              <div className="text-2xl font-black text-rose-900 mt-1">{returnStats.totalUnits}</div>
              <div className="text-[11px] text-rose-600 mt-0.5">Total packs/tablets deducted</div>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Total Claimed Value</div>
              <div className="text-xl font-black text-emerald-900 mt-1">{fmt(returnStats.totalValue)}</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">Financial recovery from vendors</div>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm">
              <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">Debit Notes</div>
              <div className="text-2xl font-black text-blue-900 mt-1">{returnStats.creditNotes}</div>
              <div className="text-[11px] text-blue-600 mt-0.5">Supplier balance adjusted</div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Cash Refunds</div>
              <div className="text-2xl font-black text-amber-900 mt-1">{returnStats.cashRefunds}</div>
              <div className="text-[11px] text-amber-600 mt-0.5">Instant cash received</div>
            </div>
          </div>

          {/* Search & Reason Filter Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search PR #, supplier, company, medicine, or batch..."
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Reason Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
              {[
                { id: 'ALL', label: 'All Reasons' },
                { id: 'EXPIRED', label: '⏰ Expired' },
                { id: 'NEAR_EXPIRY', label: '⌛ Near Expiry' },
                { id: 'DAMAGED', label: '💥 Damaged' },
                { id: 'WRONG_ITEM', label: '❌ Wrong Item' },
                { id: 'OVER_STOCKED', label: '📦 Excess' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  onClick={() => setReturnReasonFilter(rf.id)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                    returnReasonFilter === rf.id
                      ? 'bg-white text-purple-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
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
      {/* MODAL 1: NEW PURCHASE INVOICE (INWARD STOCK TO BATCHES)   */}
      {/* ======================================================== */}
      {showNewPurchase && (
        <PurchaseForm
          initialPO={receivingPO}
          onClose={() => {
            setShowNewPurchase(false)
            setReceivingPO(null)
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CREATE NEW PURCHASE ORDER (PO / PARCHES ORDER)  */}
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
      {/* MODAL 3: VIEW / PRINT / WHATSAPP PURCHASE ORDER SLIP     */}
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
      {/* MODAL 4: CREATE NEW PURCHASE RETURN                      */}
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
      {/* MODAL 5: VIEW / PRINT / WHATSAPP DEBIT NOTE VOUCHER      */}
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
// FORM COMPONENT: Purchase Inward (creates/receives batches)
// ----------------------------------------------------------------------
function PurchaseForm({ initialPO, onClose }) {
  const db = useDB()
  const [supplierId, setSupplierId] = useState(
    initialPO?.supplierId || db.suppliers[0]?.id || ''
  )
  const [invoiceNo, setInvoiceNo] = useState(
    initialPO ? `INV-${initialPO.poNo.replace('PO-', '')}` : ''
  )
  const [date, setDate] = useState(todayStr())
  const [paid, setPaid] = useState(0)

  // Initialize items from initialPO if available
  const [items, setItems] = useState(() => {
    if (initialPO?.items && initialPO.items.length > 0) {
      return initialPO.items.map((it) => {
        const m = medicineById(it.medicineId)
        return {
          medicineId: it.medicineId,
          batchNo: `B-${todayStr().replace(/-/g, '').slice(2)}`,
          expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          qty: it.qty || 1,
          purchasePrice: it.purchasePrice || (m ? Math.round(m.salePrice * 0.75) : 0),
          salePrice: it.salePrice || (m ? m.salePrice : 0),
        }
      })
    }
    return []
  })

  const [mid, setMid] = useState('')

  const total = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.purchasePrice) || 0), 0)

  function addItem() {
    const m = medicineById(mid)
    if (!m) return
    setItems((x) => [
      ...x,
      {
        medicineId: m.id,
        batchNo: '',
        expiry: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        qty: 1,
        purchasePrice: Math.round(m.salePrice * 0.75),
        salePrice: m.salePrice,
      },
    ])
    setMid('')
  }

  function save() {
    if (!items.length) return alert('Pehlay items add karein.')
    for (const it of items) {
      if (!it.batchNo) return alert('Tamam items ke Batch Number darj karein.')
      if (!it.expiry) return alert('Tamam items ki Expiry Date darj karein.')
      if (Number(it.qty) <= 0) return alert('Item ki quantity 0 se zyada honi chahiye.')
    }

    try {
      savePurchase({
        supplierId,
        invoiceNo: invoiceNo || 'INV-' + Date.now(),
        date,
        items,
        paid,
      })

      // If this purchase was converted from a Purchase Order, mark PO as RECEIVED
      if (initialPO?.id) {
        updatePurchaseOrderStatus(initialPO.id, 'RECEIVED')
      }

      onClose()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <Modal title={initialPO ? `Receive Purchase Order: ${initialPO.poNo}` : 'New Purchase (GRN / Stock In)'} onClose={onClose}>
      {initialPO && (
        <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
            Inwarding items from Purchase Order <b>{initialPO.poNo}</b>. Batch aur expiry check kar ke save karein.
          </span>
          <span className="font-bold text-blue-700 uppercase text-[10px] bg-blue-200 px-2 py-0.5 rounded">
            PO Source: {initialPO.source}
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 text-xs mb-3">
        <label className="col-span-2">
          <span className="font-bold text-slate-700">Supplier / Distributor</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="border rounded w-full px-2 py-1.5 mt-1 text-xs bg-white"
          >
            {db.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.company ? `(${s.company})` : ''}
              </option>
            ))}
          </select>
        </label>
        <Input label="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        <Input label="Invoice Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="flex gap-2 mb-2 text-xs">
        <select
          value={mid}
          onChange={(e) => setMid(e.target.value)}
          className="border rounded px-2 py-1.5 flex-1 bg-white"
        >
          <option value="">— Select medicine to add —</option>
          {db.medicines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.strength} ({m.dosageForm || m.form})
            </option>
          ))}
        </select>
        <button onClick={addItem} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs">
          + Add
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
            <tr>
              <th className="p-2 text-left">Medicine</th>
              <th>Batch #</th>
              <th>Expiry</th>
              <th>Qty</th>
              <th>P.Price</th>
              <th>S.Price</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, idx) => {
              const m = medicineById(it.medicineId)
              const set = (k) => (e) =>
                setItems((x) => x.map((r, i) => (i === idx ? { ...r, [k]: e.target.value } : r)))
              return (
                <tr key={idx} className="text-center hover:bg-slate-50">
                  <td className="p-2 text-left font-bold text-slate-800">
                    {m ? `${m.name} ${m.strength || ''}` : 'Unknown'}
                  </td>
                  <td>
                    <input
                      value={it.batchNo}
                      onChange={set('batchNo')}
                      className="border rounded w-20 px-1 py-0.5 text-xs text-center font-mono"
                      placeholder="e.g. B-01"
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
                      value={it.purchasePrice}
                      onChange={set('purchasePrice')}
                      className="border rounded w-20 px-1 py-0.5 text-xs text-right"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={it.salePrice}
                      onChange={set('salePrice')}
                      className="border rounded w-20 px-1 py-0.5 text-xs text-right"
                    />
                  </td>
                  <td className="font-bold text-slate-800">
                    {fmt((Number(it.qty) || 0) * (Number(it.purchasePrice) || 0))}
                  </td>
                  <td>
                    <button
                      onClick={() => setItems((x) => x.filter((_, i) => i !== idx))}
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
                <td colSpan="8" className="p-6 text-center text-slate-400">
                  Koi medicine add nahi hui. Upar dropdown se medicine chunein aur Add dabayein.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 text-xs">
        <label className="font-semibold text-slate-700 flex items-center gap-2">
          Amount Paid Now:
          <input
            type="number"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            className="border rounded px-2 py-1 w-28 text-right font-bold text-emerald-700"
          />
        </label>
        <div className="text-right">
          <span className="text-slate-500 mr-2">Grand Total:</span>
          <b className="text-base text-emerald-700">{fmt(total)}</b>
        </div>
      </div>

      <button
        onClick={save}
        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
      >
        <CheckCircle2 className="w-4 h-4" />
        Save Purchase & Update Inventory Batches (اسٹاک درج کریں)
      </button>
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
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
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
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-1.5 text-xs"
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
    msg += `*ITEMS REQUIRED (طلب ادویات):*\n`

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
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition"
              >
                <Package className="w-4 h-4" />
                🚚 Receive Stock (Convert to Invoice)
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
// MODAL: CREATE NEW PURCHASE RETURN (خریداری واپسی)
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
    <Modal title="New Purchase Return (سپلائر کو خریداری واپسی)" onClose={onClose}>
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
                <option value="EXPIRED">⏰ Expired Stock (تاریخ ختم)</option>
                <option value="NEAR_EXPIRY">⌛ Near Expiry (قریب المیعاد)</option>
                <option value="DAMAGED">💥 Damaged / Broken (خراب یا ٹوٹا ہوا)</option>
                <option value="WRONG_ITEM">❌ Wrong Item Delivered (غلط دوائی)</option>
                <option value="OVER_STOCKED">📦 Slow Moving / Excess (اضافی اسٹاک)</option>
                <option value="OTHER">📝 Other (دیگر)</option>
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
                    Koi item return list mein shamil nahi. Upar batch chunein aur "+ Add to Return" dabayein.
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
                <b className="text-slate-800">💳 Debit Note / Adjust in Balance (کھاتے سے منہا)</b>
                <p className="text-[11px] text-slate-500">
                  Return amount ({fmt(grandTotal)}) supplier ke payable balance mein se deduct ho jayegi.
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
                <b className="text-slate-800">💵 Cash Refund Received (نقد رقم وصول کی)</b>
                <p className="text-[11px] text-slate-500">
                  Supplier ne delivery rider ke zariye foran cash refund ada kar diya hai.
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
          Submit Purchase Return & Deduct Inventory Stock (واپسی مکمل کریں)
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
    msg += `*RETURNED MEDICINES (واپس کی گئی ادویات):*\n`

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
