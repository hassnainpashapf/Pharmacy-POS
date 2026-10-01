import { useState } from 'react'
import { useDB, savePurchase, fmt, medicineById, todayStr } from '../lib/db'
import { Modal, Input } from './Medicines'

export default function Purchases() {
  const db = useDB()
  const [showNew, setShowNew] = useState(false)

  // supplier-wise outstanding report
  const supReport = db.suppliers.map((s) => {
    const purchases = db.purchases.filter((p) => p.supplierId === s.id)
    const totalPurchases = purchases.reduce((a, p) => a + p.total, 0)
    const totalPaid = purchases.reduce((a, p) => a + p.paid, 0)
    // balance supplier par hi authoritative hai (payments usi se subtract hote hain)
    const invoices = purchases.length
    const lastDate = purchases.map((p) => p.date).sort().slice(-1)[0]
    return { ...s, totalPurchases, totalPaid, invoices, lastDate, outstanding: Math.max(0, s.balance) }
  }).sort((a, b) => b.outstanding - a.outstanding)
  const totalOutstanding = supReport.reduce((a, s) => a + s.outstanding, 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Purchases</h2>
        <button onClick={() => setShowNew(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold">+ New Purchase</button>
      </div>

      {/* Supplier-wise Outstanding Balance Report */}
      <div className="bg-white rounded-xl shadow overflow-auto">
        <div className="p-3 border-b flex justify-between items-center">
          <h3 className="font-bold">🏢 Supplier-wise Outstanding Balance</h3>
          <div className="text-sm">Total Payable: <b className="text-red-600">{fmt(totalOutstanding)}</b></div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600"><tr><th className="p-2 text-left">Supplier</th><th>Company</th><th>Phone</th><th>Invoices</th><th>Total Purchases</th><th>Total Paid</th><th>Outstanding</th><th>Last Purchase</th></tr></thead>
          <tbody>
            {supReport.map((s) => (
              <tr key={s.id} className={`border-t text-center ${s.outstanding > 0 ? 'bg-red-50/50' : ''}`}>
                <td className="p-2 text-left"><b>{s.name}</b></td>
                <td>{s.company || '—'}</td>
                <td>{s.phone || '—'}</td>
                <td>{s.invoices}</td>
                <td>{fmt(s.totalPurchases)}</td>
                <td className="text-green-700">{fmt(s.totalPaid)}</td>
                <td className={s.outstanding > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>{fmt(s.outstanding)}</td>
                <td className="text-xs text-gray-500">{s.lastDate || '—'}</td>
              </tr>
            ))}
            {!supReport.length && <tr><td colSpan="8" className="p-4 text-center text-slate-400">No suppliers registered yet</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-xl shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600"><tr><th className="p-2 text-left">Date</th><th>Invoice</th><th>Supplier</th><th>Items</th><th>Total</th><th>Paid</th></tr></thead>
          <tbody>
            {[...db.purchases].reverse().map((p) => (
              <tr key={p.id} className="border-t text-center">
                <td className="p-2 text-left">{p.date}</td>
                <td className="font-mono text-xs">{p.invoiceNo}</td>
                <td>{db.suppliers.find((s) => s.id === p.supplierId)?.name}</td>
                <td>{p.items?.length || 0}</td>
                <td>{fmt(p.total)}</td>
                <td>{fmt(p.paid)}</td>
              </tr>
            ))}
            {!db.purchases.length && <tr><td colSpan="6" className="p-6 text-center text-slate-400">No purchase records logged yet</td></tr>}
          </tbody>
        </table>
      </div>
      {showNew && <PurchaseForm onClose={() => setShowNew(false)} />}
    </div>
  )
}

function PurchaseForm({ onClose }) {
  const db = useDB()
  const [supplierId, setSupplierId] = useState(db.suppliers[0]?.id || '')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paid, setPaid] = useState(0)
  const [items, setItems] = useState([]) // {medicineId, batchNo, expiry, qty, purchasePrice, salePrice}
  const [mid, setMid] = useState('')

  const total = items.reduce((s, i) => s + i.qty * i.purchasePrice, 0)

  function addItem() {
    const m = medicineById(mid)
    if (!m) return
    setItems((x) => [...x, { medicineId: m.id, batchNo: '', expiry: '', qty: 1, purchasePrice: Math.round(m.salePrice * 0.75), salePrice: m.salePrice }])
    setMid('')
  }

  function save() {
    if (!items.length) return alert('Add items first')
    try {
      savePurchase({ supplierId, invoiceNo: invoiceNo || 'INV-' + Date.now(), date, items, paid })
      onClose()
    } catch (e) { alert(e.message) }
  }

  return (
    <Modal title="New Purchase (GRN)" onClose={onClose} >
      <div className="grid grid-cols-4 gap-3 text-sm mb-4">
        <label className="col-span-2">Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="border rounded w-full px-2 py-1.5">
            {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <Input label="Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="flex gap-2 mb-2 text-sm">
        <select value={mid} onChange={(e) => setMid(e.target.value)} className="border rounded px-2 py-1.5 flex-1">
          <option value="">— Select medicine —</option>
          {db.medicines.map((m) => <option key={m.id} value={m.id}>{m.name} {m.strength}</option>)}
        </select>
        <button onClick={addItem} className="bg-blue-600 text-white px-4 rounded">+ Add</button>
      </div>

      <table className="w-full text-xs">
        <thead className="bg-gray-100"><tr><th className="p-1">Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>P.Price</th><th>S.Price</th><th>Total</th><th></th></tr></thead>
        <tbody>
          {items.map((it, idx) => {
            const m = medicineById(it.medicineId)
            const set = (k) => (e) => setItems((x) => x.map((r, i) => i === idx ? { ...r, [k]: e.target.value } : r))
            return (
              <tr key={idx} className="border-t text-center">
                <td className="p-1 text-left">{m?.name}</td>
                <td><input value={it.batchNo} onChange={set('batchNo')} className="border rounded w-20 px-1 py-0.5" placeholder="B#"/></td>
                <td><input type="date" value={it.expiry} onChange={set('expiry')} className="border rounded px-1 py-0.5"/></td>
                <td><input type="number" value={it.qty} onChange={set('qty')} className="border rounded w-16 px-1 py-0.5"/></td>
                <td><input type="number" value={it.purchasePrice} onChange={set('purchasePrice')} className="border rounded w-20 px-1 py-0.5"/></td>
                <td><input type="number" value={it.salePrice} onChange={set('salePrice')} className="border rounded w-20 px-1 py-0.5"/></td>
                <td>{fmt(it.qty * it.purchasePrice)}</td>
                <td><button onClick={() => setItems((x) => x.filter((_, i) => i !== idx))} className="text-red-500 px-1">✕</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex justify-between items-center mt-4 text-sm">
        <label>Paid now: <input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} className="border rounded px-2 py-1 w-28"/></label>
        <div className="text-lg">Grand Total: <b className="text-emerald-700">{fmt(total)}</b></div>
      </div>
      <button onClick={save} className="mt-3 w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold">Save Purchase (Stock In + Batches)</button>
    </Modal>
  )
}
