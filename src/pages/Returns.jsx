import { useState, useMemo } from 'react'
import { useDB, findSaleByInvoice, returnSaleItem, medicineById, fmt, returnsHistory, customerById } from '../lib/db'
import { Search, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react'
import DateFilterBar, { matchesDateFilter, useDateFilterState } from '../components/DateFilterBar'

export default function Returns() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [sale, setSale] = useState(null)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const [historyDateFilter, setHistoryDateFilter] = useDateFilterState('all')
  const history = returnsHistory()

  const filteredHistory = useMemo(() => {
    return history.filter((r) => matchesDateFilter(r.date, historyDateFilter))
  }, [history, historyDateFilter])

  function search() {
    setErr('')
    setDone('')
    setSale(null)
    if (!q.trim()) return
    const s = findSaleByInvoice(q.trim())
    if (!s) {
      setErr('Invoice not found — please check invoice number (e.g. INV-00001)')
      return
    }
    setSale(s)
  }

  function doReturn(itemIndex, qty, name) {
    const n = Number(qty)
    if (!n || n <= 0) return
    const refundEstimate = fmt(n * sale.items[itemIndex].price)
    if (!confirm(`Confirm return of ${n} unit(s) of ${name}?\nStock will be restored to original batch and customer refunded: ${refundEstimate}`)) {
      return
    }
    try {
      const refund = returnSaleItem(sale.id, itemIndex, n)
      setDone(`✓ Return processed successfully — Refund issued: ${fmt(refund)}`)
      setSale({ ...sale })
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-600" /> Sales Return & Customer Refund
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search sales invoice to process returns. Returned inventory is restored directly to its original batch.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="e.g. INV-00001"
              className="border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs font-mono w-full bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={search}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            Search Invoice
          </button>
        </div>

        {err && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        {done && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{done}</span>
          </div>
        )}
      </div>

      {/* Found Invoice Items */}
      {sale && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap justify-between items-center text-xs gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {sale.invoiceNo}
              </span>
              <span className="text-slate-500">{new Date(sale.date).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-4 text-slate-700">
              <span>Customer: <b>{sale.customerId ? customerById(sale.customerId)?.name : 'Walk-in'}</b></span>
              <span>Payment: <b className="uppercase">{sale.payMethod}</b></span>
              <span>Invoice Total: <b className="text-slate-900">{fmt(sale.total)}</b></span>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Medicine</th>
                <th className="p-3 text-center">Batch</th>
                <th className="p-3 text-center">Purchased Qty</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-center">Return Qty</th>
                <th className="p-3 text-right">Refund Amount</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((it, i) => {
                const m = medicineById(it.medicineId)
                return (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="p-3 text-left">
                      <b className="text-slate-900">{m?.name}</b> <span className="text-slate-500">{m?.strength}</span>
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">{it.batchNo}</td>
                    <td className="p-3 text-center font-bold text-slate-700">{it.qty}</td>
                    <td className="p-3 text-right text-slate-700">{fmt(it.price)}</td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max={it.qty}
                        defaultValue={it.qty}
                        id={`ret-${i}`}
                        className="border border-slate-200 rounded-lg w-16 px-2 py-1 text-center font-bold text-xs bg-slate-50 focus:bg-white"
                      />
                    </td>
                    <td className="p-3 text-right font-bold text-rose-600">{fmt(it.qty * it.price)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => doReturn(i, document.getElementById(`ret-${i}`).value, m?.name)}
                        disabled={it.qty === 0}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          it.qty === 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95'
                        }`}
                      >
                        Process Return
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Return Logs History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden space-y-3 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <h3 className="font-bold text-slate-900 text-sm">Return & Refund History ({filteredHistory.length})</h3>
        </div>

        <DateFilterBar filterState={historyDateFilter} onChange={setHistoryDateFilter} />

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-3 text-left">Date & Time</th>
                <th className="p-3 text-left">Invoice No</th>
                <th className="p-3 text-left">Restored Items</th>
                <th className="p-3 text-right">Refund Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="p-3 text-left text-slate-500">{new Date(r.date).toLocaleString()}</td>
                  <td className="p-3 text-left font-mono font-bold text-slate-800">{r.invoiceNo}</td>
                  <td className="p-3 text-left text-slate-600">
                    {r.items.map((x) => `${medicineById(x.medicineId)?.name} ×${x.qty}`).join(', ')}
                  </td>
                  <td className="p-3 text-right font-bold text-rose-600">{fmt(r.refund)}</td>
                </tr>
              ))}
              {!filteredHistory.length && (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-slate-400">
                    No return transactions match the selected filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
