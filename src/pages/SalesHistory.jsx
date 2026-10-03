import { useState, useMemo } from 'react'
import {
  Search, Trash2, Pencil, Printer, Eye, X, ChevronDown,
  TrendingUp, Users, ShoppingBag, Calendar, Check,
} from 'lucide-react'
import {
  useDB, fmt, allSalesInScope, deleteSale, updateSale, can, currentUser,
} from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from '../components/DateFilterBar'

/* ─── helpers ─────────────────────────────────────── */
const today   = () => new Date().toISOString().slice(0, 10)
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10) }
const monthAgo= () => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10) }
const dateKey = (v) => v ? String(v).slice(0, 10) : ''
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' }) : '—'
const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit' }) : ''

function statSum(sales, from, to) {
  const filtered = sales.filter(s => {
    const d = dateKey(s.date)
    return d >= from && d <= to
  })
  return {
    count: filtered.length,
    total: filtered.reduce((t, s) => t + Number(s.total || 0), 0),
    customers: new Set(filtered.map(s => s.customerId).filter(Boolean)).size,
  }
}

/* ─── Print receipt ────────────────────────────────── */
function printReceipt(sale) {
  const win = window.open('', '_blank', 'width=350,height=600')
  win.document.write(`<html><head><title>Receipt ${sale.invoiceNo || sale.id}</title>
  <style>body{font-family:monospace;font-size:12px;padding:16px;max-width:300px}
  h2{font-size:15px;text-align:center;margin:0}
  p{margin:2px 0}.line{border-top:1px dashed #999;margin:8px 0}
  .row{display:flex;justify-content:space-between}</style></head><body>
  <h2>Pharmacy Receipt</h2>
  <p style="text-align:center">${sale.invoiceNo || sale.id}</p>
  <p style="text-align:center">${fmtDate(sale.date)} ${fmtTime(sale.date)}</p>
  <div class="line"></div>
  ${(sale.items || []).map(it => `<div class="row"><span>${it.name || it.medicineId || 'Item'} ×${it.qty}</span><span>Rs ${Number(it.price * it.qty).toFixed(0)}</span></div>`).join('')}
  <div class="line"></div>
  ${sale.discount ? `<div class="row"><span>Discount</span><span>-Rs ${Number(sale.discount).toFixed(0)}</span></div>` : ''}
  <div class="row"><b>Total</b><b>Rs ${Number(sale.total).toFixed(2)}</b></div>
  <div class="row"><span>Paid</span><span>Rs ${Number(sale.paid || sale.total).toFixed(2)}</span></div>
  <div class="line"></div>
  <p style="text-align:center">Thank you!</p>
  </body></html>`)
  win.document.close()
  win.print()
}

/* ─── Receipt Detail Modal ─────────────────────────── */
function ReceiptModal({ sale, onClose, onDelete, onEdit }) {
  const canDel = can('deleteSales')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-base">{sale.invoiceNo || sale.id}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{fmtDate(sale.date)} · {fmtTime(sale.date)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {/* Items */}
        <div className="p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase border-b border-slate-100">
                <th className="pb-2 text-left font-medium">Medicine</th>
                <th className="pb-2 text-center font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(sale.items || []).map((it, i) => (
                <tr key={i} className="text-xs">
                  <td className="py-2 font-medium text-slate-800">{it.name || it.medicineId || 'Item'}</td>
                  <td className="py-2 text-center text-slate-600">{it.qty}</td>
                  <td className="py-2 text-right text-slate-600">{fmt(it.price)}</td>
                  <td className="py-2 text-right font-semibold text-slate-900">{fmt(it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-sm">
            {sale.discount > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Discount</span><span>- {fmt(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 text-base">
              <span>Total</span><span>{fmt(sale.total)}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span>Payment</span><span>{sale.payMethod || 'Cash'}</span>
            </div>
            {sale.paid != null && (
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Paid</span><span>{fmt(sale.paid)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={() => { printReceipt(sale); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A09D] text-white text-sm font-semibold hover:bg-[#008784] transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={() => { onEdit(sale); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
            {canDel && (
              <button
                onClick={() => { onDelete(sale.id); onClose(); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Edit Modal ───────────────────────────────────── */
function EditModal({ sale, onClose, onSave }) {
  const [notes, setNotes] = useState(sale.notes || '')
  const [discount, setDiscount] = useState(String(sale.discount || 0))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true)
    setErr('')
    try {
      updateSale(sale.id, { notes, discount: Number(discount) || 0 })
      onSave()
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Edit Receipt</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">Invoice: <b className="text-slate-700">{sale.invoiceNo || sale.id}</b></p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Discount (Rs)</label>
            <input
              type="number" min="0" value={discount}
              onChange={e => setDiscount(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A09D]/30 focus:border-[#00A09D]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A09D]/30 focus:border-[#00A09D] resize-none"
              placeholder="Add notes to this receipt..."
            />
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button onClick={save} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl bg-[#3b1734] text-white text-sm font-semibold hover:bg-[#280c23] active:bg-[#1a0616] border border-[#280c23] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 transition-all">
              {busy ? 'Saving…' : <><Check className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Delete Confirm Modal ─────────────────────────── */
function DeleteModal({ sale, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function confirm() {
    setBusy(true)
    try {
      deleteSale(sale.id)
      onConfirm()
      onClose()
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="font-bold text-slate-900 text-lg mb-1">Delete Receipt?</h2>
          <p className="text-sm text-slate-500 mb-1">{sale.invoiceNo || sale.id}</p>
          <p className="text-sm text-slate-500 mb-4">Total: <b className="text-slate-800">{fmt(sale.total)}</b></p>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-4">
            Stock will be restored to inventory automatically.
          </p>
          {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button onClick={confirm} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer">
              {busy ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ────────────────────────────────────── */
export default function SalesHistory() {
  useDB()
  const me = currentUser()
  const canDel = can('deleteSales')

  const [search, setSearch] = useState('')
  const [payMethodFilter, setPayMethodFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useDateFilterState('all')
  const [viewSale, setViewSale] = useState(null)
  const [editSale, setEditSale] = useState(null)
  const [delSale,  setDelSale]  = useState(null)
  const [refresh,  setRefresh]  = useState(0)

  const all = allSalesInScope()
  const t = today()
  const w = weekAgo()
  const m = monthAgo()

  // Stats
  const dayStats  = useMemo(() => statSum(all, t, t), [refresh, all.length])
  const weekStats = useMemo(() => statSum(all, w, t), [refresh, all.length])
  const monthStats= useMemo(() => statSum(all, m, t), [refresh, all.length])

  // Filtered list
  const filtered = useMemo(() => {
    let list = all.filter(s => matchesDateFilter(s.date, dateFilter))
    if (payMethodFilter !== 'ALL') {
      list = list.filter(s => {
        const pm = (s.paymentMethod || s.paymentType || 'CASH').toUpperCase()
        if (payMethodFilter === 'SPLIT') return Boolean(s.splitPayment)
        return pm === payMethodFilter
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        (s.invoiceNo || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q) ||
        (s.items || []).some(it => (it.name || '').toLowerCase().includes(q))
      )
    }
    return list
  }, [all, dateFilter, payMethodFilter, search, refresh])

  const bump = () => setRefresh(r => r + 1)

  const statCards = [
    { label: 'Today', icon: Calendar, stats: dayStats, color: 'teal' },
    { label: 'Last 7 Days', icon: TrendingUp, stats: weekStats, color: 'purple' },
    { label: 'Last 30 Days', icon: ShoppingBag, stats: monthStats, color: 'orange' },
  ]

  const colorMap = {
    teal:   { bg: 'bg-[#e6f7f2]', text: 'text-[#00A09D]', badge: 'bg-[#00A09D]' },
    purple: { bg: 'bg-[#f5eef4]', text: 'text-[#714B67]', badge: 'bg-[#714B67]' },
    orange: { bg: 'bg-amber-50',  text: 'text-amber-700', badge: 'bg-amber-600' },
  }

  return (
    <div className="space-y-5 pb-12 pt-1">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales History</h1>
          <p className="text-xs text-slate-500 mt-0.5">View, edit, delete and reprint receipts</p>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, icon: Icon, stats, color }) => {
          const c = colorMap[color]
          return (
            <div key={label} className={`rounded-2xl p-5 border border-slate-200 bg-white shadow-sm`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${c.text}`} />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{fmt(stats.total)}</div>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" /> {stats.count} receipts
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {stats.customers} customers
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <DateFilterBar filterState={dateFilter} onChange={setDateFilter} />

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice #, customer name, or medicine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#714B67]"
            />
          </div>

          {/* Payment Method Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
            {[
              { id: 'ALL', label: 'All Sales' },
              { id: 'CASH', label: 'Cash' },
              { id: 'CARD', label: 'Card' },
              { id: 'SPLIT', label: 'Split' },
            ].map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setPayMethodFilter(pm.id)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                  payMethodFilter === pm.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Receipts Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <ShoppingBag className="w-10 h-10 opacity-30" />
            <p className="text-sm">No receipts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Items</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Payment</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-bold text-[#00A09D]">
                        {sale.invoiceNo || sale.id?.slice(0, 8) || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <div className="text-xs font-medium">{fmtDate(sale.date)}</div>
                      <div className="text-[10px] text-slate-400">{fmtTime(sale.date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-700">
                        {sale.customerName || (sale.customerId && sale.customerId !== 'walkin' ? `ID: ${sale.customerId}` : 'Walk-in')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {(sale.items || []).length} item{(sale.items || []).length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-slate-900">{fmt(sale.total)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sale.payMethod === 'CREDIT' ? 'bg-amber-100 text-amber-700' :
                        sale.payMethod === 'CARD'   ? 'bg-blue-100 text-blue-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {sale.payMethod || 'Cash'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewSale(sale)}
                          title="View Receipt"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#00A09D] hover:bg-[#e6f7f2] transition-colors cursor-pointer"
                        ><Eye className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => printReceipt(sale)}
                          title="Print"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        ><Printer className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => setEditSale(sale)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#714B67] hover:bg-[#f5eef4] transition-colors cursor-pointer"
                        ><Pencil className="w-3.5 h-3.5" /></button>
                        {canDel && (
                          <button
                            onClick={() => setDelSale(sale)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs text-slate-500">
              <span>{filtered.length} receipt{filtered.length !== 1 ? 's' : ''} shown</span>
              <span>Total: <b className="text-slate-800">{fmt(filtered.reduce((t, s) => t + Number(s.total || 0), 0))}</b></span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewSale && (
        <ReceiptModal
          sale={viewSale}
          onClose={() => setViewSale(null)}
          onDelete={id => { setDelSale(all.find(s => s.id === id)); setViewSale(null) }}
          onEdit={s => setEditSale(s)}
        />
      )}
      {editSale && (
        <EditModal
          sale={editSale}
          onClose={() => setEditSale(null)}
          onSave={bump}
        />
      )}
      {delSale && (
        <DeleteModal
          sale={delSale}
          onClose={() => setDelSale(null)}
          onConfirm={bump}
        />
      )}
    </div>
  )
}
