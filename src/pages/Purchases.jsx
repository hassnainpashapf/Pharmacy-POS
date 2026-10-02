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
} from 'lucide-react'

export default function Purchases() {
  const db = useDB()
  const location = useLocation()
  const navigate = useNavigate()

  // Tabs: 'orders' (Parches Orders) | 'invoices' (Inward Invoices & Supplier Dues)
  const [tab, setTab] = useState('orders')
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [showNewPO, setShowNewPO] = useState(false)
  const [viewingPO, setViewingPO] = useState(null)
  const [receivingPO, setReceivingPO] = useState(null)

  // Sync tab with URL search params if present
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const t = params.get('tab')
    if (t === 'orders' || t === 'invoices') {
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
            Purchases & Orders (خریداری اور آرڈرز)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Suppliers ke Purchase Orders (Parches Orders) manage karein, stock audit ki kam medicines ko reorder karein aur invoices verify karein.
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
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setTabAndUrl('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
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
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
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
