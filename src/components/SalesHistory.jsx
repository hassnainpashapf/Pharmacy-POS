import { useState, useMemo } from 'react'
import {
  useDB,
  allSalesInScope,
  deleteSale,
  updateSale,
  fmt,
  medicineById,
  stockOf,
  customerById,
} from '../lib/db'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from './DateFilterBar'
import {
  Search,
  Printer,
  Edit3,
  Trash2,
  Calendar,
  CreditCard,
  Banknote,
  FileText,
  AlertTriangle,
  Plus,
  Minus,
  X,
  Check,
  RotateCcw,
  ArrowUpDown,
  ShoppingBag,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

export default function SalesHistory({ onReprint }) {
  const db = useDB()
  const sales = allSalesInScope()

  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useDateFilterState('all')
  const [payFilter, setPayFilter] = useState('ALL') // ALL | CASH | CARD | CREDIT
  const [expandedSaleId, setExpandedSaleId] = useState(null)
  const [editingSale, setEditingSale] = useState(null)
  const [deletingSale, setDeletingSale] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  // Filter sales
  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase()

    return sales.filter((s) => {
      // Payment filter
      if (payFilter !== 'ALL' && s.payMethod !== payFilter) return false

      // Date filter
      if (!matchesDateFilter(s.date, dateFilter)) return false

      // Search query
      if (!q) return true

      const invoiceMatch = s.invoiceNo?.toLowerCase().includes(q)
      const cashierMatch = (s.soldByName || s.soldBy || '').toLowerCase().includes(q)
      const customer = s.customerId ? customerById(s.customerId) : null
      const customerMatch = customer?.name?.toLowerCase().includes(q) || customer?.phone?.includes(q)

      const itemsMatch = (s.items || []).some((it) => {
        const m = medicineById(it.medicineId)
        return (
          m?.name?.toLowerCase().includes(q) ||
          m?.generic?.toLowerCase().includes(q) ||
          (it.batchNo && it.batchNo.toLowerCase().includes(q))
        )
      })

      return invoiceMatch || cashierMatch || customerMatch || itemsMatch
    })
  }, [sales, search, dateFilter, payFilter])

  // Summary Metrics
  const summary = useMemo(() => {
    const totalAmount = filteredSales.reduce((acc, s) => acc + (s.total || 0), 0)
    const count = filteredSales.length
    const cash = filteredSales
      .filter((s) => s.payMethod === 'CASH')
      .reduce((acc, s) => acc + (s.total || 0), 0)
    const card = filteredSales
      .filter((s) => s.payMethod === 'CARD')
      .reduce((acc, s) => acc + (s.total || 0), 0)
    const credit = filteredSales
      .filter((s) => s.payMethod === 'CREDIT')
      .reduce((acc, s) => acc + (s.total || 0), 0)
    const discounts = filteredSales.reduce((acc, s) => acc + (s.discount || 0), 0)

    return { totalAmount, count, cash, card, credit, discounts }
  }, [filteredSales])

  function showFeedback(msg) {
    setFeedbackMsg(msg)
    setTimeout(() => setFeedbackMsg(''), 4500)
  }

  function handleDeleteConfirm(sale) {
    try {
      const res = deleteSale(sale.id)
      setDeletingSale(null)
      showFeedback(`✓ Invoice ${res.invoiceNo} deleted successfully and items restocked to inventory!`)
    } catch (err) {
      alert(err.message || 'Failed to delete sale')
    }
  }

  function handleSaveEdit(saleId, updates) {
    try {
      const updated = updateSale(saleId, updates)
      setEditingSale(null)
      showFeedback(`✓ Invoice ${updated.invoiceNo} updated successfully! Total: ${fmt(updated.total)}`)
    } catch (err) {
      alert(err.message || 'Failed to update sale')
    }
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100 p-2 sm:p-3 font-sans">
      {/* Toast Notification */}
      {feedbackMsg && (
        <div className="mb-2 p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top duration-200 shrink-0">
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg('')} className="text-emerald-100 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-2.5 shrink-0">
        <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Sales</div>
          <div className="text-base font-black text-slate-900 mt-0.5 truncate">{fmt(summary.totalAmount)}</div>
          <div className="text-[10px] text-slate-500 font-medium">{summary.count} Invoices</div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <Banknote className="w-3 h-3" /> Cash Sales
          </div>
          <div className="text-base font-black text-emerald-800 mt-0.5 truncate">{fmt(summary.cash)}</div>
          <div className="text-[10px] text-slate-500 font-medium">Counter cash</div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
            <CreditCard className="w-3 h-3" /> Card Sales
          </div>
          <div className="text-base font-black text-blue-800 mt-0.5 truncate">{fmt(summary.card)}</div>
          <div className="text-[10px] text-slate-500 font-medium">Digital payments</div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3" /> Credit / Udhar
          </div>
          <div className="text-base font-black text-amber-800 mt-0.5 truncate">{fmt(summary.credit)}</div>
          <div className="text-[10px] text-slate-500 font-medium">Receivable balance</div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Discounts Given</div>
          <div className="text-base font-black text-purple-800 mt-0.5 truncate">{fmt(summary.discounts)}</div>
          <div className="text-[10px] text-slate-500 font-medium">Deductions</div>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Station</div>
          <div className="text-xs font-black text-slate-900 mt-1 truncate">
            {db.localNetwork?.stationName || 'Counter 01'}
          </div>
          <div className="text-[10px] text-emerald-600 font-bold truncate">● Offline Ready</div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0 mb-3">
        <DateFilterBar filterState={dateFilter} onChange={setDateFilter} />

        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice #, medicine, batch, customer, or cashier..."
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

          {/* Payment Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
            {[
              { id: 'ALL', label: 'All Methods' },
              { id: 'CASH', label: 'Cash' },
              { id: 'CARD', label: 'Card' },
              { id: 'CREDIT', label: 'Credit' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPayFilter(tab.id)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                  payFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices List / Table */}
      <div className="flex-1 min-h-0 bg-white border border-slate-300 rounded-xl shadow-2xs overflow-hidden flex flex-col">
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-300 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <span>Invoices & Completed Sales</span>
            <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {filteredSales.length} records
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Click 🖨️ to Reprint, ✏️ to Edit, 🗑️ to Void / Restock
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
              <div className="text-sm font-bold text-slate-700">No Sales Invoices Found</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {search || dateFilter !== 'ALL' || payFilter !== 'ALL'
                  ? 'No sales match the selected search or filter criteria. Try resetting filters.'
                  : 'Completed POS transactions will appear here with instant reprint, edit, and void options.'}
              </p>
            </div>
          ) : (
            filteredSales.map((sale) => {
              const customer = sale.customerId ? customerById(sale.customerId) : null
              const isExpanded = expandedSaleId === sale.id
              const saleDate = new Date(sale.date)
              const formattedDate = saleDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              const formattedTime = saleDate.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={sale.id}
                  className="p-3 hover:bg-slate-50/80 transition-colors group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* Invoice ID & Date Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md">
                          {sale.invoiceNo}
                        </span>

                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formattedDate}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-slate-500">{formattedTime}</span>
                        </span>

                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            sale.payMethod === 'CASH'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : sale.payMethod === 'CARD'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {sale.payMethod === 'CASH' ? '💵 Cash' : sale.payMethod === 'CARD' ? '💳 Card' : '📝 Credit'}
                        </span>

                        {sale.rxNotes && (
                          <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded-md">
                            Rx Note
                          </span>
                        )}
                      </div>

                      {/* Customer & Staff */}
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          Customer:{' '}
                          <strong className="text-slate-800 font-semibold">
                            {customer ? `${customer.name} (${customer.phone || 'No phone'})` : 'Walk-in Customer'}
                          </strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Cashier:{' '}
                          <strong className="text-slate-700 font-medium">
                            {sale.soldByName || sale.soldBy || 'Staff'}
                          </strong>
                        </span>
                        {sale.counterId && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500 font-mono text-[11px]">{sale.counterId}</span>
                          </>
                        )}
                      </div>

                      {/* Items Preview */}
                      <div className="mt-1.5 text-xs text-slate-700 flex items-center gap-1 flex-wrap">
                        <span className="font-bold text-slate-800">Items Sold:</span>
                        {(sale.items || []).slice(0, 3).map((it, idx) => {
                          const m = medicineById(it.medicineId)
                          return (
                            <span
                              key={idx}
                              className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium"
                            >
                              {m?.name || 'Medicine'} ({it.qty}x)
                              {it.batchNo ? ` [${it.batchNo}]` : ''}
                            </span>
                          )
                        })}
                        {(sale.items || []).length > 3 && (
                          <button
                            type="button"
                            onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                          >
                            {isExpanded ? 'Hide' : `+${(sale.items || []).length - 3} more...`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Financial Amount & Action Buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-xs text-slate-400 font-medium">Total Bill</div>
                        <div className="text-base font-black text-slate-900 font-mono">
                          {fmt(sale.total)}
                        </div>
                        {sale.discount > 0 && (
                          <div className="text-[10px] text-purple-700 font-bold">
                            Disc: -{fmt(sale.discount)}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons: Print Again, Edit, Delete */}
                      <div className="flex items-center gap-1.5">
                        {/* Print Again Button */}
                        <button
                          type="button"
                          onClick={() => onReprint(sale)}
                          title="Print Thermal Receipt Again"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Print Again</span>
                        </button>

                        {/* Edit Sale Button */}
                        <button
                          type="button"
                          onClick={() => setEditingSale(sale)}
                          title="Edit Sale & Adjust Items/Discount"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Edit</span>
                        </button>

                        {/* Delete / Void Sale Button */}
                        <button
                          type="button"
                          onClick={() => setDeletingSale(sale)}
                          title="Delete / Void Sale & Restock Inventory"
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Items Drawer if clicked */}
                  {isExpanded && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
                      <div className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                        <span>All Items in Invoice {sale.invoiceNo}</span>
                        <span className="text-[11px] text-slate-500 font-normal">
                          {sale.items?.length || 0} distinct medicines
                        </span>
                      </div>
                      <div className="divide-y divide-slate-200">
                        {(sale.items || []).map((it, idx) => {
                          const m = medicineById(it.medicineId)
                          return (
                            <div key={idx} className="py-1.5 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-900">{m?.name || 'Medicine'}</span>{' '}
                                <span className="text-slate-500 text-[11px]">({m?.strength || ''} {m?.form || ''})</span>
                                {it.batchNo && (
                                  <span className="ml-2 font-mono text-[10px] text-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                    Batch: {it.batchNo}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-slate-800 font-bold">
                                {it.qty} × {fmt(it.price)} = {fmt(it.qty * it.price)}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {sale.rxNotes && (
                        <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-purple-900">
                          <strong>Doctor Rx Prescription Note:</strong> {sale.rxNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Edit Sale Modal */}
      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSave={(updates) => handleSaveEdit(editingSale.id, updates)}
        />
      )}

      {/* Delete / Void Sale Confirmation Modal */}
      {deletingSale && (
        <DeleteSaleModal
          sale={deletingSale}
          onClose={() => setDeletingSale(null)}
          onConfirm={() => handleDeleteConfirm(deletingSale)}
        />
      )}
    </div>
  )
}

function EditSaleModal({ sale, onClose, onSave }) {
  const db = useDB()
  const [items, setItems] = useState(() => (sale.items || []).map((it) => ({ ...it })))
  const [discount, setDiscount] = useState(sale.discount || 0)
  const [payMethod, setPayMethod] = useState(sale.payMethod || 'CASH')
  const [rxNotes, setRxNotes] = useState(sale.rxNotes || '')
  const [searchNew, setSearchNew] = useState('')
  const [err, setErr] = useState('')

  // Search medicines to add
  const searchResults =
    searchNew.trim().length >= 1
      ? db.medicines
          .filter((m) => {
            const q = searchNew.toLowerCase()
            return (
              m.name.toLowerCase().includes(q) ||
              (m.generic && m.generic.toLowerCase().includes(q)) ||
              (m.barcode || '').includes(q)
            )
          })
          .slice(0, 6)
      : []

  function setItemQty(index, qty) {
    if (qty <= 0) {
      setItems((prev) => prev.filter((_, i) => i !== index))
    } else {
      setItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, qty } : it))
      )
    }
  }

  function addNewMedicine(med) {
    const existingIdx = items.findIndex((it) => it.medicineId === med.id)
    if (existingIdx !== -1) {
      setItemQty(existingIdx, items[existingIdx].qty + 1)
    } else {
      setItems((prev) => [
        ...prev,
        {
          medicineId: med.id,
          batchNo: 'AUTO-FEFO',
          qty: 1,
          price: med.salePrice || 0,
        },
      ])
    }
    setSearchNew('')
  }

  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0)
  const total = Math.max(0, subtotal - Number(discount || 0))

  function handleSave() {
    setErr('')
    if (!items.length) {
      return setErr('A sale must contain at least one medicine. Use Void/Delete to cancel the sale completely.')
    }
    try {
      onSave({
        items,
        discount: Number(discount || 0),
        payMethod,
        rxNotes,
      })
    } catch (e) {
      setErr(e.message || 'Failed to save changes')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-black flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-400" />
              Edit Invoice {sale.invoiceNo}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Adjust sold quantities, add medicines, discount, or payment method
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {err && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* Add Medicine Search */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Add More Medicine to this Sale
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchNew}
                onChange={(e) => setSearchNew(e.target.value)}
                placeholder="Type medicine name to add to this invoice..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />

              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100">
                  {searchResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addNewMedicine(m)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <strong className="text-slate-900 font-bold">{m.name}</strong>{' '}
                        <span className="text-slate-500">({m.strength})</span>
                      </div>
                      <div className="font-mono text-emerald-700 font-bold">{fmt(m.salePrice)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Items in Invoice ({items.length})
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-52 overflow-y-auto">
              {items.map((it, idx) => {
                const med = medicineById(it.medicineId)
                return (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {med?.name || 'Medicine'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {med?.strength} · Rate: {fmt(it.price)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Qty +/- */}
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setItemQty(idx, it.qty - 1)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 py-1 text-xs font-bold font-mono text-slate-900 min-w-[28px] text-center">
                          {it.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemQty(idx, it.qty + 1)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-mono font-black text-xs text-slate-900 min-w-[70px] text-right">
                        {fmt(it.qty * it.price)}
                      </div>

                      <button
                        type="button"
                        onClick={() => setItemQty(idx, 0)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Discount & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Discount (Rs.)
              </label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="CASH">💵 Cash</option>
                <option value="CARD">💳 Debit/Credit Card</option>
                <option value="CREDIT">📝 Credit / Udhar</option>
              </select>
            </div>
          </div>

          {/* Doctor Prescription Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Prescription / Doctor Notes
            </label>
            <input
              type="text"
              value={rxNotes}
              onChange={(e) => setRxNotes(e.target.value)}
              placeholder="e.g. Dr. Asif prescription ref #492"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Totals Summary */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(subtotal)}</span>
            </div>
            {Number(discount) > 0 && (
              <div className="flex justify-between text-purple-700 font-medium">
                <span>Discount</span>
                <span className="font-mono">-{fmt(Number(discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 pt-1.5 border-t border-slate-300">
              <span>Updated Total</span>
              <span className="font-mono text-emerald-700">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-o-blue hover:bg-o-blue-d active:bg-o-blue-d border border-o-blue-d text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" /> Save Changes & Update Stock
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteSaleModal({ sale, onClose, onConfirm }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white" />
            <h2 className="text-sm font-black">Void / Delete Invoice {sale.invoiceNo}</h2>
          </div>
          <button onClick={onClose} className="text-rose-100 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs text-slate-700">
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 font-medium">
            <strong>Warning:</strong> Deleting this invoice will permanently remove the sale transaction.
            All sold medicines will be <strong>automatically returned to their stock batches</strong> in the inventory.
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Invoice Number:</span>
              <span className="font-mono font-bold text-slate-900">{sale.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Total Bill:</span>
              <span className="font-mono font-bold text-rose-700">{fmt(sale.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Date & Time:</span>
              <span className="text-slate-700 font-medium">{new Date(sale.date).toLocaleString()}</span>
            </div>
          </div>

          <div>
            <div className="font-bold text-slate-800 mb-1">
              Items to be Restored to Stock:
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-100">
              {(sale.items || []).map((it, i) => {
                const m = medicineById(it.medicineId)
                return (
                  <div key={i} className="pt-1 first:pt-0 flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-800">
                      • {m?.name || 'Medicine'} ({it.qty} units)
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      Batch: {it.batchNo || 'Main'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-900/20 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Confirm Delete & Restock
          </button>
        </div>
      </div>
    </div>
  )
}
